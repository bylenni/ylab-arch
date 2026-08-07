/**
 * Live-Pipeline-Backend — routet Kinderäußerungen durch echte Modelle via OpenRouter.
 * Modelle pro Step kommen aus dem Request (konfiguriert an den Canvas-Knoten der Webapp).
 *
 * Start: node --env-file-if-exists=.env server/index.mjs   (Teil von `npm run dev`)
 * Benötigt: OPENROUTER_API_KEY in .env
 */
import http from 'node:http'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  planStrategy,
  detectSkill,
  detectFrustration,
  recordExposure,
  recordOutcome,
  emptyLearnerState,
  directiveFor,
  extractExpectedAnswer,
  containsNumber,
  firstNumber,
  outcomeDirective,
} from './teachingPlanner.mjs'
import { decideRoute, normalizeUtterance } from './router.mjs'
import { resolveProvider, providerConfig } from './providers.mjs'
import { callModel, parseJson } from './llm.mjs'
import {
  PROMPT_VERSION, TRIAGE_SYSTEM, MAIN_SYSTEM, SAFETY_SYSTEM, DEFAULT_JUDGE_RUBRIC,
  SCRIPTED_EMOTION, SCRIPTED_RISK, SCRIPTED_CLARIFY, SCRIPTED_FALLBACK,
  OPENER_TEXTE, SCRIPTED_PIVOT,
} from './prompts.mjs'
import { runS2S } from './s2s.mjs'

const PORT = process.env.API_PORT ?? 8787
const execFileAsync = promisify(execFile)

/** Lokaler whisper.cpp-Server (`npm run stt`) — echtes self-hosted STT. */
const STT_URL = process.env.STT_URL ?? 'http://127.0.0.1:8788'
/** TTS-Engine-Kaskade: TTS_URL (extern, z. B. Orpheus/Kartoffel) > Piper (lokal, neuronal) > macOS say. */
const TTS_URL = process.env.TTS_URL ?? ''
const SERVER_DIR = dirname(fileURLToPath(import.meta.url))
const PIPER_BIN = join(SERVER_DIR, 'tts-venv', 'bin', 'piper')
const PIPER_VOICES = join(SERVER_DIR, 'tts-voices')
const PIPER_VOICE = process.env.PIPER_VOICE ?? 'de_DE-thorsten-high'
const piperAvailable = () => existsSync(PIPER_BIN) && existsSync(join(PIPER_VOICES, `${PIPER_VOICE}.onnx`))

function runPiper(text) {
  return new Promise((resolve, reject) => {
    const outFile = join(tmpdir(), `piper-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`)
    const proc = spawn(PIPER_BIN, ['-m', PIPER_VOICE, '--data-dir', PIPER_VOICES, '-f', outFile])
    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve(outFile)
      else reject(new Error(`piper exit ${code}: ${stderr.slice(0, 200)}`))
    })
    proc.stdin.write(text)
    proc.stdin.end()
  })
}

/** Lernstand pro Test-Session — In-Memory-Prototyp des datensparsamen Memory-Systems.
 *  Produktion: persistenter Store pro Kind, von Eltern einsehbar und löschbar. */
const learnerStates = new Map()
/** Obergrenze wie bei den Caches: Eval-Läufe erzeugen pro Fall eine einmalige `eval-…`-sessionId,
 *  die nie wieder gebraucht wird — ohne Cap würde jeder Prüfstand-Lauf die Map dauerhaft aufblähen.
 *  Achtung: Eviction ist FIFO (kein Nutzungs-Refresh) — bei sehr vielen Eval-Läufen ohne Neustart
 *  kann auch eine aktive Live-Session rausfallen und ihren Lernstand verlieren. Für das Dev-Studio
 *  akzeptiert; Produktion braucht ohnehin einen persistenten Store. */
const LEARNER_STATES_MAX = 500

function setLearnerState(sessionId, learner) {
  learnerStates.set(sessionId, learner)
  if (learnerStates.size > LEARNER_STATES_MAX) {
    learnerStates.delete(learnerStates.keys().next().value) // ältester Eintrag raus (FIFO)
  }
}

/* ------------------------------------------------------------------ */
/* Caching — Referenz-Implementierung des Produktionsmusters.
 * Grundregeln: Key = Hash ALLER ergebnisrelevanten Eingaben inkl. Versionen;
 * Invalidierung über neue Keys (nie mutieren); Hits/Misses messen.          */
