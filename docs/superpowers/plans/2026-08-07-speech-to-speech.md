# Speech-to-Speech-Ansicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vierte Studio-Ansicht: links das live laufende Speech-to-Speech-Flussdiagramm, rechts ein Chat mit animiertem Globe — gesprochene Gesprächs-Session mit Chunk-Streaming und gestaffelter Safety-Freigabe.

**Architecture:** Geteilte Prompt-/LLM-Bausteine werden aus `server/index.mjs` in eigene Module extrahiert, damit ein neues `server/s2s.mjs` sie ohne Duplikat nutzt. Die Streaming-Sicherheit steckt in zwei reinen, unit-getesteten Funktionen (Satz-Chunker, Safety-Gate). Der Server sendet NDJSON-Ereignisse über `POST /api/s2s`; der Client fährt daraus Zustandsautomat, Audio-Queue und Live-Diagramm.

**Tech Stack:** Node ≥ 20 (natives fetch, `ReadableStream`), Vitest 4 (`npm test`, aktuell 51 grün), React 19, Web Audio API, Piper-TTS + whisper.cpp (lokal, bereits eingerichtet).

**Spec:** `docs/superpowers/specs/2026-08-07-speech-to-speech-design.md`

## Global Constraints

- Sprache in UI, Kommentaren und Commits: Deutsch; Commit-Messages enden mit `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Trunk-based: nach jedem Task `git add` → `commit` → `git push origin main`.
- Gates vor jedem Commit: `npx tsc -b && npm run build && npm test` grün.
- Keine neuen Laufzeit-Abhängigkeiten (kein WebSocket-Paket, kein onnxruntime, keine 3D-Bibliothek).
- **Sicherheits-Invariante, bindend für alle Tasks:** Ein `audio`-Ereignis darf den Server nur verlassen, wenn der Inhalt eine Prüfung bestanden hat. Opener, Skript-Antworten und Pivot sind kuratiert und gelten als vorab genehmigt.
- Fehlerfälle immer fail-closed: unparsbares Guard-Urteil, abgerissener Stream, TTS-Fehler → Abbruch mit Pivot, niemals ungeprüft weitersprechen.
- Theme: bestehende Tokens (`--status-ok/warn/risk`, `card`, `border`, `muted-foreground`), keine harten Farben.

---

### Task 1: Geteilte Bausteine aus index.mjs extrahieren

**Files:**
- Create: `server/prompts.mjs`
- Create: `server/llm.mjs`
- Modify: `server/index.mjs` (Konstanten- und `callModel`-Block entfernen, Importe ergänzen)
- Test: `server/llm.test.mjs`

**Interfaces:**
- Consumes: `server/providers.mjs` — `resolveProvider(model) → { providerId, modelId }`, `providerConfig(providerId) → { url, key, isOpenRouter }`.
- Produces (Task 2 und 3 bauen darauf):
  - aus `server/prompts.mjs`: `PROMPT_VERSION`, `TRIAGE_SYSTEM`, `MAIN_SYSTEM(ageBand)`, `SAFETY_SYSTEM`, `DEFAULT_JUDGE_RUBRIC`, `SCRIPTED_EMOTION`, `SCRIPTED_RISK`, `SCRIPTED_CLARIFY`, `SCRIPTED_FALLBACK`, `SCRIPTED_PIVOT`, `OPENER_TEXTE` (String-Array)
  - aus `server/llm.mjs`: `callModel({ model, system, user, history, maxTokens }) → { text, ms, tokens }`, `callModelStream({ model, system, user, history, maxTokens, onDelta }) → { text, ms, tokens }`, `parseJson(text) → object|null`

- [ ] **Step 1: `server/prompts.mjs` anlegen**

Verschiebe die Blöcke unverändert aus `server/index.mjs` (per grep lokalisieren: `PROMPT_VERSION`, `TRIAGE_SYSTEM`, `MAIN_SYSTEM`, `SAFETY_SYSTEM`, `DEFAULT_JUDGE_RUBRIC`, `SCRIPTED_EMOTION`, `SCRIPTED_RISK`, `SCRIPTED_CLARIFY`, `SCRIPTED_FALLBACK`) in die neue Datei und stelle jeweils `export` voran. Die Prompt-Texte dürfen dabei **nicht** verändert werden — es ist eine reine Verschiebung.

Ergänze am Ende der Datei zwei neue Konstanten:

```js
/** Abbruch-Satz, wenn eine Prüfung während der laufenden Antwort fällt.
 *  Kuratiert und vorab genehmigt — er darf immer gesprochen werden. */
export const SCRIPTED_PIVOT =
  'Weißt du was, das frag am besten mal Mama oder Papa. Wollen wir stattdessen etwas anderes machen?'

/** Vorsynthetisierte Einstiege: überbrücken die Denkzeit, bevor der erste geprüfte
 *  Antwort-Chunk fertig ist. Kuratiert, altersgerecht, inhaltlich leer — null Risiko. */
export const OPENER_TEXTE = [
  'Hmm, lass mich kurz überlegen.',
  'Oh, das ist eine gute Frage!',
  'Moment, ich denke nach.',
]
```

- [ ] **Step 2: `server/llm.mjs` anlegen**

```js
/**
 * Modell-Aufrufe (blockierend und streamend) über die Provider-Abstraktion.
 * Aus index.mjs extrahiert, damit die Live-Pipeline und die Speech-to-Speech-Kette
 * denselben Code nutzen statt zweier Kopien.
 */
import { resolveProvider, providerConfig } from './providers.mjs'

/** Gemeinsamer Request-Body für beide Aufrufarten. */
function buildBody({ modelId, system, user, history, maxTokens, isOpenRouter, stream }) {
  return {
    model: modelId,
    max_tokens: maxTokens,
    stream,
    messages: [
      { role: 'system', content: system },
      ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text ?? '') })),
      { role: 'user', content: user },
    ],
    // Nur OpenRouter kennt das Anbieter-Feld; Melious ist EU-only
    ...(isOpenRouter ? { provider: { data_collection: 'deny' } } : {}),
  }
}

function headersFor({ key, isOpenRouter }) {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(isOpenRouter ? { 'HTTP-Referer': 'http://localhost:5173', 'X-Title': 'Architektur-Studio' } : {}),
  }
}

function requireKey(providerId, key) {
  if (!key) {
    throw new Error(
      `Kein API-Key für Provider "${providerId}" gesetzt (${providerId === 'melious' ? 'MELIOUS_API_KEY' : 'OPENROUTER_API_KEY'} in .env).`,
    )
  }
}

