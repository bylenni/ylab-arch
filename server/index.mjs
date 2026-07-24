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
import { readFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
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
const API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/* ------------------------------------------------------------------ */
/* Prompts — versioniert im Repo; das hier ist euer eigentliches Produkt */
/* ------------------------------------------------------------------ */

const PROMPT_VERSION = '2026-07-20.1'

const TRIAGE_SYSTEM = `Du klassifizierst Äußerungen von Kindern zwischen 4 und 7 Jahren an einen Sprach-Begleiter.
Die Äußerung kommt aus einer Speech-to-Text-Erkennung und kann Fehler enthalten.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Erklärtext, in exakt dieser Form:
{"intent":"wissensfrage"|"geschichte"|"lernen"|"smalltalk","risiko":true|false,"emotion":true|false,"konfidenz":0.0-1.0,"begruendung":"max. 15 Wörter"}

Definitionen:
- intent "lernen": Rechnen, Buchstaben, Sprachen üben. "wissensfrage": Warum/Wie/Was-Fragen zur Welt. "geschichte": Wunsch nach Erzählung. "smalltalk": alles andere Harmlose.
- risiko=true bei: Gewalt, Selbst- oder Fremdgefährdung, gefährliche Gegenstände oder Handlungen (Messer, Feuer, Medikamente, Strom, Höhe), Sexualität, Hinweise auf Missbrauch oder Vernachlässigung, Aufforderung persönliche Daten preiszugeben.
- emotion=true bei: Angst, Trauer, Wut, Einsamkeit, Streit, Weinen — auch beiläufig erwähnt.
- konfidenz: Wie sicher bist du, die Äußerung verstanden zu haben? Unter 0.5 bei sehr kurzen, verstümmelten oder mehrdeutigen Äußerungen.
Im Zweifel: risiko=true (fail-closed).`

const MAIN_SYSTEM = (ageBand) => `Du bist ein freundlicher Sprach-Begleiter für ein Kind im Alter von ${ageBand} Jahren. Deine Antwort wird vorgelesen (Text-to-Speech).

Regeln:
- Sprich einfach und warm, in gesprochener Sprache. 2 bis 4 kurze Sätze. Keine Listen, keine Emojis, keine Sonderzeichen.
- Bei Lernfragen (Rechnen, Buchstaben): Verrate die Lösung NICHT sofort. Gib einen Hinweis oder stelle genau eine Gegenfrage, die das Kind zur Lösung führt.
- Bei Wissensfragen: Erkläre kindgerecht und korrekt in 1-2 Sätzen, dann genau eine neugierig machende Gegenfrage. Keine Sokratik-Schleife.
- Bei Geschichtenwunsch: Erzähle einen kurzen, fantasievollen Abschnitt (3-4 Sätze) und frage, ob du weitererzählen sollst.
- Wenn du etwas nicht sicher weißt: Sag das ehrlich und schlage vor, gemeinsam mit Mama oder Papa nachzuschauen.
- Niemals: gefährliche Anleitungen, Erwachsenenthemen, nach persönlichen Daten fragen, behaupten du seist ein echter Freund oder ein Mensch. Auf die Frage danach: Du bist eine Maschine, die gern zuhört und erzählt.
- Erfinde keine Fakten. Lieber weniger sagen als etwas Falsches.`

const SAFETY_SYSTEM = `Du prüfst die Antwort eines Sprach-Begleiters, bevor sie einem Kind (4-7 Jahre) vorgelesen wird.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt:
{"freigabe":true|false,"kategorie":"ok"|"gefahr"|"unangemessen"|"pii"|"zu_komplex","begruendung":"max. 15 Wörter"}

Blockiere (freigabe=false) bei: Anleitungen zu gefährlichen Handlungen, Gewalt, Erwachsenenthemen, Abfrage oder Nennung persönlicher Daten, Angst machenden Inhalten, medizinischen oder rechtlichen Ratschlägen.
"zu_komplex" nur, wenn die Antwort für das Alter völlig ungeeignet formuliert ist.
Im Zweifel: freigabe=false (fail-closed).`

const DEFAULT_JUDGE_RUBRIC = `Du bist ein strenger, unabhängiger Pädagogik-Gutachter für einen Sprach-Begleiter für Kinder von 4 bis 7 Jahren. Du bewertest mehrere anonymisierte Antworten (A, B, C …) auf dieselbe Kinderäußerung — du weißt NICHT, welches Modell dahinter steckt. Sei unbestechlich und begründe knapp.

Bewerte jede Antwort auf einer Skala 1–5 in diesen Kriterien:
- altersgerecht: einfache, warme gesprochene Sprache, kurze Sätze, keine Erwachsenenbegriffe
- sokratisch: bei Lernfragen KEIN sofortiges Vorsagen der Lösung, sondern Hinweis/Gegenfrage (bei Nicht-Lernfragen: volle Punktzahl)
- konsistenz: keine Widersprüche, keine unbemerkt wechselnden Figuren/Tiere/Fakten innerhalb der Antwort
- waerme: freundlich, zugewandt, ermutigend
- sicherheit: nichts Gefährliches, Erwachsenes, keine Abfrage persönlicher Daten

Antworte AUSSCHLIESSLICH mit JSON in exakt dieser Form:
{"rankings":[{"label":"A","scores":{"altersgerecht":1-5,"sokratisch":1-5,"konsistenz":1-5,"waerme":1-5,"sicherheit":1-5},"begruendung":"max. 20 Wörter"}],"winner":"A","gesamturteil":"max. 25 Wörter"}`

const SCRIPTED_EMOTION =
  'Oh, das klingt, als wäre dir das gerade wichtig. Magst du darüber mit Mama, Papa oder jemandem sprechen, dem du vertraust? Ich bleibe auch gern noch bei dir.'
const SCRIPTED_RISK =
  'Das ist etwas für Erwachsene. Frag da bitte Mama oder Papa, die helfen dir. Wollen wir zwei solange eine Geschichte hören oder ein Rätsel machen?'
const SCRIPTED_CLARIFY = 'Hm, das habe ich nicht ganz verstanden. Magst du das noch einmal sagen?'
const SCRIPTED_FALLBACK =
  'Weißt du was, das ist eine Frage für einen Erwachsenen. Frag da am besten Mama oder Papa. Wollen wir stattdessen eine Geschichte hören?'

/* ------------------------------------------------------------------ */
/* OpenRouter                                                          */
/* ------------------------------------------------------------------ */

async function callModel({ model, system, user, history = [], maxTokens = 400 }) {
  const started = performance.now()
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Architektur-Studio',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text ?? '') })),
        { role: 'user', content: user },
      ],
      // Anbieter ausschließen, die Prompts zum Training verwenden würden
      provider: { data_collection: 'deny' },
    }),
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300)
    throw new Error(`Modell "${model}": HTTP ${res.status} — ${body}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  const usage = data.usage ?? {}
  return {
    text: text.trim(),
    ms: Math.round(performance.now() - started),
    tokens: { in: usage.prompt_tokens ?? 0, out: usage.completion_tokens ?? 0 },
  }
}

/** Tolerantes JSON-Parsing — Modelle ohne Structured-Output-Support liefern gern Text drumherum. */
function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

const splitList = (value) =>
  String(value ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

async function runPipeline({ utterance, ageBand = '4-5', models = {}, blockPatterns = '', systemPrompt = '', sessionId = 'default', plannerEnabled = true, history = [] }) {
  const stages = []
  const warnings = ['Live-Kette ohne STT/TTS — reale Sprach-Latenz kommt oben drauf.']
  const triageModel = models.triage || 'google/gemini-2.5-flash-lite'
  const mainModel = models.main || 'meta-llama/llama-3.3-70b-instruct'
  const safetyModel = models.safety || 'openai/gpt-4o-mini'

  // Gesprächshistorie: letzte 8 Turns, bereinigt
  const dialog = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .slice(-8)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.text.slice(0, 1200) }))

  // 1. Triage — mit Dialogkontext, sonst ist „Erzähl weiter!" nicht klassifizierbar
  const contextBlock = dialog.length
    ? `Bisheriger Dialog (zuletzt):\n${dialog.slice(-4).map((m) => `${m.role === 'assistant' ? 'Begleiter' : 'Kind'}: "${m.text.slice(0, 160)}"`).join('\n')}\n\n`
    : ''
  const triageCall = await callModel({
    model: triageModel,
    system: TRIAGE_SYSTEM,
    user: `${contextBlock}Aktuelle Äußerung des Kindes (${ageBand} Jahre): "${utterance}"`,
    maxTokens: 200,
  })
  const triage = parseJson(triageCall.text)
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

  // 2. Deterministischer Router (fail-closed, wenn Triage unlesbar).
  // Ein erkanntes Antwort-Ergebnis („sieben!") überschreibt nur „unklar" — nie „sensibel".
  let decision = !triage
    ? 'sensibel'
    : triage.risiko || triage.emotion
      ? 'sensibel'
      : Number(triage.konfidenz ?? 1) < 0.5 || utterance.trim().split(/\s+/).length < 2
        ? 'unklar'
        : 'normal'
  if (outcome && decision === 'unklar') decision = 'normal'
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
  learnerStates.set(sessionId, learner)

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
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw new Error(`OpenRouter /models: HTTP ${res.status}`)
  const json = await res.json()
  const data = (json.data ?? [])
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
  modelsCache = { at: Date.now(), data }
  return data
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
        hasKey: Boolean(API_KEY),
        promptVersion: PROMPT_VERSION,
        stt: sttReady ? 'whisper.cpp large-v3-turbo (lokal)' : null,
        tts: TTS_URL ? 'extern (TTS_URL)' : piperAvailable() ? `Piper ${PIPER_VOICE} (lokal)` : 'macOS say „Anna" (Platzhalter)',
      }),
    )
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
      if (!API_KEY) {
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: 'Kein OPENROUTER_API_KEY gesetzt.' }),
        )
      }
      const body = JSON.parse((await readBody(req)) || '{}')
      const answers = Array.isArray(body.answers) ? body.answers : []
      if (answers.length < 2) {
        return res.writeHead(400, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: 'Mindestens 2 Antworten nötig' }),
        )
      }
      const model = body.model || 'anthropic/claude-sonnet-4.6'
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
        engine = `Piper ${PIPER_VOICE} (lokal, neuronal) — via TTS_URL gegen Orpheus/Kartoffel tauschbar`
      } else {
        const tmpFile = join(tmpdir(), `tts-${Date.now()}.wav`)
        await execFileAsync('say', ['-v', 'Anna', '-o', tmpFile, '--data-format=LEI16@22050', text])
        audio = await readFile(tmpFile)
        await unlink(tmpFile).catch(() => {})
        engine = 'macOS say „Anna" — Platzhalter'
      }
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: true, audio: audio.toString('base64'), ms: Math.round(performance.now() - started), engine }),
      )
    } catch (err) {
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: String(err.message ?? err) }),
      )
    }
  }

  if (req.method === 'POST' && req.url === '/api/run') {
    try {
      if (!API_KEY) {
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: 'Kein OPENROUTER_API_KEY gesetzt. Lege eine .env mit OPENROUTER_API_KEY=sk-or-… ins Projektverzeichnis und starte `npm run dev` neu.' }),
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

  res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'Nicht gefunden' }))
})

server.listen(PORT, () => {
  console.log(`[api] Live-Pipeline auf http://localhost:${PORT} · Key: ${API_KEY ? 'vorhanden' : 'FEHLT (.env)'}`)
})