/* ------------------------------------------------------------------ */

const cacheStats = { ttsHits: 0, ttsMisses: 0, triageHits: 0, triageMisses: 0, answerHits: 0, answerMisses: 0 }

/** TTS-Cache auf Platte: identischer Text + identische Stimme = identisches Audio.
 *  In Produktion: Objektspeicher/CDN + die häufigsten Bausteine auf der Box selbst. */
const TTS_CACHE_DIR = join(SERVER_DIR, 'tts-cache')

/** Triage-Cache im Speicher, NUR für kontextfreie Erst-Turns — mit Historie ist
 *  dieselbe Äußerung nicht mehr dasselbe Klassifikationsproblem. LRU über Map-Ordnung. */
const triageCache = new Map()
const TRIAGE_CACHE_MAX = 500

/** Antwort-Cache („goldene Antworten"): überspringt Prompt-Assembly, Haupt-LLM UND Safety.
 *  Nur bereits GEPRÜFTE Antworten landen hier (Cache konserviert Safety, umgeht sie nie).
 *  Bewusst NICHT gecacht: Lernfragen (Antwort hängt vom Lernstand ab), Geschichten
 *  (Vielfalt ist Produktqualität), alles mit Kontext oder Erfolgssignal. */
const answerCache = new Map()
const ANSWER_CACHE_MAX = 200