export async function callModel({ model, system, user, history = [], maxTokens = 400 }) {
  const started = performance.now()
  const { providerId, modelId } = resolveProvider(model)
  const { url, key, isOpenRouter } = providerConfig(providerId)
  requireKey(providerId, key)
  const res = await fetch(url, {
    method: 'POST',
    headers: headersFor({ key, isOpenRouter }),
    body: JSON.stringify(buildBody({ modelId, system, user, history, maxTokens, isOpenRouter, stream: false })),
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

/**
 * Streamende Variante: ruft `onDelta(teilText)` für jedes eintreffende Textstück
 * und liefert am Ende den Gesamttext. Token-Zählung kommt aus dem letzten
 * usage-Feld, falls der Anbieter eines schickt (OpenAI-Konvention), sonst 0.
 */
export async function callModelStream({ model, system, user, history = [], maxTokens = 400, onDelta }) {
  const started = performance.now()
  const { providerId, modelId } = resolveProvider(model)
  const { url, key, isOpenRouter } = providerConfig(providerId)
  requireKey(providerId, key)
  const res = await fetch(url, {
    method: 'POST',
    headers: headersFor({ key, isOpenRouter }),
    body: JSON.stringify(buildBody({ modelId, system, user, history, maxTokens, isOpenRouter, stream: true })),
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300)
    throw new Error(`Modell "${model}" (Stream): HTTP ${res.status} — ${body}`)
  }

  const decoder = new TextDecoder()
  let puffer = ''
  let text = ''
  let usage = {}
  for await (const stueck of res.body) {
    puffer += decoder.decode(stueck, { stream: true })
    // SSE: durch Leerzeilen getrennte Blöcke, jede Nutzzeile beginnt mit "data: "
    let grenze
    while ((grenze = puffer.indexOf('\n')) !== -1) {
      const zeile = puffer.slice(0, grenze).trim()
      puffer = puffer.slice(grenze + 1)
      if (!zeile.startsWith('data:')) continue
      const rohdaten = zeile.slice(5).trim()
      if (rohdaten === '[DONE]') continue
      try {
        const teil = JSON.parse(rohdaten)
        const delta = teil.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          text += delta
          onDelta?.(delta)
        }
        if (teil.usage) usage = teil.usage
      } catch {
        // unvollständiges oder fremdes Fragment — überspringen, der Stream läuft weiter
      }
    }
  }
  return {
    text: text.trim(),
    ms: Math.round(performance.now() - started),
    tokens: { in: usage.prompt_tokens ?? 0, out: usage.completion_tokens ?? 0 },
  }
}

/** Tolerantes JSON-Parsing — Modelle ohne Structured-Output-Support liefern gern Text drumherum. */
export function parseJson(text) {
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
```

- [ ] **Step 3: `server/index.mjs` umstellen**

1. Importe ergänzen:
```js
import { callModel, parseJson } from './llm.mjs'
import {
  PROMPT_VERSION, TRIAGE_SYSTEM, MAIN_SYSTEM, SAFETY_SYSTEM, DEFAULT_JUDGE_RUBRIC,
  SCRIPTED_EMOTION, SCRIPTED_RISK, SCRIPTED_CLARIFY, SCRIPTED_FALLBACK,
} from './prompts.mjs'
```
2. Die verschobenen Definitionen (Konstanten, `callModel`, `parseJson`) aus `index.mjs` **löschen**.
3. Kontrolle: `grep -n "^const TRIAGE_SYSTEM\|^const MAIN_SYSTEM\|^const SAFETY_SYSTEM\|^async function callModel\|^function parseJson\|^const SCRIPTED_\|^const PROMPT_VERSION\|^const DEFAULT_JUDGE_RUBRIC" server/index.mjs` darf **nichts** mehr finden. `server/index.mjs` ist eine `.mjs`-Datei — der Typecheck fängt einen vergessenen Verweis NICHT, nur der Laufzeit-Test in Step 5.

- [ ] **Step 4: Test für den Stream-Parser** — `server/llm.test.mjs`:

```js
// Tests für den SSE-Parser der streamenden Modell-Aufrufe — kein echter Netzaufruf.
import { describe, it, expect, vi } from 'vitest'
import { callModelStream, parseJson } from './llm.mjs'
import * as providers from './providers.mjs'

/** Baut eine Fake-Response, deren body die übergebenen SSE-Zeilen streamt. */
function fakeSseResponse(zeilen) {
  const encoder = new TextEncoder()
  return {
    ok: true,
    body: (async function* () {
      for (const zeile of zeilen) yield encoder.encode(zeile)
    })(),
  }
}

describe('callModelStream — SSE-Verarbeitung', () => {
  it('setzt Deltas zusammen und meldet jedes Stück über onDelta', async () => {
    vi.spyOn(providers, 'providerConfig').mockReturnValue({
      url: 'https://example.test/v1/chat/completions', key: 'sk-test', isOpenRouter: true,
    })
    const globalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeSseResponse([
        'data: {"choices":[{"delta":{"content":"Der Himmel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" ist blau."}}]}\n\n',
        'data: {"usage":{"prompt_tokens":12,"completion_tokens":5},"choices":[{"delta":{}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    const stuecke = []
    const ergebnis = await callModelStream({
      model: 'test/modell', system: 's', user: 'u', onDelta: (d) => stuecke.push(d),
    })
    expect(stuecke).toEqual(['Der Himmel', ' ist blau.'])
    expect(ergebnis.text).toBe('Der Himmel ist blau.')
    expect(ergebnis.tokens).toEqual({ in: 12, out: 5 })
    globalFetch.mockRestore()
    vi.restoreAllMocks()
  })

  it('überspringt kaputte Fragmente, statt den Stream abzubrechen', async () => {
    vi.spyOn(providers, 'providerConfig').mockReturnValue({
      url: 'https://example.test/v1/chat/completions', key: 'sk-test', isOpenRouter: false,
    })
    const globalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeSseResponse([
        'data: {kaputt\n\n',
        'data: {"choices":[{"delta":{"content":"trotzdem da"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    const ergebnis = await callModelStream({ model: 'test/modell', system: 's', user: 'u' })
    expect(ergebnis.text).toBe('trotzdem da')
    globalFetch.mockRestore()
    vi.restoreAllMocks()
  })
})

describe('parseJson', () => {
  it('liest sauberes und umrahmtes JSON, sonst null', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 })
    expect(parseJson('Klar! {"a":1} — bitte sehr')).toEqual({ a: 1 })
    expect(parseJson('gar kein JSON')).toBe(null)
  })
})
```

- [ ] **Step 5: Tests + Laufzeit-Rauchtest**

Run: `npm test`
Expected: PASS (51 bestehende + 3 neue).

Server starten und einen echten Turn fahren (prüft, dass keine Referenz beim Verschieben verloren ging):
```bash
npm run server &
sleep 3
curl -s http://localhost:8787/api/run -X POST -H 'content-type: application/json' \
  -d '{"utterance":"Warum ist Gras grün?","ageBand":"6-7","noCache":true}' | head -c 200
```
Expected: `"ok":true` mit Antworttext. Danach den Server-Prozess beenden.

- [ ] **Step 6: Gates + Commit + Push**

```bash
npx tsc -b && npm run build && npm test
git add server/prompts.mjs server/llm.mjs server/llm.test.mjs server/index.mjs
git commit -m "Prompts und Modell-Aufrufe in eigene Module extrahiert

Vorbereitung für die Speech-to-Speech-Kette: prompts.mjs und llm.mjs
werden von index.mjs und der neuen s2s-Pipeline geteilt statt kopiert.
Neu: callModelStream (SSE) mit Test, plus SCRIPTED_PIVOT und
OPENER_TEXTE für die gestaffelte Freigabe.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: Satz-Chunker und Safety-Gate (reine Logik)

**Files:**
- Create: `server/s2sCore.mjs`
- Test: `server/s2sCore.test.mjs`

**Interfaces:**
- Consumes: nichts (reine Funktionen ohne I/O).
- Produces (Task 3 nutzt beides):
  - `createChunker() → { feed(text) → string[], flush() → string|null }` — `feed` liefert alle durch den Zuwachs vollständig gewordenen Sätze, `flush` den verbliebenen Rest.
  - `createGate() → { approveFirst(), approveFull(), reject(grund), mayEmit(index) → boolean, get status, get grund }` — Status ist `'offen' | 'erste_frei' | 'alle_frei' | 'abgebrochen'`.

- [ ] **Step 1: Failing Tests schreiben** — `server/s2sCore.test.mjs`:

```js
// Tests für die beiden sicherheitskritischen reinen Funktionen der s2s-Kette.
import { describe, it, expect } from 'vitest'
import { createChunker, createGate } from './s2sCore.mjs'

describe('createChunker — Sätze aus dem Token-Strom', () => {
  it('gibt einen Satz erst aus, wenn er vollständig ist', () => {
    const c = createChunker()
    expect(c.feed('Der Himmel')).toEqual([])
    expect(c.feed(' ist blau.')).toEqual(['Der Himmel ist blau.'])
  })

  it('erkennt mehrere Sätze in einem Zuwachs', () => {
    const c = createChunker()
    expect(c.feed('Ja! Und warum? Das kommt vom Licht.')).toEqual([
      'Ja!', 'Und warum?', 'Das kommt vom Licht.',
    ])
  })

  it('trennt NICHT bei Abkürzungen', () => {
    const c = createChunker()
    expect(c.feed('Nimm z. B. drei Äpfel und zähl sie.')).toEqual(['Nimm z. B. drei Äpfel und zähl sie.'])
  })

  it('trennt NICHT innerhalb von Dezimalzahlen', () => {
    const c = createChunker()
    expect(c.feed('Das dauert 1.5 Sekunden ungefähr.')).toEqual(['Das dauert 1.5 Sekunden ungefähr.'])
  })

  it('flush liefert den unvollständigen Rest und leert den Puffer', () => {
    const c = createChunker()
    c.feed('Ein ganzer Satz. Und ein Rest ohne Ende')
    expect(c.flush()).toBe('Und ein Rest ohne Ende')
    expect(c.flush()).toBe(null)
  })

  it('flush ohne Rest liefert null', () => {
    const c = createChunker()
    c.feed('Alles fertig.')
    expect(c.flush()).toBe(null)
  })
})

describe('createGate — die Sicherheits-Invariante', () => {
  it('vor jeder Freigabe darf NICHTS raus', () => {
    const g = createGate()
    expect(g.mayEmit(0)).toBe(false)
    expect(g.mayEmit(1)).toBe(false)
    expect(g.status).toBe('offen')
  })

  it('nach Guard-Freigabe darf NUR der erste Chunk raus', () => {
    const g = createGate()
    g.approveFirst()
    expect(g.mayEmit(0)).toBe(true)
    expect(g.mayEmit(1)).toBe(false)
    expect(g.status).toBe('erste_frei')
  })

  it('nach der Vollprüfung dürfen alle Chunks raus', () => {
    const g = createGate()
    g.approveFirst()
    g.approveFull()
    expect(g.mayEmit(0)).toBe(true)
    expect(g.mayEmit(3)).toBe(true)
    expect(g.status).toBe('alle_frei')
  })

  it('Abbruch sperrt alles — auch bereits Freigegebenes', () => {
    const g = createGate()
    g.approveFirst()
    g.approveFull()
    g.reject('Safety-Modell hat blockiert')
    expect(g.mayEmit(0)).toBe(false)
    expect(g.mayEmit(1)).toBe(false)
    expect(g.status).toBe('abgebrochen')
    expect(g.grund).toBe('Safety-Modell hat blockiert')
  })

  it('nach einem Abbruch heben spätere Freigaben ihn NICHT auf', () => {
    const g = createGate()
    g.reject('Guard-Urteil unparsbar')
    g.approveFirst()
    g.approveFull()
    expect(g.mayEmit(0)).toBe(false)
    expect(g.status).toBe('abgebrochen')
  })
})
```

- [ ] **Step 2: Tests laufen lassen — müssen FEHLSCHLAGEN**

Run: `npm test`
Expected: FAIL — `Cannot find module './s2sCore.mjs'`

- [ ] **Step 3: Implementierung** — `server/s2sCore.mjs`:

```js
/**
 * Reine Bausteine der Speech-to-Speech-Kette: Satz-Chunker und Safety-Gate.
 * Bewusst ohne I/O — die Sicherheits-Invariante („kein Audio ohne bestandene
 * Prüfung") ist damit als Zustandsautomat testbar statt nur behauptet.
 */

/** Abkürzungen, nach denen ein Punkt KEIN Satzende ist. */
const ABKUERZUNGEN = ['z. b', 'z.b', 'u. a', 'u.a', 'd. h', 'd.h', 'ca', 'bzw', 'ggf', 'usw', 'etc', 'dr', 'nr', 'ab', 'evtl']

/** Ist der Punkt an Position i ein echtes Satzende? */
function istSatzende(text, i) {
  const zeichen = text[i]
  if (zeichen === '!' || zeichen === '?') return true
  if (zeichen !== '.') return false
  // Dezimalzahl: Ziffer davor UND danach
  if (/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) return false
  // Abkürzung: letztes Wort vor dem Punkt steht in der Liste
  const davor = text.slice(0, i).toLowerCase()
  const letztesWort = davor.slice(davor.lastIndexOf(' ') + 1)
  if (ABKUERZUNGEN.includes(letztesWort)) return false
  // Mehrteilige Abkürzung („z. B.") — auch das vorletzte Wortpaar prüfen
  const zweiWorte = davor.split(' ').slice(-2).join(' ')
  if (ABKUERZUNGEN.includes(zweiWorte)) return false
  return true
}

/**
 * Sammelt Text-Deltas und gibt vollständige Sätze aus.
 * @returns {{ feed: (text: string) => string[], flush: () => string|null }}
 */
export function createChunker() {
  let puffer = ''
  return {
    feed(text) {
      puffer += text
      const saetze = []
      let start = 0
      for (let i = 0; i < puffer.length; i += 1) {
        if (!istSatzende(puffer, i)) continue
        // Satzende gilt erst als abgeschlossen, wenn danach Leerraum oder Textende folgt
        const danach = puffer[i + 1]
        if (danach !== undefined && !/\s/.test(danach)) continue
        const satz = puffer.slice(start, i + 1).trim()
        if (satz) saetze.push(satz)
        start = i + 1
      }
      puffer = puffer.slice(start)
      return saetze
    },
    flush() {
      const rest = puffer.trim()
      puffer = ''
      return rest || null
    },
  }
}

/**
 * Safety-Gate: entscheidet, welcher Chunk-Index ausgeliefert werden darf.
 * Chunk 0 braucht die Guard-Freigabe, alle weiteren die Vollprüfung.
 * Ein Abbruch ist endgültig und hebt jede vorherige Freigabe auf.
 */
export function createGate() {
  let ersteFrei = false
  let alleFrei = false
  let abgebrochen = false
  let grund = null
  return {
    approveFirst() {
      if (!abgebrochen) ersteFrei = true
    },
    approveFull() {
      if (!abgebrochen) {
        ersteFrei = true
        alleFrei = true
      }
    },
    reject(neuerGrund) {
      abgebrochen = true
      grund = neuerGrund
    },
    mayEmit(index) {
      if (abgebrochen) return false
      return index === 0 ? ersteFrei : alleFrei
    },
    get status() {
      if (abgebrochen) return 'abgebrochen'
      if (alleFrei) return 'alle_frei'
      if (ersteFrei) return 'erste_frei'
      return 'offen'
    },
    get grund() {
      return grund
    },
  }
}
```

- [ ] **Step 4: Tests laufen lassen — müssen PASSEN**

Run: `npm test`
Expected: PASS (54 + 12 neue = 66; die genaue Zahl im Bericht festhalten).

- [ ] **Step 5: Gates + Commit + Push**

```bash
npx tsc -b && npm run build && npm test
git add server/s2sCore.mjs server/s2sCore.test.mjs
git commit -m "s2s-Kern: Satz-Chunker und Safety-Gate als reine, getestete Logik

Die Invariante „kein Audio-Chunk ohne bestandene Prüfung" ist jetzt ein
Zustandsautomat mit Tests — inklusive: Abbruch hebt frühere Freigaben auf
und ist endgültig. Chunker trennt nicht bei z. B. oder Dezimalzahlen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: Streaming-Pipeline und /api/s2s

**Files:**
- Create: `server/s2s.mjs`
- Modify: `server/index.mjs` (Endpoint `POST /api/s2s`, Opener-Vorsynthese beim Start, Export der TTS-Hilfe)

**Interfaces:**
- Consumes: `server/s2sCore.mjs` (`createChunker`, `createGate`), `server/llm.mjs` (`callModel`, `callModelStream`, `parseJson`), `server/prompts.mjs` (alle Konstanten), `server/router.mjs` (`decideRoute`), `server/teachingPlanner.mjs` (`planStrategy`, `detectSkill`, `detectFrustration`, `recordExposure`, `directiveFor`).
- Produces: `runS2S(optionen, sende) → Promise<void>`; `sende(ereignis)` wird pro NDJSON-Ereignis aufgerufen. Task 4 konsumiert genau diese Ereignisse.

- [ ] **Step 1: TTS-Hilfe in index.mjs exportierbar machen**

In `server/index.mjs` die bestehende Synthese-Logik aus dem `/api/tts`-Handler in eine wiederverwendbare Funktion ziehen (per grep `if (req.method === 'POST' && req.url === '/api/tts')` lokalisieren). Neue Funktion oberhalb des Handlers, der Handler ruft sie danach auf:

```js
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
  await writeFile(cacheFile, audio).catch(() => {})
  return { base64: audio.toString('base64'), engine, cached: false }
}
```

Den `/api/tts`-Handler auf `synthesize(text)` umstellen, sodass sein Antwort-JSON (`ok`, `audio`, `ms`, `engine`, `cached`) unverändert bleibt. Prüfe mit `grep -n "writeFile" server/index.mjs`, ob `writeFile` bereits aus `node:fs/promises` importiert ist — falls nicht, zum bestehenden Import ergänzen.

- [ ] **Step 2: `server/s2s.mjs` schreiben**

```js
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

  /** Spielt kuratierten (vorab genehmigten) Text aus — Opener, Skript, Pivot. */
  const sendeKuratiert = async (text, kind) => {
    const { base64 } = await synthesize(text)
    sende({ type: 'text', chunk: text, index: -1 })
    sende({ type: 'audio', wavBase64: base64, index: -1, kind })
  }

  /** Bricht ab: kein weiterer Antwort-Chunk, Pivot als letztes Wort. */
  const abbrechen = async (grund) => {
    gate.reject(grund)
    sende({ type: 'abort', grund })
    await sendeKuratiert(SCRIPTED_PIVOT, 'pivot')
    sende({ type: 'done', totalMs: Date.now() - started, decision: 'abgebrochen' })
  }

  try {
    // 1. Opener — überbrückt die Denkzeit, inhaltlich leer, null Risiko
    sende({ type: 'stage', key: 'opener', status: 'aktiv' })
    await sendeKuratiert(zufallsOpener(openerIndex), 'opener')
    sende({ type: 'stage', key: 'opener', status: 'fertig', ms: Date.now() - started })

    // 2. Triage
    const triageStart = Date.now()
    sende({ type: 'stage', key: 'triage', status: 'aktiv' })
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
      sende({ type: 'done', totalMs: Date.now() - started, decision })
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
    sende({ type: 'stage', key: 'main', status: 'aktiv' })
    const chunker = createChunker()
    const wartende = []        // Chunks, die auf die Vollprüfung warten
    let praefix = ''           // bereits freigegebener Text (Kontext für den Guard)
    let guardLaeuft = null

    /** Schickt einen freigegebenen Antwort-Chunk als Text + Audio. */
    const sendeChunk = async (satz, index) => {
      const { base64 } = await synthesize(satz)
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
        // Erster Satz: ein Guard-Call auf dem kumulativen Präfix inkl. Kinderfrage
        const guardStart = Date.now()
        sende({ type: 'stage', key: 'guard', status: 'aktiv' })
        guardLaeuft = callModel({
          model: safetyModel, system: SAFETY_SYSTEM,
          user: `Frage des Kindes (${ageBand} Jahre): "${utterance}"\n\nBisher geplanter Antwortanfang: "${satz}"`,
          maxTokens: 200,
        })
        const urteil = parseJson((await guardLaeuft).text)
        const frei = urteil?.freigabe === true
        sende({
          type: 'stage', key: 'guard', status: frei ? 'fertig' : 'fehler', ms: Date.now() - guardStart,
          detail: frei ? 'Erster Satz freigegeben' : 'Erster Satz blockiert → Abbruch',
        })
        if (!frei) {
          await abbrechen('Guard hat den ersten Satz nicht freigegeben')
          return
        }
        gate.approveFirst()
        praefix += `${satz} `
        await sendeChunk(satz, index)
        return
      }

      // Ab Chunk 2: erst nach bestandener Vollprüfung
      if (gate.mayEmit(index)) {
        praefix += `${satz} `
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
          guardLaeuft = (guardLaeuft ?? Promise.resolve()).then(() => verarbeite(satz))
        }
      },
    })
    const rest = chunker.flush()
    guardLaeuft = (guardLaeuft ?? Promise.resolve()).then(() => (rest ? verarbeite(rest) : undefined))
    await guardLaeuft
    sende({ type: 'stage', key: 'main', status: 'fertig', ms, detail: `${tokens.out} Tokens generiert` })
    if (gate.status === 'abgebrochen') return

    // 6. Vollprüfung der Gesamtantwort — gibt alle restlichen Chunks frei
    const safetyStart = Date.now()
    sende({ type: 'stage', key: 'safety', status: 'aktiv' })
    const safetyCall = await callModel({
      model: safetyModel, system: SAFETY_SYSTEM,
      user: `Frage des Kindes (${ageBand} Jahre): "${utterance}"\n\nGeplante Antwort: "${gesamt}"`, maxTokens: 200,
    })
    const urteil = parseJson(safetyCall.text)
    const freigegeben = urteil?.freigabe === true
    sende({
      type: 'stage', key: 'safety', status: freigegeben ? 'fertig' : 'fehler', ms: Date.now() - safetyStart,
      detail: freigegeben ? `Freigegeben (${urteil.kategorie})` : `Blockiert (${urteil?.kategorie ?? 'unparsbar'}) → Abbruch`,
    })
    if (!freigegeben) {
      await abbrechen('Vollprüfung der Gesamtantwort hat blockiert')
      return
    }
    gate.approveFull()
    for (const { satz, index } of wartende) {
      if (gate.status === 'abgebrochen') break
      await sendeChunk(satz, index)
    }
    sende({ type: 'done', totalMs: Date.now() - started, decision, promptVersion: PROMPT_VERSION })
  } catch (err) {
    // Jeder unerwartete Fehler (Stream abgerissen, TTS kaputt, kein Key) endet fail-closed
    await abbrechen(String(err.message ?? err)).catch(() => {})
  }
}
```

- [ ] **Step 3: Endpoint und Opener-Vorsynthese in index.mjs**

Importe ergänzen:
```js
import { runS2S } from './s2s.mjs'
import { OPENER_TEXTE, SCRIPTED_PIVOT } from './prompts.mjs'
```

Vorsynthese beim Start — direkt vor `server.listen(...)` einfügen:
```js
// Kuratierte Sätze einmal vorsynthetisieren: Opener und Abbruch-Pivot sind damit
// im Cache und kosten zur Laufzeit keine Wartezeit.
for (const text of [...OPENER_TEXTE, SCRIPTED_PIVOT, SCRIPTED_RISK, SCRIPTED_EMOTION, SCRIPTED_CLARIFY]) {
  synthesize(text).catch((err) => console.warn(`Vorsynthese fehlgeschlagen: ${String(err.message ?? err)}`))
}
```

Endpoint (neben den anderen Handlern einfügen, per grep `'/api/run'` die Stelle finden):
```js
  if (req.method === 'POST' && req.url === '/api/s2s') {
    const body = JSON.parse((await readBody(req)) || '{}')
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' })
    const sende = (ereignis) => res.write(`${JSON.stringify(ereignis)}\n`)
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

      const sessionId = String(body.sessionId ?? 's2s')
      const learner = learnerStates.get(sessionId) ?? emptyLearnerState()
      await runS2S({ ...body, utterance, learner, openerIndex: (body.history?.length ?? 0) }, sende, synthesize)
      setLearnerState(sessionId, learner)
      return res.end()
    } catch (err) {
      sende({ type: 'abort', grund: String(err.message ?? err) })
      sende({ type: 'done', totalMs: 0, decision: 'fehler' })
      return res.end()
    }
  }
