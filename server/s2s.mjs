/**
 * Speech-to-Speech-Kette: STT → Triage → Router → Planner → LLM (streamend)
 * → Chunker → Safety-Gate → TTS pro Chunk.
 *
 * Architektur-Muster nach huggingface/speech-to-speech: die Stufen sind entkoppelt,
 * gesprochen wird bereits, während weiter generiert wird. Anders als dort bleibt
 * unsere Prüfkette vollständig — die gestaffelte Freigabe (Opener → Guard auf Chunk 1
 * → Vollprüfung für den Rest) sorgt dafür, dass NIE Ungeprüftes hörbar wird.
 */
import { createChunker, createGate } from './s2sCore.mjs'
import { callModel, callModelStream, parseJson } from './llm.mjs'
import { decideRoute } from './router.mjs'
import {
  PROMPT_VERSION, TRIAGE_SYSTEM, MAIN_SYSTEM, SAFETY_SYSTEM,
  SCRIPTED_EMOTION, SCRIPTED_RISK, SCRIPTED_CLARIFY, SCRIPTED_PIVOT, OPENER_TEXTE,
} from './prompts.mjs'
import { planStrategy, detectSkill, detectFrustration, recordExposure, directiveFor } from './teachingPlanner.mjs'

/** Ein zufälliger Opener — vorsynthetisiert, deshalb ohne Wartezeit. */
const zufallsOpener = (index) => OPENER_TEXTE[index % OPENER_TEXTE.length]

/**
 * @param {object} opt  utterance, ageBand, models, systemPrompt, blockPatterns, history, learner, openerIndex
 * @param {(ereignis: object) => void} sende  schreibt ein NDJSON-Ereignis
 * @param {(text: string) => Promise<{base64: string}>} synthesize  TTS
 */