const splitList = (value) =>
  String(value ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

async function runPipeline({ utterance, ageBand = '4-5', models = {}, blockPatterns = '', systemPrompt = '', sessionId = 'default', plannerEnabled = true, history = [], noCache = false }) {
  const stages = []
  const warnings = ['Live-Kette ohne STT/TTS — reale Sprach-Latenz kommt oben drauf.']
  const triageModel = models.triage || 'google/gemini-2.5-flash-lite'
  const mainModel = models.main || 'meta-llama/llama-3.3-70b-instruct'
  const safetyModel = models.safety || 'openai/gpt-4o-mini'

  // Datenresidenz: Nutzt die Pipeline sonst bewusst EU-Modelle (melious:), aber für eine
  // Stufe wurde keines übergeben, greift hier still ein OpenRouter-Default — das verlässt
  // unbemerkt die EU. Explizit warnen, statt die EU-Pipeline heimlich zu verlassen.
  const explicitMeliousUsed = [models.triage, models.main, models.safety].some(
    (m) => typeof m === 'string' && m.startsWith('melious:'),
  )
  if (explicitMeliousUsed) {
    for (const [stage, provided, resolved] of [
      ['Triage', models.triage, triageModel],
      ['Haupt-LLM', models.main, mainModel],
      ['Safety', models.safety, safetyModel],
    ]) {
      if (!provided) {
        warnings.push(
          `Achtung: Für ${stage} wurde der Server-Default ${resolved} (OpenRouter, nicht EU) verwendet, obwohl die Pipeline sonst EU-Modelle nutzt.`,
        )
      }
    }
  }

  // Gesprächshistorie: letzte 8 Turns, bereinigt
  const dialog = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .slice(-8)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.text.slice(0, 1200) }))

  // 1. Triage — mit Dialogkontext, sonst ist „Erzähl weiter!" nicht klassifizierbar
  const contextBlock = dialog.length
    ? `Bisheriger Dialog (zuletzt):\n${dialog.slice(-4).map((m) => `${m.role === 'assistant' ? 'Begleiter' : 'Kind'}: "${m.text.slice(0, 160)}"`).join('\n')}\n\n`
    : ''
  // Cache nur für kontextfreie Erst-Turns; Eval-Läufe (noCache) messen die Kette, nie den Cache.
  const triageCacheKey = !noCache && dialog.length === 0
    ? `${triageModel}|${PROMPT_VERSION}|${ageBand}|${normalizeUtterance(utterance)}`
    : null
  let triage = null
  if (triageCacheKey && triageCache.has(triageCacheKey)) {
    cacheStats.triageHits += 1
    triage = triageCache.get(triageCacheKey)
    triageCache.delete(triageCacheKey)
    triageCache.set(triageCacheKey, triage) // LRU-Refresh: zuletzt genutzt nach hinten
    stages.push({
      key: 'triage', model: triageModel, ms: 0, tokens: null,
      status: triage.risiko || triage.emotion ? 'risk' : 'ok',
      summary: `⚡ Cache-Hit · Intent: ${triage.intent} · Risiko: ${triage.risiko} · Emotion: ${triage.emotion} · Konfidenz: ${triage.konfidenz}`,
    })
  } else {
    cacheStats.triageMisses += 1
    const triageCall = await callModel({
      model: triageModel,
      system: TRIAGE_SYSTEM,
      user: `${contextBlock}Aktuelle Äußerung des Kindes (${ageBand} Jahre): "${utterance}"`,
      maxTokens: 200,
    })
    triage = parseJson(triageCall.text)
    if (!triage) {
      stages.push({
        key: 'triage', model: triageModel, ms: triageCall.ms, tokens: triageCall.tokens,
        status: 'risk', summary: `Kein parsbares JSON: "${triageCall.text.slice(0, 80)}" → fail-closed: sensibel`,
      })
    } else {
      stages.push({
        key: 'triage', model: triageModel, ms: triageCall.ms, tokens: triageCall.tokens,
        status: triage.risiko || triage.emotion ? 'risk' : 'ok',
        summary: `Intent: ${triage.intent} · Risiko: ${triage.risiko} · Emotion: ${triage.emotion} · Konfidenz: ${triage.konfidenz} — ${triage.begruendung ?? ''}`,
      })
      // Nur parsebare Ergebnisse cachen — Fehlerzustände nie konservieren
      if (triageCacheKey) {
        triageCache.set(triageCacheKey, triage)
        if (triageCache.size > TRIAGE_CACHE_MAX) {
          triageCache.delete(triageCache.keys().next().value) // ältester Eintrag raus (LRU)
        }
      }
    }
  }

  // Erfolgssignal: Hat das Kind die zuletzt gestellte Aufgabe beantwortet?
  // Deterministische Prüfung (Ziffer/Zahlwort) — kein LLM-Urteil. Einmalig, dann verfällt die Erwartung.
  const learner = learnerStates.get(sessionId) ?? emptyLearnerState()
  const pending = learner.pendingExpectation ?? null
  learner.pendingExpectation = null
  let outcome = null
  if (pending && typeof pending.expected === 'number') {
    if (containsNumber(utterance, pending.expected)) {
      outcome = { type: 'richtig', expected: pending.expected, skill: pending.skill }
    } else {
      const said = firstNumber(utterance)
      if (said !== null) outcome = { type: 'falsch', expected: pending.expected, said, skill: pending.skill }
    }
    if (outcome) recordOutcome(learner, outcome.skill, outcome.type === 'richtig')
  }

  // 2. Deterministischer Router (fail-closed, wenn Triage unlesbar) — server/router.mjs.
  const decision = decideRoute({ triage, utterance, dialogLength: dialog.length, outcome })
  stages.push({
    key: 'router', model: null, ms: 1, tokens: null,
    status: decision === 'sensibel' ? 'risk' : decision === 'unklar' ? 'warn' : 'ok',
    summary: `Deterministische Entscheidung: „${decision}"${outcome ? ' (Antwort auf gestellte Aufgabe erkannt)' : ''}`,
  })

  let answer = ''
  let blocked = false

  if (decision === 'sensibel') {
    const isRisk = !triage || triage.risiko
    answer = isRisk ? SCRIPTED_RISK : SCRIPTED_EMOTION
    stages.push({
      key: 'script', model: null, ms: 1, tokens: null, status: 'warn',
      summary: `Kuratierte ${isRisk ? 'Risiko' : 'Emotions'}-Antwort — kein freies Generieren im sensiblen Pfad.`,
    })
  } else if (decision === 'unklar') {
    answer = SCRIPTED_CLARIFY
    stages.push({ key: 'script', model: null, ms: 1, tokens: null, status: 'warn', summary: 'Rückfrage statt Rateversuch.' })
  } else {
    // Antwort-Cache: Der Key trägt ALLES, was die Antwort beeinflusst — Modelle, System-Prompt,
    // Safety-Config, Altersband. Ein Prompt-Edit ändert den Key und invalidiert damit von selbst.
    const answerCacheable =
      !noCache && dialog.length === 0 && !outcome && (triage?.intent === 'wissensfrage' || triage?.intent === 'smalltalk')
    const answerKey = answerCacheable
      ? createHash('sha256')
          .update([mainModel, safetyModel, systemPrompt || 'default', blockPatterns, ageBand, PROMPT_VERSION].join('|'))
          .digest('hex')
          .slice(0, 16) + '|' + normalizeUtterance(utterance)
      : null

    if (answerKey && answerCache.has(answerKey)) {
      cacheStats.answerHits += 1
      const cached = answerCache.get(answerKey)
      answerCache.delete(answerKey)
      answerCache.set(answerKey, cached) // LRU-Refresh
      answer = cached.answer
      stages.push({
        key: 'main', model: mainModel, ms: 0, tokens: null, status: 'ok',
        summary: '⚡ Antwort-Cache-Hit — Prompt-Assembly, Haupt-LLM und Safety übersprungen (Antwort wurde bereits geprüft ausgeliefert).',
      })
      const totalMs = stages.reduce((sum, s) => sum + s.ms, 0)
      stages.push({
        key: 'final', model: null, ms: 0, tokens: null, status: 'ok',
        summary: `Gesamt: ${totalMs} ms (goldene Antwort aus dem Cache) · Prompt-Version ${PROMPT_VERSION}`,
      })
      setLearnerState(sessionId, learner)
      return { ok: true, decision, answer, blocked: false, totalMs, stages, warnings }
    }
    if (answerKey) cacheStats.answerMisses += 1

    // 3. Teaching Planner — Erfolgssignal hat Vorrang, sonst normale Strategie-Wahl bei Lernfragen
    let plannerDirective = ''
    if (plannerEnabled && outcome) {
      plannerDirective = outcomeDirective(outcome)
      const s = learner.skills[outcome.skill]
      stages.push({
        key: 'planner', model: null, ms: 1, tokens: null,
        status: outcome.type === 'richtig' ? 'ok' : 'warn',
        summary: outcome.type === 'richtig'
          ? `✓ Erfolgssignal: Kind hat „${outcome.expected}" selbst gelöst (deterministisch geprüft) · ${s?.successes ?? 0} Erfolge${s?.mastered ? ' · Skill gefestigt' : ''}`
          : `✗ Fehlversuch: Kind sagte ${outcome.said}, richtig wäre ${outcome.expected} · sanfte Korrektur, ${s?.consecutiveFrustrations ?? 0}. Fehlversuch in Folge`,
      })
    } else if (plannerEnabled && triage?.intent === 'lernen') {
      const skill = detectSkill(utterance)
      const frustration = detectFrustration(utterance)
      const plan = planStrategy({ ageBand, skill, state: learner, frustration })
      recordExposure(learner, skill, frustration)
      plannerDirective = directiveFor(plan)
      const exposures = skill ? learner.skills[skill].exposures : 0
      stages.push({
        key: 'planner', model: null, ms: 1, tokens: null, status: 'ok',
        summary: `Skill: ${skill ?? '—'} (${exposures}. Kontakt) · Strategie: ${plan.strategie} — ${plan.begruendung}`,
      })
    }

    // 4. System-Prompt zusammensetzen — Prompt-Knoten (sonst Server-Default) + Planner-Direktive
    const customPrompt = typeof systemPrompt === 'string' && systemPrompt.trim().length > 0
    const effectivePrompt = (customPrompt
      ? systemPrompt.replaceAll('{alter}', ageBand)
      : MAIN_SYSTEM(ageBand)) + plannerDirective
    stages.push({
      key: 'prompt', model: null, ms: 1, tokens: null, status: 'ok',
      summary: customPrompt
        ? `System-Prompt aus dem Prompt-Knoten (${effectivePrompt.length} Zeichen), Altersband ${ageBand} eingesetzt.`
        : `Server-Default-Prompt (kein Prompt-Knoten mit Inhalt gefunden), Altersband ${ageBand}.`,
    })

    // 5. Haupt-LLM — mit Gesprächshistorie
    const mainCall = await callModel({
      model: mainModel,
      system: effectivePrompt,
      user: utterance,
      history: dialog,
      maxTokens: 400,
    })
    answer = mainCall.text
    stages.push({
      key: 'main', model: mainModel, ms: mainCall.ms, tokens: mainCall.tokens,
      status: 'ok', summary: `Antwortentwurf: „${answer.slice(0, 100)}${answer.length > 100 ? '…' : ''}"`,
    })

    // 4a. Deterministische Pattern-Schicht
    const patterns = splitList(blockPatterns)
    const hits = patterns.filter((p) => answer.toLowerCase().includes(p))
    if (hits.length > 0) {
      blocked = true
      stages.push({ key: 'safety', model: null, ms: 1, tokens: null, status: 'risk', summary: `Pattern-Treffer (${hits.join(', ')}) → blockiert.` })
    } else {
      // 4b. Safety-Modell
      const safetyCall = await callModel({
        model: safetyModel,
        system: SAFETY_SYSTEM,
        user: `Frage des Kindes (${ageBand} Jahre): "${utterance}"\n\nGeplante Antwort: "${answer}"`,
        maxTokens: 200,
      })
      const verdict = parseJson(safetyCall.text)
      if (!verdict || verdict.freigabe !== true) {
        blocked = true
        stages.push({
          key: 'safety', model: safetyModel, ms: safetyCall.ms, tokens: safetyCall.tokens,
          status: 'risk',
          summary: verdict
            ? `Blockiert (${verdict.kategorie}): ${verdict.begruendung ?? ''}`
            : `Kein parsbares Urteil → fail-closed blockiert.`,
        })
      } else {
        stages.push({
          key: 'safety', model: safetyModel, ms: safetyCall.ms, tokens: safetyCall.tokens,
          status: 'ok', summary: `Freigegeben (${verdict.kategorie}). ${verdict.begruendung ?? ''}`,
        })
      }
    }
    if (blocked) {
      answer = SCRIPTED_FALLBACK
      stages.push({ key: 'fallback', model: null, ms: 1, tokens: null, status: 'warn', summary: 'Kuratierte Ersatzantwort ausgespielt (fail-closed).' })
    }

    // Antwort-Cache befüllen — NUR nach bestandener Safety-Prüfung (Cache konserviert Freigaben)
    if (answerKey && !blocked) {
      answerCache.set(answerKey, { answer })
      if (answerCache.size > ANSWER_CACHE_MAX) {
        answerCache.delete(answerCache.keys().next().value)
      }
    }

    // 6. Neue Erwartung merken: Welche Aufgabe wurde dem Kind gerade gestellt?
    // Vorrang hat die vom Begleiter NEU gestellte Aufgabe, sonst die Frage des Kindes selbst.
    if (plannerEnabled && !blocked && (triage?.intent === 'lernen' || outcome)) {
      const skill = detectSkill(utterance) ?? outcome?.skill ?? 'mathe.grundrechnen'
      const expected = extractExpectedAnswer(answer) ?? (triage?.intent === 'lernen' ? extractExpectedAnswer(utterance) : null)
      if (expected !== null) {
        learner.pendingExpectation = { skill, expected }
        stages[stages.length - 1] && stages.push({
          key: 'planner', model: null, ms: 0, tokens: null, status: 'ok',
          summary: `Erwartung gemerkt: nächste Kindesantwort wird deterministisch gegen „${expected}" geprüft.`,
        })
      }
    }
  }
  setLearnerState(sessionId, learner)

  const totalMs = stages.reduce((sum, s) => sum + s.ms, 0)
  stages.push({
    key: 'final', model: null, ms: 0, tokens: null,
    status: totalMs > 2500 ? 'risk' : totalMs > 1500 ? 'warn' : 'ok',
    summary: `Gesamt (nur Modellkette): ${totalMs} ms · Prompt-Version ${PROMPT_VERSION}`,
  })

  return { ok: true, decision, answer, blocked, totalMs, stages, warnings }
}