```

- [ ] **Step 4: Live-Verifikation**

Server starten (`npm run server &`, 3 s warten) und einen Turn mit einer echten WAV-Datei fahren. Falls kein Testaudio vorliegt, erzeuge eines per `say`:
```bash
say -o /tmp/frage.wav --data-format=LEI16@16000 "Warum ist der Himmel blau"
node -e "const fs=require('fs');const b=fs.readFileSync('/tmp/frage.wav').toString('base64');fs.writeFileSync('/tmp/req.json',JSON.stringify({audio:b,ageBand:'6-7'}))"
curl -sN http://localhost:8787/api/s2s -X POST -H 'content-type: application/json' -d @/tmp/req.json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{for(const l of d.trim().split('\n')){const e=JSON.parse(l);console.log(e.type, e.key??e.index??'', e.status??'', (e.detail??e.chunk??'').slice(0,60), e.wavBase64?'[audio '+e.wavBase64.length+' B]':'')}})"
```
Expected: Ereignisfolge mit `stage stt fertig`, `transcript`, `stage opener`, `audio … [audio …]` (Opener), `stage triage`, `stage router`, `stage main`, mindestens ein `audio … kind=answer`, `stage safety fertig`, `done`. **Wichtig:** Es darf kein `audio` mit `kind=answer` VOR dem `stage guard fertig` erscheinen — das ist die Sicherheits-Invariante im Live-Test. Beobachtung im Bericht festhalten (`npm run stt` muss laufen; falls nicht, starten).

Danach Server und STT-Prozess beenden.

- [ ] **Step 5: Gates + Commit + Push**

```bash
npx tsc -b && npm run build && npm test
git add server/s2s.mjs server/index.mjs
git commit -m "Speech-to-Speech-Kette: /api/s2s mit NDJSON-Stream und gestaffelter Freigabe

