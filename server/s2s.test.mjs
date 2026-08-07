// Tests für die sicherheitskritische Verdrahtung der Speech-to-Speech-Kette (runS2S).
// `llm.mjs` wird komplett gemockt: `callModel` bedient Triage/Guard/Vollprüfung (an der
// `user`-Signatur unterschieden, weil Guard und Vollprüfung dasselbe System-Prompt nutzen),
// `callModelStream` treibt den Chunker per vorgegebenen Text-Deltas — genau das, was die
// Spec als "einfacher Fake" vorschlägt, statt SSE-Parsing zu mocken.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./llm.mjs', () => ({
  callModel: vi.fn(),
  callModelStream: vi.fn(),
  parseJson: (text) => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  },
}))

const { callModel, callModelStream } = await import('./llm.mjs')
const { runS2S } = await import('./s2s.mjs')

const triageOk = { intent: 'wissensfrage', risiko: false, emotion: false, konfidenz: 0.9 }

/** Baut einen `callModel`-Fake: Triage bekommt `triageJson`, Guard (Chunk 1) `guardText`,
 *  Vollprüfung `safetyText` — unterschieden über die `user`-Marker aus s2s.mjs selbst. */
function mockCallModel({ triageJson = triageOk, guardText, safetyText }) {
  callModel.mockImplementation(async ({ user }) => {
    if (user.includes('Bisher geplanter Antwortanfang')) {
      return { text: guardText, ms: 5, tokens: { in: 1, out: 1 } }
    }
    if (user.includes('Geplante Antwort')) {
      return { text: safetyText ?? JSON.stringify({ freigabe: true, kategorie: 'ok' }), ms: 5, tokens: { in: 1, out: 1 } }
    }
    return { text: JSON.stringify(triageJson), ms: 5, tokens: { in: 1, out: 1 } }
  })
}

/** Baut einen `callModelStream`-Fake: liefert `text` per einmaligem `onDelta`-Aufruf
 *  (der Chunker zerlegt ihn selbst in Sätze) und danach den Gesamttext. */
function mockCallModelStream(text) {
  callModelStream.mockImplementation(async ({ onDelta }) => {
    onDelta(text)
    return { text, ms: 10, tokens: { in: 5, out: 5 } }
  })
}

function opt(overrides = {}) {
  return {
    utterance: 'Warum ist der Himmel blau',
    ageBand: '4-5',
    models: {},
    systemPrompt: '',
    blockPatterns: '',
    history: [],
    learner: null,
    openerIndex: 0,
    ...overrides,
  }
}

/** `sende` sammelt alle Ereignisse in Reihenfolge, wie es ein echter NDJSON-Stream täte. */
function sammler() {
  const ereignisse = []
  return { ereignisse, sende: (e) => ereignisse.push(e) }
}

const synthesizeFake = vi.fn(async (text) => ({ base64: `b64:${text.slice(0, 12)}` }))

beforeEach(() => {
  vi.clearAllMocks()
  synthesizeFake.mockImplementation(async (text) => ({ base64: `b64:${text.slice(0, 12)}` }))
})

describe('runS2S — Safety-Gate', () => {
  it('Guard lehnt Chunk 1 ab → kein answer-Audio, stattdessen abort + Pivot + done', async () => {
    mockCallModel({ guardText: JSON.stringify({ freigabe: false, kategorie: 'risiko' }) })
    mockCallModelStream('Das ist eine spannende Frage über den Himmel.')
    const { ereignisse, sende } = sammler()

    await runS2S(opt(), sende, synthesizeFake)

    const answerAudios = ereignisse.filter((e) => e.type === 'audio' && e.kind === 'answer')
    expect(answerAudios).toHaveLength(0)
    expect(ereignisse.some((e) => e.type === 'abort')).toBe(true)
    expect(ereignisse.some((e) => e.type === 'audio' && e.kind === 'pivot')).toBe(true)
    const letzte = ereignisse[ereignisse.length - 1]
    expect(letzte.type).toBe('done')
    expect(letzte.decision).toBe('abgebrochen')
  })

  it('Vollprüfung lehnt ab, nachdem Chunk 1 bereits gesendet wurde → kein weiterer answer-Chunk, done bleibt letztes Ereignis', async () => {
    mockCallModel({
      guardText: JSON.stringify({ freigabe: true, kategorie: 'ok' }),
      safetyText: JSON.stringify({ freigabe: false, kategorie: 'risiko' }),
    })
    // Zwei Sätze: der erste läuft durch den Guard (Chunk 0), der zweite wartet auf die
    // Vollprüfung (Chunk 1) — genau der Fall, den die Spec beschreibt.
    mockCallModelStream('Satz eins ist unbedenklich. Satz zwei bleibt in der Warteschlange.')
    const { ereignisse, sende } = sammler()

    await runS2S(opt(), sende, synthesizeFake)

    const answerAudios = ereignisse.filter((e) => e.type === 'audio' && e.kind === 'answer')
    expect(answerAudios).toHaveLength(1)
    expect(answerAudios[0].index).toBe(0)
    expect(ereignisse.some((e) => e.type === 'abort')).toBe(true)
    expect(ereignisse.some((e) => e.type === 'audio' && e.kind === 'pivot')).toBe(true)
    expect(ereignisse[ereignisse.length - 1].type).toBe('done')
  })

  it('unparsbares Guard-Urteil zählt als Ablehnung (fail-closed)', async () => {
    mockCallModel({ guardText: 'Also ich bin mir nicht sicher, was meinst du?' })
    mockCallModelStream('Das ist eine spannende Frage über den Himmel.')
    const { ereignisse, sende } = sammler()

    await runS2S(opt(), sende, synthesizeFake)

    const answerAudios = ereignisse.filter((e) => e.type === 'audio' && e.kind === 'answer')
    expect(answerAudios).toHaveLength(0)
    expect(ereignisse.some((e) => e.type === 'abort')).toBe(true)
    expect(ereignisse.some((e) => e.type === 'audio' && e.kind === 'pivot')).toBe(true)
    expect(ereignisse[ereignisse.length - 1].type).toBe('done')
  })

  it('Pattern-Treffer über eine Satzgrenze hinweg (nur in der Gesamtantwort sichtbar) bricht vor approveFull ab', async () => {
    mockCallModel({ guardText: JSON.stringify({ freigabe: true, kategorie: 'ok' }) })
    // "böse. hexe" liegt über die Satzgrenze verteilt — der Pro-Chunk-Check in `verarbeite`
    // sieht ihn nie, weil kein einzelner Satz (weder "...böse." noch "Hexe...") den vollen
    // Ausdruck enthält; erst die Gesamtantwort tut es.
    mockCallModelStream('Da war einmal eine böse. Hexe im Wald.')
    const { ereignisse, sende } = sammler()

    await runS2S(opt({ blockPatterns: 'böse. hexe' }), sende, synthesizeFake)

    // Der erste Satz wird vom Guard freigegeben und als answer-Audio gesendet,
    // bevor die Gesamtantwort-Prüfung das Pattern über die Satzgrenze erkennt.
    // Nach dem abort darf kein weiterer answer-Chunk folgen.
    const answerAudios = ereignisse.filter((e) => e.type === 'audio' && e.kind === 'answer')
    expect(answerAudios).toHaveLength(1)
    expect(ereignisse.some((e) => e.type === 'abort' && /Gesamtantwort/.test(e.grund ?? ''))).toBe(true)
    expect(ereignisse.some((e) => e.type === 'audio' && e.kind === 'pivot')).toBe(true)
    expect(ereignisse[ereignisse.length - 1].type).toBe('done')
  })
})