/* ------------------------------------------------------------------ */
/* HTTP-Server                                                         */
/* ------------------------------------------------------------------ */

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 8e6) reject(new Error('Body zu groß'))
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })

/** OpenRouter-Modellkatalog — öffentlich, kein Key nötig; 1 h In-Memory-Cache. */
let modelsCache = { at: 0, data: null }
async function loadModels() {
  if (modelsCache.data && Date.now() - modelsCache.at < 60 * 60 * 1000) return modelsCache.data
  // OpenRouter-Abruf darf den Melious-Katalog nicht mitreißen: schlägt er fehl (down, Rate-Limit),
  // trägt der EU-Katalog allein weiter — sonst hätte ein reiner EU-Betrieb gar keinen Modell-Katalog.
  let data = []
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models')
    if (!res.ok) throw new Error(`OpenRouter /models: HTTP ${res.status}`)
    const json = await res.json()
    data = (json.data ?? [])
      .filter((m) => (m.architecture?.output_modalities ?? ['text']).includes('text'))
      // Meta-Router (openrouter/auto etc.) haben Preis -1 — raus damit
      .filter((m) => Number(m.pricing?.prompt ?? 0) >= 0 && Number(m.pricing?.completion ?? 0) >= 0)
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        ctx: m.context_length ?? 0,
        in: Number(m.pricing?.prompt ?? 0) * 1e6,
        out: Number(m.pricing?.completion ?? 0) * 1e6,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  } catch {
    data = [] // OpenRouter nicht erreichbar — Melious-Merge unten läuft trotzdem
  }

  // Melious-Katalog (EU) dazu mergen — Probe auf OpenAI-konventionelles /v1/models;
  // scheitert die Probe (Endpoint nicht dokumentiert), fällt eine kuratierte Liste ein.
  const meliousKey = process.env.MELIOUS_API_KEY
  if (meliousKey) {
    let meliousModels = []
    try {
      const mres = await fetch('https://api.melious.ai/v1/models', {
        headers: { Authorization: `Bearer ${meliousKey}` },
        signal: AbortSignal.timeout(4000),
      })
      if (mres.ok) {
        const mjson = await mres.json()
        meliousModels = (mjson.data ?? []).map((m) => ({
          id: `melious:${m.id}`,
          name: `${m.name ?? m.id}`,
          ctx: m.context_length ?? 0,
          // Preis nur übernehmen, wenn der Katalog ihn liefert — sonst -1 = „unbekannt"
          in: m.pricing?.prompt != null ? Number(m.pricing.prompt) * 1e6 : -1,
          out: m.pricing?.completion != null ? Number(m.pricing.completion) * 1e6 : -1,
        }))
      }
    } catch {
      // Probe gescheitert → kuratierter Fallback (IDs beim ersten Live-Lauf verifiziert)
    }
    if (meliousModels.length === 0) {
      meliousModels = ['mistral-small-3.2-24b-instruct', 'qwen3-30b-a3b-instruct', 'deepseek-v3.2'].map((id) => ({
        id: `melious:${id}`, name: id, ctx: 0, in: -1, out: -1,
      }))
    }
    data.push(...meliousModels.sort((a, b) => a.id.localeCompare(b.id)))
  }

  modelsCache = { at: Date.now(), data }
  return data
}