Opener vorsynthetisiert, erster Satz per Guard-Call freigegeben, alle
weiteren erst nach der Vollprüfung; Abbruch spielt den kuratierten
Pivot. Skript-Antworten und Pivot werden beim Serverstart in den
TTS-Cache synthetisiert.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: Client-Session — VAD, Audio-Queue, Stream-Verarbeitung

**Files:**
- Create: `src/lib/energyVad.ts`
- Create: `src/lib/s2sSession.ts`
- Test: `src/lib/energyVad.test.ts`

**Interfaces:**
- Consumes: `POST /api/s2s`-Ereignisse aus Task 3 (`stage`, `transcript`, `text`, `audio`, `abort`, `done`).
- Produces (Task 5 und 6 nutzen das):
  - `createEnergyVad(opt?) → { push(samples: Float32Array, rate: number) → 'still'|'spricht'|'ende', reset() }`
  - `S2SSession`-Klasse mit `start()`, `stop()`, `onEvent`, `getAnalyser()`, Zustände `'aus'|'hoert_zu'|'denkt'|'spricht'`.

- [ ] **Step 1: Failing Tests schreiben** — `src/lib/energyVad.test.ts`:

```ts
// Tests für die energie-basierte Sprecherkennung — reine Logik, kein Audio-Stack.
import { describe, it, expect } from 'vitest'
import { createEnergyVad } from './energyVad'

/** Blockweise Samples: `laut` erzeugt Ausschlag, sonst Stille. */
const block = (laut: boolean, laenge = 1600) =>
  Float32Array.from({ length: laenge }, () => (laut ? 0.5 : 0.0001))

describe('createEnergyVad', () => {
  it('meldet Stille, solange nichts gesprochen wird', () => {
    const vad = createEnergyVad()
    expect(vad.push(block(false), 16000)).toBe('still')
  })

  it('erkennt den Sprechbeginn ab Schwellwert', () => {
    const vad = createEnergyVad()
    expect(vad.push(block(true), 16000)).toBe('spricht')
  })

  it('meldet das Ende erst nach der Nachlaufzeit, nicht bei kurzer Pause', () => {
    const vad = createEnergyVad({ hangoverMs: 500 })
    vad.push(block(true), 16000)
    // 100 ms Stille — zu kurz für ein Satzende
    expect(vad.push(block(false, 1600), 16000)).toBe('spricht')
    // weitere 500 ms Stille → Ende
    expect(vad.push(block(false, 8000), 16000)).toBe('ende')
  })

  it('nach dem Ende beginnt ein neuer Zyklus', () => {
    const vad = createEnergyVad({ hangoverMs: 100 })
    vad.push(block(true), 16000)
    vad.push(block(false, 8000), 16000)
    expect(vad.push(block(true), 16000)).toBe('spricht')
  })

  it('reset setzt den Zustand zurück', () => {
    const vad = createEnergyVad()
    vad.push(block(true), 16000)
    vad.reset()
    expect(vad.push(block(false), 16000)).toBe('still')
  })
})
```