export async function runS2S(opt, sende, synthesize) {
  const {
    utterance, ageBand = '4-5', models = {}, systemPrompt = '', blockPatterns = '',
    history = [], learner = null, openerIndex = 0,
  } = opt
  const started = Date.now()
  const triageModel = models.triage || 'google/gemini-2.5-flash-lite'
  const mainModel = models.main || 'google/gemini-2.5-flash'
  const safetyModel = models.safety || 'openai/gpt-4o-mini'
  const dialog = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .slice(-8)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.text.slice(0, 1200) }))

  const gate = createGate()
  let chunkIndex = 0

  // `done` ist terminal: Task 4 darf sich darauf verlassen, dass danach nichts mehr
  // kommt. Einmalig egal auf welchem Pfad (Erfolg oder Abbruch).
  let doneGesendet = false
  const sendeDone = (payload) => {
    if (doneGesendet) return
    doneGesendet = true
    sende({ type: 'done', totalMs: Date.now() - started, ...payload })
  }

  /** Spielt kuratierten (vorab genehmigten) Text aus — Opener, Skript, Pivot. */
  const sendeKuratiert = async (text, kind) => {
    const { base64 } = await synthesize(text)
    sende({ type: 'text', chunk: text, index: -1 })
    sende({ type: 'audio', wavBase64: base64, index: -1, kind })
  }

  /** Bricht ab: kein weiterer Antwort-Chunk, Pivot als letztes Wort.
   *  Idempotent UND wartbar: ein zweiter Aufruf (z. B. ein Pattern-Treffer, während
   *  zeitgleich `callModelStream` wirft und der äußere catch ebenfalls abbrechen()
   *  ruft) bekommt dasselbe Promise zurück, statt sofort mit `undefined`
   *  zurückzukehren. Ein reines Flag genügt hier NICHT: kehrt der zweite Aufruf sofort
   *  zurück, während der erste noch auf die Pivot-TTS wartet, endet `runS2S` (und damit
   *  `res.end()` im Handler) BEVOR der erste Aufruf sein Pivot-Audio/`done` gesendet
   *  hat — der Client bekäme `abort` ohne Pivot und ohne `done` und würde bis zum
   *  Socket-Close warten. Deshalb: `abbrechen` gibt immer dasselbe laufende Promise
   *  zurück, jedes `await abbrechen(...)` wartet also auf die EINE tatsächliche
   *  Abbruch-Abwicklung. */
  let abbruchPromise = null
  const abbrechen = (grund) => (abbruchPromise ??= (async () => {
    gate.reject(grund)
    sende({ type: 'abort', grund })
    await sendeKuratiert(SCRIPTED_PIVOT, 'pivot')
    sendeDone({ decision: 'abgebrochen' })
  })())

  try {
    // 1. Opener — überbrückt die Denkzeit, inhaltlich leer, null Risiko
    sende({ type: 'stage', key: 'opener', status: 'aktiv' })
    await sendeKuratiert(zufallsOpener(openerIndex), 'opener')
    sende({ type: 'stage', key: 'opener', status: 'fertig', ms: Date.now() - started })

    // 2. Triage
    const triageStart = Date.now()
    sende({ type: 'stage', key: 'triage', status: 'aktiv', model: triageModel })
    const kontext = dialog.length
      ? `Bisheriger Dialog (zuletzt):\n${dialog.slice(-4).map((m) => `${m.role === 'assistant' ? 'Begleiter' : 'Kind'}: "${m.text.slice(0, 160)}"`).join('\n')}\n\n`
      : ''
    const triageCall = await callModel({
      model: triageModel, system: TRIAGE_SYSTEM,
      user: `${kontext}Aktuelle Äußerung des Kindes (${ageBand} Jahre): "${utterance}"`, maxTokens: 200,
    })
    const triage = parseJson(triageCall.text)
    sende({
      type: 'stage', key: 'triage', status: triage ? 'fertig' : 'fehler', ms: Date.now() - triageStart,
      model: triageModel,
      detail: triage ? `Intent: ${triage.intent} · Risiko: ${triage.risiko} · Emotion: ${triage.emotion}` : 'Kein parsbares JSON → fail-closed',
    })

    // 3. Router
    sende({ type: 'stage', key: 'router', status: 'aktiv' })
    const decision = decideRoute({ triage, utterance, dialogLength: dialog.length, outcome: null })
    sende({ type: 'stage', key: 'router', status: 'fertig', ms: 1, detail: `Entscheidung: „${decision}"` })

    // Sensibler und unklarer Pfad: kuratierte Antwort, kein freies Generieren
    if (decision !== 'normal') {
      const text = decision === 'unklar' ? SCRIPTED_CLARIFY : (!triage || triage.risiko) ? SCRIPTED_RISK : SCRIPTED_EMOTION
      sende({ type: 'stage', key: 'script', status: 'aktiv' })
      await sendeKuratiert(text, 'script')
      sende({ type: 'stage', key: 'script', status: 'fertig', ms: 1, detail: 'Kuratierte Antwort (vorsynthetisiert)' })
      sendeDone({ decision })
      return
    }

    // 4. Teaching Planner
    let direktive = ''
    if (learner && triage?.intent === 'lernen') {
      sende({ type: 'stage', key: 'planner', status: 'aktiv' })
      const skill = detectSkill(utterance)
      const frust = detectFrustration(utterance)
      const plan = planStrategy({ ageBand, skill, state: learner, frustration: frust })
      recordExposure(learner, skill, frust)
      direktive = directiveFor(plan)
      sende({ type: 'stage', key: 'planner', status: 'fertig', ms: 1, detail: `Strategie: ${plan.strategie}` })
    }

    const effektiverPrompt =
      (systemPrompt?.trim() ? systemPrompt.replaceAll('{alter}', ageBand) : MAIN_SYSTEM(ageBand)) + direktive
    const muster = String(blockPatterns ?? '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean)

    // 5. LLM streamend + Chunker + gestaffelte Freigabe
    sende({ type: 'stage', key: 'main', status: 'aktiv', model: mainModel })
    const chunker = createChunker()
    const wartende = []        // Chunks, die auf die Vollprüfung warten

    // Reine Serialisierungskette: garantiert Feed-Reihenfolge (Index == Textposition)
    // UND dass niemals ein Promise unbehandelt rejected — jeder Link fängt seinen
    // eigenen Fehler ab und schickt ihn in den Abbruchpfad, statt den Prozess mit
    // einer unhandled rejection zu beenden.
    // WICHTIG: diese Variable NIE mit einem anderen Promise (z. B. einem Modellaufruf)
    // überschreiben. Genau das war der Bug: ein überschriebener Kettenkopf lässt
    // spätere Sätze an der falschen Stelle andocken (Index/Text vertauscht) UND macht
    // das eigentliche Kettenglied zu einer verwaisten, nie awaiteten Promise.
    let kette = null
    const anKette = (fn) => {
      kette = (kette ?? Promise.resolve())
        .then(fn)
        .catch((err) => abbrechen(String(err?.message ?? err)).catch(() => {}))
    }

    /** Schickt einen freigegebenen Antwort-Chunk als Text + Audio.
     *  Freigabe wird NACH der TTS-Synthese erneut geprüft: ein Abbruch kann während
     *  der (asynchronen) Synthese eintreffen — dann darf trotzdem nichts mehr raus. */
    const sendeChunk = async (satz, index) => {
      if (!gate.mayEmit(index)) return
      const { base64 } = await synthesize(satz)
      if (!gate.mayEmit(index)) return
      sende({ type: 'text', chunk: satz, index })
      sende({ type: 'audio', wavBase64: base64, index, kind: 'answer' })
    }

    const verarbeite = async (satz) => {
      if (gate.status === 'abgebrochen') return
      const index = chunkIndex
      chunkIndex += 1

      // Pattern-Schicht: deterministisch, sofort, gilt für JEDEN Chunk
      const treffer = muster.filter((p) => satz.toLowerCase().includes(p))
      if (treffer.length > 0) {
        await abbrechen(`Pattern-Treffer (${treffer.join(', ')})`)
        return
      }

      if (index === 0) {
        // Erster Satz: ein Guard-Call auf dem kumulativen Präfix inkl. Kinderfrage.
        // Eigene lokale Variable — NICHT `kette` wiederverwenden (siehe Kommentar oben).
        const guardStart = Date.now()
        sende({ type: 'stage', key: 'guard', status: 'aktiv', model: safetyModel })
        const guardCall = callModel({
          model: safetyModel, system: SAFETY_SYSTEM,
          user: `Frage des Kindes (${ageBand} Jahre): "${utterance}"\n\nBisher geplanter Antwortanfang: "${satz}"`,
          maxTokens: 200,
        })
        const urteil = parseJson((await guardCall).text)
        const frei = urteil?.freigabe === true
        sende({
          type: 'stage', key: 'guard', status: frei ? 'fertig' : 'fehler', ms: Date.now() - guardStart,
          model: safetyModel,
          detail: frei ? 'Erster Satz freigegeben' : 'Erster Satz blockiert → Abbruch',
        })
        if (!frei) {
          await abbrechen('Guard hat den ersten Satz nicht freigegeben')
          return
        }
        gate.approveFirst()
        await sendeChunk(satz, index)
        return
      }

      // Ab Chunk 2: erst nach bestandener Vollprüfung
      if (gate.mayEmit(index)) {
        await sendeChunk(satz, index)
      } else {
        wartende.push({ satz, index })
      }
    }

    const { text: gesamt, ms, tokens } = await callModelStream({
      model: mainModel, system: effektiverPrompt, user: utterance, history: dialog, maxTokens: 400,
      onDelta: (delta) => {
        for (const satz of chunker.feed(delta)) {
          // seriell abarbeiten, damit Reihenfolge und Index stimmen
          anKette(() => verarbeite(satz))
        }
      },
    })
    const rest = chunker.flush()
    anKette(() => (rest ? verarbeite(rest) : undefined))
    await kette
    if (gate.status === 'abgebrochen') return
    sende({ type: 'stage', key: 'main', status: 'fertig', ms, model: mainModel, detail: `${tokens.out} Tokens generiert` })

    // 6. Vollprüfung der Gesamtantwort — gibt alle restlichen Chunks frei
    const safetyStart = Date.now()
    sende({ type: 'stage', key: 'safety', status: 'aktiv', model: safetyModel })
    const safetyCall = await callModel({
      model: safetyModel, system: SAFETY_SYSTEM,
      user: `Frage des Kindes (${ageBand} Jahre): "${utterance}"\n\nGeplante Antwort: "${gesamt}"`, maxTokens: 200,
    })
    const urteil = parseJson(safetyCall.text)
    const freigegeben = urteil?.freigabe === true
    sende({
      type: 'stage', key: 'safety', status: freigegeben ? 'fertig' : 'fehler', ms: Date.now() - safetyStart,
      model: safetyModel,
      detail: freigegeben ? `Freigegeben (${urteil.kategorie})` : `Blockiert (${urteil?.kategorie ?? 'unparsbar'}) → Abbruch`,
    })
    if (!freigegeben) {
      await abbrechen('Vollprüfung der Gesamtantwort hat blockiert')
      return
    }
    // Pattern-Schicht zusätzlich auf die GESAMTANTWORT: `verarbeite()` prüft nur den
    // einzelnen Satz, ein mehrwortiges Blockmuster über eine Satzgrenze hinweg würde
    // dort nie zuschlagen. runPipeline (der Text-Zwilling) prüft die volle Antwort —
    // ohne diesen Schritt würde genau hier eine Sicherheitslücke zwischen den beiden
    // Endpunkten entstehen.
    const gesamtTreffer = muster.filter((p) => gesamt.toLowerCase().includes(p))
    if (gesamtTreffer.length > 0) {
      await abbrechen(`Pattern-Treffer in Gesamtantwort (${gesamtTreffer.join(', ')})`)
      return
    }
    gate.approveFull()
    for (const { satz, index } of wartende) {
      if (gate.status === 'abgebrochen') break
      await sendeChunk(satz, index)
    }
    sendeDone({ decision, promptVersion: PROMPT_VERSION })
  } catch (err) {
    // Jeder unerwartete Fehler (Stream abgerissen, TTS kaputt, kein Key) endet fail-closed
    await abbrechen(String(err.message ?? err)).catch(() => {})
  }
}