/** Synthetisiert Text zu WAV (Base64) mit Cache — von /api/tts und der s2s-Kette genutzt. */
export async function synthesize(text) {
  const voiceId = TTS_URL
    ? `ext:${process.env.TTS_VOICE ?? 'default'}`
    : piperAvailable()
      ? `piper:${PIPER_VOICE}`
      : 'say:Anna'
  const ttsKey = createHash('sha256').update(`${voiceId}|${text}`).digest('hex')
  const cacheFile = join(TTS_CACHE_DIR, `${ttsKey}.wav`)
  if (existsSync(cacheFile)) {
    cacheStats.ttsHits += 1
    return { base64: (await readFile(cacheFile)).toString('base64'), engine: `⚡ Cache (${voiceId})`, cached: true }
  }
  cacheStats.ttsMisses += 1
  let audio
  let engine
  if (TTS_URL) {
    const ttsRes = await fetch(`${TTS_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts', input: text, voice: process.env.TTS_VOICE ?? 'default', response_format: 'wav' }),
    })
    if (!ttsRes.ok) throw new Error(`TTS-Endpoint HTTP ${ttsRes.status}`)
    audio = Buffer.from(await ttsRes.arrayBuffer())
    engine = 'extern (TTS_URL)'
  } else if (piperAvailable()) {
    const outFile = await runPiper(text)
    audio = await readFile(outFile)
    await unlink(outFile).catch(() => {})
    engine = `Piper ${PIPER_VOICE} (lokal, neuronal)`
  } else {
    const tmpFile = join(tmpdir(), `tts-${Date.now()}.wav`)
    await execFileAsync('say', ['-v', 'Anna', '-o', tmpFile, '--data-format=LEI16@22050', text])
    audio = await readFile(tmpFile)
    await unlink(tmpFile).catch(() => {})
    engine = 'macOS say „Anna" — Platzhalter'
  }
  await mkdir(TTS_CACHE_DIR, { recursive: true })
  await writeFile(cacheFile, audio).catch(() => {})
  return { base64: audio.toString('base64'), engine, cached: false }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  if (req.method === 'GET' && req.url === '/api/models') {
    try {
      const models = await loadModels()
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, models }))
    } catch (err) {
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: String(err.message ?? err), models: [] }),
      )
    }
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    let sttReady = false
    try {
      const ping = await fetch(STT_URL, { signal: AbortSignal.timeout(1500) })
      sttReady = ping.ok
    } catch {
      sttReady = false
    }
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        ok: true,
        hasKey: Boolean(providerConfig('openrouter').key),
        hasMeliousKey: Boolean(process.env.MELIOUS_API_KEY),
        promptVersion: PROMPT_VERSION,
        stt: sttReady ? 'whisper.cpp large-v3-turbo (lokal)' : null,
        tts: TTS_URL ? 'extern (TTS_URL)' : piperAvailable() ? `Piper ${PIPER_VOICE} (lokal)` : 'macOS say „Anna" (Platzhalter)',
        cache: cacheStats,
      }),
    )
  }

  if (req.method === 'GET' && req.url === '/api/testset') {
    // Testset fürs Prüfstand-UI — direkt aus dem Repo-File, damit UI und CLI dieselbe Wahrheit sehen.
    try {
      const raw = readFileSync(join(SERVER_DIR, 'testsets', 'safety.v1.json'), 'utf8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(raw)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Testset nicht lesbar' }))
    }
    return
  }

  // Speech-to-Text: Base64-WAV → lokaler whisper.cpp-Server
  if (req.method === 'POST' && req.url === '/api/stt') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}')
      if (!body.audio) {
        return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'audio (Base64-WAV) fehlt' }))
      }
      const started = performance.now()
      const wav = Buffer.from(body.audio, 'base64')
      const form = new FormData()
      form.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav')
      form.append('language', 'de')
      form.append('response_format', 'json')
      const sttRes = await fetch(`${STT_URL}/inference`, { method: 'POST', body: form })
      if (!sttRes.ok) throw new Error(`whisper-server HTTP ${sttRes.status}`)
      const data = await sttRes.json()
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          ok: true,
          text: String(data.text ?? '').trim(),
          ms: Math.round(performance.now() - started),
          engine: 'whisper.cpp large-v3-turbo (lokal, self-hosted)',
        }),
      )
    } catch (err) {
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: `STT nicht erreichbar (${String(err.message ?? err)}). Läuft \`npm run stt\`?` }),
      )
    }
  }

  // Auto-Judge: bewertet anonymisierte Antworten nach Rubrik, kürt einen Gewinner
  if (req.method === 'POST' && req.url === '/api/judge') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}')
      const answers = Array.isArray(body.answers) ? body.answers : []
      if (answers.length < 2) {
        return res.writeHead(400, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: 'Mindestens 2 Antworten nötig' }),
        )
      }
      const model = body.model || 'anthropic/claude-sonnet-4.6'
      // Key-Check erst hier, weil das Judge-Modell (und damit sein Provider) erst aus dem Body bekannt ist.
      const { providerId } = resolveProvider(model)
      if (!providerConfig(providerId).key) {
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: `Kein API-Key für Provider "${providerId}" gesetzt (${providerId === 'melious' ? 'MELIOUS_API_KEY' : 'OPENROUTER_API_KEY'} in .env).` }),
        )
      }
      const rubric = typeof body.rubric === 'string' && body.rubric.trim() ? body.rubric : DEFAULT_JUDGE_RUBRIC
      const block = answers
        .map((a) => `Antwort ${a.label}:\n"${String(a.text ?? '').slice(0, 800)}"`)
        .join('\n\n')
      const call = await callModel({
        model,
        system: rubric,
        user: `Kinderäußerung (${body.ageBand ?? '4-5'} Jahre): "${body.utterance ?? ''}"\n\n${block}`,
        maxTokens: 700,
      })
      const verdict = parseJson(call.text)
      if (!verdict) {
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: `Judge lieferte kein parsbares JSON: "${call.text.slice(0, 120)}"` }),
        )
      }
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: true, verdict, model, ms: call.ms, tokens: call.tokens }),
      )
    } catch (err) {
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: String(err.message ?? err) }),
      )
    }
  }

  // Text-to-Speech: Text → WAV (extern via TTS_URL oder macOS `say` als Platzhalter)
  if (req.method === 'POST' && req.url === '/api/tts') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}')
      const text = String(body.text ?? '').slice(0, 600)
      if (!text.trim()) {
        return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'text fehlt' }))
      }
      const started = performance.now()
      const { base64, engine, cached } = await synthesize(text)

      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: true, audio: base64, ms: Math.round(performance.now() - started), engine, cached }),
      )
    } catch (err) {
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: String(err.message ?? err) }),
      )
    }
  }

  if (req.method === 'POST' && req.url === '/api/run') {
    try {
      // Nicht auf OpenRouter fixieren: eine reine EU-Pipeline (nur melious:-Modelle) braucht
      // nur MELIOUS_API_KEY. Der per-Provider-Check pro Modell passiert ohnehin in callModel.
      if (!providerConfig('openrouter').key && !providerConfig('melious').key) {
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: 'Kein API-Key gesetzt. Lege eine .env mit OPENROUTER_API_KEY=sk-or-… und/oder MELIOUS_API_KEY=… ins Projektverzeichnis und starte `npm run dev` neu.' }),
        )
      }
      const body = JSON.parse((await readBody(req)) || '{}')
      if (!body.utterance || typeof body.utterance !== 'string') {
        return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'utterance fehlt' }))
      }
      const result = await runPipeline(body)
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result))
    } catch (err) {
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: String(err.message ?? err) }),
      )
    }
  }

  if (req.method === 'POST' && req.url === '/api/s2s') {
    // JSON.parse innerhalb des try: ein kaputter Body darf den Prozess nicht beenden
    // (unhandled exception vor dem writeHead) — alle anderen Endpunkte parsen genauso.
    let body
    try {
      body = JSON.parse((await readBody(req)) || '{}')
    } catch (err) {
      return res.writeHead(400, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: `Ungültiger Request-Body: ${String(err.message ?? err)}` }),
      )
    }
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' })
    // Client kann die Verbindung jederzeit kappen — danach nie mehr schreiben,
    // sonst erzeugt res.write() eine weitere unbehandelte Rejection.
    const sende = (ereignis) => {
      if (res.writableEnded) return
      res.write(`${JSON.stringify(ereignis)}\n`)
    }
    // Außerhalb des try deklariert, damit der Lernstand auch im Fehlerfall gesichert wird.
    const sessionId = String(body.sessionId ?? 's2s')
    const learner = learnerStates.get(sessionId) ?? emptyLearnerState()
    try {
      // STT zuerst — der Client schickt Audio, die Kette braucht Text
      sende({ type: 'stage', key: 'stt', status: 'aktiv' })
      const sttStart = Date.now()
      const form = new FormData()
      form.append('file', new Blob([Buffer.from(String(body.audio ?? ''), 'base64')], { type: 'audio/wav' }), 'audio.wav')
      form.append('response_format', 'json')
      const sttRes = await fetch(`${STT_URL}/inference`, { method: 'POST', body: form })
      if (!sttRes.ok) throw new Error(`STT HTTP ${sttRes.status} — läuft \`npm run stt\`?`)
      const utterance = String((await sttRes.json()).text ?? '').trim()
      sende({ type: 'stage', key: 'stt', status: utterance ? 'fertig' : 'fehler', ms: Date.now() - sttStart, detail: utterance || 'nichts verstanden' })
      sende({ type: 'transcript', text: utterance })
      if (!utterance) {
        const { base64 } = await synthesize(SCRIPTED_CLARIFY)
        sende({ type: 'text', chunk: SCRIPTED_CLARIFY, index: -1 })
        sende({ type: 'audio', wavBase64: base64, index: -1, kind: 'script' })
        sende({ type: 'done', totalMs: Date.now() - sttStart, decision: 'unklar' })
        return res.end()
      }

      await runS2S({ ...body, utterance, learner, openerIndex: (body.history?.length ?? 0) }, sende, synthesize)
      setLearnerState(sessionId, learner)
      return res.end()
    } catch (err) {
      sende({ type: 'abort', grund: String(err.message ?? err) })
      sende({ type: 'done', totalMs: 0, decision: 'fehler' })
      setLearnerState(sessionId, learner) // Lernstand nicht verlieren, auch wenn die Kette mittendrin abbricht
      return res.end()
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'Nicht gefunden' }))
})

// Kuratierte Sätze einmal vorsynthetisieren: Opener und Abbruch-Pivot sind damit
// im Cache und kosten zur Laufzeit keine Wartezeit.
for (const text of [...OPENER_TEXTE, SCRIPTED_PIVOT, SCRIPTED_RISK, SCRIPTED_EMOTION, SCRIPTED_CLARIFY]) {
  synthesize(text).catch((err) => console.warn(`Vorsynthese fehlgeschlagen: ${String(err.message ?? err)}`))
}

server.listen(PORT, () => {
  console.log(`[api] Live-Pipeline auf http://localhost:${PORT} · Key: ${providerConfig('openrouter').key ? 'vorhanden' : 'FEHLT (.env)'}`)
})