- [ ] **Step 2: Tests laufen lassen — müssen FEHLSCHLAGEN**

Run: `npm test`
Expected: FAIL — `Cannot find module './energyVad'`

- [ ] **Step 3: `src/lib/energyVad.ts` schreiben**

```ts
/**
 * Energie-basierte Sprecherkennung (VAD): gleitender RMS über die Mikrofon-Samples,
 * Schwelle plus Nachlaufzeit. Bewusst simpel und abhängigkeitsfrei — die Stufe ist
 * isoliert, damit Silero-VAD (wie im HF-Vorbild) später ein Austausch ist.
 */

export type VadZustand = 'still' | 'spricht' | 'ende'

interface VadOptionen {
  /** RMS-Schwelle, ab der Sprache angenommen wird. */
  schwelle?: number
  /** Stille-Dauer in ms, nach der das Sprachende gemeldet wird. */
  hangoverMs?: number
}

export function createEnergyVad({ schwelle = 0.02, hangoverMs = 700 }: VadOptionen = {}) {
  let spricht = false
  let stilleMs = 0

  return {
    /** Verarbeitet einen Sample-Block und liefert den Zustandswechsel. */
    push(samples: Float32Array, rate: number): VadZustand {
      let summe = 0
      for (let i = 0; i < samples.length; i += 1) summe += samples[i] * samples[i]
      const rms = Math.sqrt(summe / Math.max(1, samples.length))
      const blockMs = (samples.length / rate) * 1000

      if (rms >= schwelle) {
        spricht = true
        stilleMs = 0
        return 'spricht'
      }
      if (!spricht) return 'still'

      stilleMs += blockMs
      if (stilleMs >= hangoverMs) {
        spricht = false
        stilleMs = 0
        return 'ende'
      }
      return 'spricht'
    },
    reset() {
      spricht = false
      stilleMs = 0
    },
  }
}
```

- [ ] **Step 4: `src/lib/s2sSession.ts` schreiben**

```ts
/**
 * Speech-to-Speech-Session im Browser: Mikrofon → VAD → /api/s2s → Audio-Queue.
 * Der Audio-Puffer ist zugleich der Sicherheitspuffer (Broadcast-Delay): bei einem
 * Abbruch wird alles verworfen, was noch nicht gespielt wurde.
 */
import { createEnergyVad } from './energyVad'

export type SessionZustand = 'aus' | 'hoert_zu' | 'denkt' | 'spricht'

export interface S2SEreignis {
  type: 'stage' | 'transcript' | 'text' | 'audio' | 'abort' | 'done'
  key?: string
  status?: 'aktiv' | 'fertig' | 'fehler'
  ms?: number
  detail?: string
  text?: string
  chunk?: string
  index?: number
  wavBase64?: string
  kind?: 'opener' | 'answer' | 'script' | 'pivot'
  grund?: string
  totalMs?: number
  decision?: string
}

interface SessionOptionen {
  /** Payload-Zusatz für /api/s2s (ageBand, models, systemPrompt, blockPatterns, sessionId). */
  payload: () => Record<string, unknown>
  onEreignis: (ereignis: S2SEreignis) => void
  onZustand: (zustand: SessionZustand) => void
  onFehler: (meldung: string) => void
}

const wavAusFloat = (samples: Float32Array, rate: number): string => {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const schreibe = (pos: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(pos + i, text.charCodeAt(i))
  }
  schreibe(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  schreibe(8, 'WAVE')
  schreibe(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  schreibe(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i += 1) {
    const c = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, c < 0 ? c * 0x8000 : c * 0x7fff, true)
  }
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

export class S2SSession {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private micAnalyser: AnalyserNode | null = null
  private outAnalyser: AnalyserNode | null = null
  private vad = createEnergyVad()
  /** Gesammelte Mikrofon-Blöcke des laufenden Turns — einziges Aufnahme-Feld. */
  private bloecke: Float32Array[] = []
  private laeuft = false
  private spieltGerade = false
  private queue: string[] = []

  constructor(private opt: SessionOptionen) {}

  /** Analyser für die Globe-Animation: Mikrofon beim Zuhören, Ausgabe beim Sprechen. */
  getAnalyser(zustand: SessionZustand): AnalyserNode | null {
    return zustand === 'spricht' ? this.outAnalyser : this.micAnalyser
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
    } catch {
      this.opt.onFehler('Kein Mikrofon-Zugriff — bitte im Browser erlauben.')
      return
    }
    this.ctx = new AudioContext()
    this.micAnalyser = this.ctx.createAnalyser()
    this.outAnalyser = this.ctx.createAnalyser()
    this.outAnalyser.connect(this.ctx.destination)
    const quelle = this.ctx.createMediaStreamSource(this.stream)
    quelle.connect(this.micAnalyser)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (ev) => {
      if (!this.laeuft || this.spieltGerade) return // während der Ausgabe nicht mithören
      const block = new Float32Array(ev.inputBuffer.getChannelData(0))
      this.bloecke.push(block)
      const zustand = this.vad.push(block, this.ctx!.sampleRate)
      if (zustand === 'ende') void this.turnSenden()
    }
    quelle.connect(this.processor)
    this.processor.connect(this.ctx.destination)
    this.laeuft = true
    this.opt.onZustand('hoert_zu')
  }

  stop(): void {
    this.laeuft = false
    this.queue = []
    this.spieltGerade = false
    this.processor?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.ctx = null
    this.bloecke = []
    this.vad.reset()
    this.opt.onZustand('aus')
  }

  /** Nimmt das Aufgenommene, schickt es an /api/s2s und verarbeitet den Ereignis-Stream. */
  private async turnSenden(): Promise<void> {
    const bloecke = this.bloecke
    this.bloecke = []
    const gesamt = bloecke.reduce((n, c) => n + c.length, 0)
    if (gesamt < 4000) return // zu kurz: Rascheln, kein Satz
    const pcm = new Float32Array(gesamt)
    let offset = 0
    for (const block of bloecke) {
      pcm.set(block, offset)
      offset += block.length
    }
    const rate = this.ctx?.sampleRate ?? 48000
    const ziel = 16000
    const faktor = rate / ziel
    const laenge = Math.floor(pcm.length / faktor)
    const down = new Float32Array(laenge)
    for (let i = 0; i < laenge; i += 1) {
      const von = Math.floor(i * faktor)
      const bis = Math.min(Math.floor((i + 1) * faktor), pcm.length)
      let summe = 0
      for (let j = von; j < bis; j += 1) summe += pcm[j]
      down[i] = bis > von ? summe / (bis - von) : 0
    }

    this.opt.onZustand('denkt')
    const res = await fetch('/api/s2s', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...this.opt.payload(), audio: wavAusFloat(down, ziel) }),
    })
    if (!res.body) {
      this.opt.onFehler('Kein Stream vom Server erhalten.')
      this.opt.onZustand('hoert_zu')
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let puffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      puffer += decoder.decode(value, { stream: true })
      let grenze
      while ((grenze = puffer.indexOf('\n')) !== -1) {
        const zeile = puffer.slice(0, grenze).trim()
        puffer = puffer.slice(grenze + 1)
        if (!zeile) continue
        const ereignis: S2SEreignis = JSON.parse(zeile)
        this.opt.onEreignis(ereignis)
        if (ereignis.type === 'audio' && ereignis.wavBase64) {
          this.queue.push(ereignis.wavBase64)
          void this.queueAbspielen()
        }
        if (ereignis.type === 'abort') this.queue = [] // Puffer verwerfen, Pivot folgt
      }
    }
    if (this.laeuft && !this.spieltGerade) this.opt.onZustand('hoert_zu')
  }

  /** Spielt die Warteschlange nacheinander ab und meldet die Zustände. */
  private async queueAbspielen(): Promise<void> {
    if (this.spieltGerade || !this.ctx) return
    this.spieltGerade = true
    this.opt.onZustand('spricht')
    while (this.queue.length > 0) {
      const wav = this.queue.shift()!
      const bytes = Uint8Array.from(atob(wav), (c) => c.charCodeAt(0))
      try {
        const puffer = await this.ctx.decodeAudioData(bytes.buffer)
        await new Promise<void>((fertig) => {
          const quelle = this.ctx!.createBufferSource()
          quelle.buffer = puffer
          quelle.connect(this.outAnalyser!)
          quelle.onended = () => fertig()
          quelle.start()
        })
      } catch {
        // defektes Audio überspringen statt die Session zu killen
      }
    }
    this.spieltGerade = false
    this.vad.reset()
    if (this.laeuft) this.opt.onZustand('hoert_zu')
  }
}
```

Hinweis: `ScriptProcessorNode` ist als veraltet markiert, funktioniert aber in allen Zielbrowsern und wird im Projekt bereits so genutzt (`src/lib/recorder.ts`) — bewusst beibehalten, um keine AudioWorklet-Datei einführen zu müssen. Ob tatsächlich Audio ankommt, zeigt sich am `transcript`-Ereignis im manuellen Sprachtest (Task 6, Step 4).

- [ ] **Step 5: Tests laufen lassen — müssen PASSEN**

Run: `npm test`
Expected: PASS (bestehende + 5 neue VAD-Tests).

- [ ] **Step 6: Gates + Commit + Push**

```bash
npx tsc -b && npm run build && npm test
git add src/lib/energyVad.ts src/lib/energyVad.test.ts src/lib/s2sSession.ts
git commit -m "Client-Session für Speech-to-Speech: VAD, Stream-Verarbeitung, Audio-Queue

Energie-basierte Sprecherkennung (getestet, Silero später austauschbar),
NDJSON-Stream-Leser und Abspiel-Queue, deren Puffer bei einem Abbruch
verworfen wird (Broadcast-Delay-Prinzip).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: VoiceGlobe

**Files:**
- Create: `src/components/VoiceGlobe.tsx`

**Interfaces:**
- Consumes: `AnalyserNode | null` (aus `S2SSession.getAnalyser`), `SessionZustand` aus `src/lib/s2sSession.ts`.
- Produces: `<VoiceGlobe zustand={...} analyser={...} />` — Task 6 rendert das.

- [ ] **Step 1: Komponente schreiben** — `src/components/VoiceGlobe.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { SessionZustand } from '../lib/s2sSession'

interface Props {
  zustand: SessionZustand
  analyser: AnalyserNode | null
}

const FARBE: Record<SessionZustand, string> = {
  aus: 'var(--muted-foreground)',
  hoert_zu: 'var(--status-ok)',
  denkt: 'var(--status-warn)',
  spricht: 'var(--chart-2)',
}

const BESCHRIFTUNG: Record<SessionZustand, string> = {
  aus: 'aus',
  hoert_zu: 'hört zu',
  denkt: 'denkt nach',
  spricht: 'spricht',
}

/** Sprach-Globe: SVG-Sphäre, deren Ringe mit der Amplitude atmen.
 *  Beim Zuhören folgt sie dem Mikrofon, beim Sprechen der Ausgabe. */
export function VoiceGlobe({ zustand, analyser }: Props) {
  const [pegel, setPegel] = useState(0)
  const [phase, setPhase] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const daten = new Uint8Array(analyser?.frequencyBinCount ?? 32)
    const tick = () => {
      if (analyser && zustand !== 'aus') {
        analyser.getByteFrequencyData(daten)
        let summe = 0
        for (let i = 0; i < daten.length; i += 1) summe += daten[i]
        setPegel(Math.min(1, summe / daten.length / 128))
      } else {
        setPegel(0)
      }
      setPhase((p) => (p + 0.6) % 360)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser, zustand])

  const farbe = FARBE[zustand]
  const aktiv = zustand !== 'aus'
  // „denkt" hat kein Audiosignal — dort atmet der Globe von selbst
  const staerke = zustand === 'denkt' ? 0.35 + 0.15 * Math.sin((phase * Math.PI) / 90) : pegel
  const radius = 60 + staerke * 22

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 240 240" className="h-56 w-56" role="img" aria-label={`Sprachstatus: ${BESCHRIFTUNG[zustand]}`}>
        {/* Aussenringe reagieren auf den Pegel */}
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="120" cy="120"
            r={radius + i * 14 + staerke * i * 10}
            fill="none"
            stroke={farbe}
            strokeWidth={1}
            opacity={aktiv ? 0.35 - i * 0.1 : 0.12}
          />
        ))}
        {/* Sphäre */}
        <circle cx="120" cy="120" r={radius} fill={farbe} opacity={aktiv ? 0.16 : 0.06} />
        <circle cx="120" cy="120" r={radius} fill="none" stroke={farbe} strokeWidth={1.5} opacity={aktiv ? 0.9 : 0.3} />
        {/* Längengrade: rotieren langsam, das macht die Kugel lesbar */}
        {[0.35, 0.7].map((f, i) => (
          <ellipse
            key={i}
            cx="120" cy="120"
            rx={radius * f * (0.6 + 0.4 * Math.abs(Math.cos((phase * Math.PI) / 180)))}
            ry={radius}
            fill="none" stroke={farbe} strokeWidth={1} opacity={aktiv ? 0.45 : 0.15}
          />
        ))}
        {/* Breitengrade */}
        {[-0.5, 0, 0.5].map((f, i) => (
          <ellipse
            key={i}
            cx="120" cy={120 + radius * f}
            rx={radius * Math.sqrt(Math.max(0.05, 1 - f * f))} ry={radius * 0.14}
            fill="none" stroke={farbe} strokeWidth={1} opacity={aktiv ? 0.35 : 0.12}
          />
        ))}
      </svg>
      <span className="font-mono text-[0.62rem] uppercase tracking-widest" style={{ color: farbe }}>
        {BESCHRIFTUNG[zustand]}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: keine Fehler.

- [ ] **Step 3: Gates + Commit + Push**

```bash
npx tsc -b && npm run build && npm test
git add src/components/VoiceGlobe.tsx
git commit -m "VoiceGlobe: SVG-Sphäre, die mit der Sprach-Amplitude atmet

Vier Zustände (aus, hört zu, denkt, spricht) über Theme-Tokens; Pegel
kommt aus dem AnalyserNode, „denkt\" atmet ohne Audiosignal von selbst.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 6: Live-Diagramm, Splitscreen-Ansicht und Verdrahtung

**Files:**
- Create: `src/components/S2SDiagram.tsx`
- Create: `src/components/S2SView.tsx`
- Modify: `src/App.tsx` (View-Typ, Header-Buttons, Render-Zweig)

**Interfaces:**
- Consumes: `S2SSession`, `S2SEreignis`, `SessionZustand` aus `src/lib/s2sSession.ts`; `VoiceGlobe` aus Task 5; `captureScenario`, `buildRunPayload` aus `src/scenarios.ts`.
- Produces: vierter View `'s2s'` in `App.tsx`.

- [ ] **Step 1: `src/components/S2SDiagram.tsx` schreiben**

```tsx
import type { S2SEreignis } from '../lib/s2sSession'

export interface StufenZustand {
  status: 'ruhend' | 'aktiv' | 'fertig' | 'fehler'
  ms?: number
  detail?: string
}

interface Props {
  stufen: Record<string, StufenZustand>
  warteschlange: number
}

/** Reihenfolge und Beschriftung der Kette — bewusst fest, das ist die Architektur. */
const STUFEN: { key: string; label: string; hinweis: string }[] = [
  { key: 'vad', label: 'VAD', hinweis: 'Sprecherkennung im Client (energie-basiert)' },
  { key: 'stt', label: 'STT', hinweis: 'whisper.cpp, lokal' },
  { key: 'opener', label: 'Opener', hinweis: 'vorsynthetisiert — überbrückt die Denkzeit' },
  { key: 'triage', label: 'Triage', hinweis: 'Intent, Risiko, Emotion' },
  { key: 'router', label: 'Router', hinweis: 'deterministisch, fail-closed' },
  { key: 'planner', label: 'Teaching Planner', hinweis: 'Strategie, kein LLM' },
  { key: 'main', label: 'Haupt-LLM (Stream)', hinweis: 'generiert satzweise' },
  { key: 'guard', label: 'Guard (Satz 1)', hinweis: 'gibt den ersten Satz frei' },
  { key: 'safety', label: 'Vollprüfung', hinweis: 'gibt alle weiteren Sätze frei' },
  { key: 'script', label: 'Kuratierte Antwort', hinweis: 'sensibler Pfad, vorsynthetisiert' },
]

const FARBE: Record<StufenZustand['status'], string> = {
  ruhend: 'var(--muted-foreground)',
  aktiv: 'var(--status-warn)',
  fertig: 'var(--status-ok)',
  fehler: 'var(--status-risk)',
}

/** Live-Flussdiagramm der s2s-Kette: mehrere Stufen können gleichzeitig aktiv sein. */
export function S2SDiagram({ stufen, warteschlange }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">
          Speech-to-Speech · live
        </h2>
        <span className="font-mono text-[0.62rem] text-muted-foreground">
          Audio-Puffer: {warteschlange}
        </span>
      </div>

      {STUFEN.map((stufe, i) => {
        const zustand = stufen[stufe.key] ?? { status: 'ruhend' as const }
        const farbe = FARBE[zustand.status]
        return (
          <div key={stufe.key} className="flex flex-col">
            <div
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 transition-colors"
              style={{ borderColor: zustand.status === 'ruhend' ? 'var(--border)' : farbe }}
            >
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: farbe, opacity: zustand.status === 'aktiv' ? 1 : 0.5 }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.84rem] font-semibold">{stufe.label}</span>
                  {zustand.ms !== undefined && (
                    <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground">{zustand.ms} ms</span>
                  )}
                </div>
                <p className="truncate text-[0.66rem] text-muted-foreground">{zustand.detail ?? stufe.hinweis}</p>
              </div>
            </div>
            {i < STUFEN.length - 1 && <div className="ml-[1.05rem] h-2 w-px bg-border" />}
          </div>
        )
      })}

      <p className="mt-2 text-[0.6rem] leading-tight text-muted-foreground/70">
        Entkoppelte Stufen nach dem Muster von huggingface/speech-to-speech — gesprochen wird bereits, während
        weiter generiert wird. Der erste Satz braucht die Guard-Freigabe, alle weiteren die Vollprüfung.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: `src/components/S2SView.tsx` schreiben**

```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ArchNode } from '../types'
import { captureScenario, buildRunPayload } from '../scenarios'
import { S2SSession } from '../lib/s2sSession'
import type { S2SEreignis, SessionZustand } from '../lib/s2sSession'
import { VoiceGlobe } from './VoiceGlobe'
import { S2SDiagram } from './S2SDiagram'
import type { StufenZustand } from './S2SDiagram'
import { Button, Select } from './ui'

interface Nachricht {
  rolle: 'kind' | 'begleiter'
  text: string
}

/** Splitscreen: links die live laufende Architektur, rechts Globe und Gesprächsverlauf. */
export function S2SView({ nodes }: { nodes: ArchNode[] }) {
  const [zustand, setZustand] = useState<SessionZustand>('aus')
  const [stufen, setStufen] = useState<Record<string, StufenZustand>>({})
  const [verlauf, setVerlauf] = useState<Nachricht[]>([])
  const [ageBand, setAgeBand] = useState<'4-5' | '6-7'>('4-5')
  const [fehler, setFehler] = useState<string | null>(null)
  const [warteschlange, setWarteschlange] = useState(0)
  const sessionRef = useRef<S2SSession | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const verarbeite = useCallback((ereignis: S2SEreignis) => {
    if (ereignis.type === 'stage' && ereignis.key) {
      setStufen((alt) => ({
        ...alt,
        [ereignis.key!]: {
          status: ereignis.status === 'aktiv' ? 'aktiv' : ereignis.status === 'fehler' ? 'fehler' : 'fertig',
          ms: ereignis.ms,
          detail: ereignis.detail,
        },
      }))
    }
    if (ereignis.type === 'transcript' && ereignis.text) {
      setVerlauf((alt) => [...alt, { rolle: 'kind', text: ereignis.text! }])
    }
    if (ereignis.type === 'text' && ereignis.chunk) {
      setVerlauf((alt) => {
        const letzte = alt[alt.length - 1]
        if (letzte?.rolle === 'begleiter') {
          return [...alt.slice(0, -1), { rolle: 'begleiter', text: `${letzte.text} ${ereignis.chunk}`.trim() }]
        }
        return [...alt, { rolle: 'begleiter', text: ereignis.chunk! }]
      })
      setWarteschlange((n) => n + 1)
    }
    if (ereignis.type === 'abort') {
      setFehler(`Abgebrochen: ${ereignis.grund ?? 'unbekannt'}`)
      setWarteschlange(0)
    }
    if (ereignis.type === 'done') setWarteschlange(0)
  }, [])

  const payload = useCallback(() => {
    const szenario = captureScenario(nodes, 's2s')
    return { ...buildRunPayload(szenario, '', ageBand), sessionId: 's2s-live' }
  }, [nodes, ageBand])

  const umschalten = useCallback(async () => {
    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
      setAnalyser(null)
      return
    }
    setFehler(null)
    setStufen({})
    const session = new S2SSession({
      payload,
      onEreignis: verarbeite,
      onZustand: (z) => {
        setZustand(z)
        setAnalyser(sessionRef.current?.getAnalyser(z) ?? null)
      },
      onFehler: (m) => setFehler(m),
    })
    sessionRef.current = session
    await session.start()
    setAnalyser(session.getAnalyser('hoert_zu'))
  }, [payload, verarbeite])

  const aktiv = zustand !== 'aus'

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 border-r">
        <S2SDiagram stufen={stufen} warteschlange={warteschlange} />
      </div>

      <div className="flex w-[46%] min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <span className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">Gespräch</span>
          <Select value={ageBand} onChange={(ev) => setAgeBand(ev.target.value as '4-5' | '6-7')} className="h-7 w-24 text-xs">
            <option value="4-5">4–5 J.</option>
            <option value="6-7">6–7 J.</option>
          </Select>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <VoiceGlobe zustand={zustand} analyser={analyser} />
          <Button onClick={() => void umschalten()}>{aktiv ? '■ Gespräch beenden' : '● Gespräch starten'}</Button>
          {fehler && <p className="max-w-sm text-center text-xs text-status-risk">{fehler}</p>}
          {!aktiv && !fehler && (
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              Ein Druck startet die Session: Das Mikrofon bleibt offen, die Sprecherkennung merkt selbst, wann du
              fertig gesprochen hast. Erneut drücken beendet.
            </p>
          )}
        </div>

        <div className="max-h-[38%] min-h-0 overflow-y-auto border-t px-4 py-3">
          {verlauf.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch kein Gespräch.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {verlauf.map((n, i) => (
                <li key={i} className="text-sm">
                  <span className="mr-2 font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                    {n.rolle === 'kind' ? 'Kind' : '🧸'}
                  </span>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `src/App.tsx` verdrahten**

1. Import ergänzen: `import { S2SView } from './components/S2SView'`
2. View-Typ erweitern (per grep `useState<'canvas' | 'arena' | 'pruefstand'>` finden): `useState<'canvas' | 'arena' | 'pruefstand' | 's2s'>('canvas')`
3. Header-Button-Array (per grep `['canvas', 'arena', 'pruefstand'] as const` finden) um `'s2s'` erweitern und das Label-Ternary ergänzen: `: id === 'pruefstand' ? '🛡 Prüfstand' : '🎙 Speech'`
4. Render-Zweig: den bestehenden Ausdruck um einen weiteren Zweig ergänzen, sodass `view === 's2s'` → `<S2SView nodes={nodes} />` rendert (analog zum `pruefstand`-Zweig).

- [ ] **Step 4: Browser-Verifikation**

Dev-Server via `preview_start` starten, auf „🎙 Speech" klicken. Prüfen:
1. Splitscreen erscheint: links die Stufenliste (alle ruhend), rechts der Globe im Zustand „aus".
2. Konsole und Netzwerk ohne Fehler (`read_console_messages`).
3. Globe rendert und ist nicht statisch schwarz; Beschriftung zeigt „aus".
4. Screenshot als Beleg im Bericht.

**Kein Mikrofon-Test nötig** — der Browser-Pane erlaubt keinen Mikrofonzugriff; der End-to-End-Sprachtest passiert manuell durch den Auftraggeber im echten Browser. Diesen Umstand im Bericht vermerken.

- [ ] **Step 5: Gates + Commit + Push**

```bash
npx tsc -b && npm run build && npm test
git add src/components/S2SDiagram.tsx src/components/S2SView.tsx src/App.tsx
git commit -m "Speech-Ansicht: Splitscreen aus Live-Diagramm und Globe-Chat

Vierter View: links die s2s-Kette mit Live-Zuständen, Latenzen und
Puffer-Füllstand, rechts der VoiceGlobe mit Start/Stop-Knopf und
Gesprächsverlauf. Läuft gegen die aktuelle Canvas-Konfiguration.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```
