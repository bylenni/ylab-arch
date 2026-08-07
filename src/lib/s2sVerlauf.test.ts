/**
 * Deckt genau den Review-Befund ab, den die alte Reihenfolge-Heuristik ("erster
 * text-Chunk pro Turn ist der Opener") verfehlt hat: Im STT-Fehlerpfad gibt es
 * keinen Opener, der erste (und einzige) kuratierte Chunk ist bereits die echte
 * Rückfrage — die muss im Verlauf erscheinen.
 */
import { describe, it, expect } from 'vitest'
import type { S2SEreignis } from './s2sSession'
import { ANFANGS_VERLAUF, reduziereEreignis, type VerlaufZustand } from './s2sVerlauf'

const verlaufAus = (ereignisse: S2SEreignis[]): VerlaufZustand =>
  ereignisse.reduce(reduziereEreignis, ANFANGS_VERLAUF)

describe('reduziereEreignis — Gesprächsverlauf aus dem S2S-Ereignisstrom', () => {
  it('STT-Fehlerpfad: Rückfrage ohne vorherigen Opener erscheint im Verlauf', () => {
    const { verlauf } = verlaufAus([
      { type: 'stage', key: 'stt', status: 'aktiv' },
      { type: 'transcript', text: '' },
      { type: 'text', chunk: 'Magst du das nochmal sagen?', index: -1 },
      { type: 'audio', wavBase64: 'xxx', index: -1, kind: 'script' },
      { type: 'done', totalMs: 10 },
    ])

    expect(verlauf).toEqual([{ rolle: 'begleiter', text: 'Magst du das nochmal sagen?' }])
  })

  it('Normalpfad: Opener wird verworfen, Antwort-Chunks werden zu einer Zeile zusammengeführt', () => {
    const { verlauf, ausstehenderKuratierterText } = verlaufAus([
      { type: 'stage', key: 'stt', status: 'aktiv' },
      { type: 'transcript', text: 'Warum ist der Himmel blau?' },
      { type: 'text', chunk: 'Hmm, lass mich kurz überlegen …', index: -1 },
      { type: 'audio', wavBase64: 'opener', index: -1, kind: 'opener' },
      { type: 'text', chunk: 'Der Himmel ist blau,', index: 0 },
      { type: 'audio', wavBase64: 'a0', index: 0, kind: 'answer' },
      { type: 'text', chunk: 'weil die Luft blaues Licht streut.', index: 1 },
      { type: 'audio', wavBase64: 'a1', index: 1, kind: 'answer' },
      { type: 'done', totalMs: 900 },
    ])

    expect(verlauf).toEqual([
      { rolle: 'kind', text: 'Warum ist der Himmel blau?' },
      { rolle: 'begleiter', text: 'Der Himmel ist blau, weil die Luft blaues Licht streut.' },
    ])
    expect(ausstehenderKuratierterText).toBeNull()
  })

  it('Sensibler Pfad: kuratierte Antwort nach dem Opener erscheint ebenfalls im Verlauf', () => {
    const { verlauf } = verlaufAus([
      { type: 'text', chunk: 'Hmm, lass mich kurz überlegen …', index: -1 },
      { type: 'audio', wavBase64: 'opener', index: -1, kind: 'opener' },
      { type: 'text', chunk: 'Das ist eine wichtige Frage — lass uns mit einem Erwachsenen sprechen.', index: -1 },
      { type: 'audio', wavBase64: 'script', index: -1, kind: 'script' },
      { type: 'done', totalMs: 200, decision: 'sensibel' },
    ])

    expect(verlauf).toEqual([
      { rolle: 'begleiter', text: 'Das ist eine wichtige Frage — lass uns mit einem Erwachsenen sprechen.' },
    ])
  })

  it('Abbruch: Pivot-Text nach dem abort-Ereignis erscheint im Verlauf (an den bisherigen Chunk angehängt — unverändertes Merge-Verhalten, nicht Teil dieses Fixes)', () => {
    const { verlauf } = verlaufAus([
      { type: 'text', chunk: 'Ups, lass uns mal etwas anderes ausprobieren.', index: 0 },
      { type: 'audio', wavBase64: 'a0', index: 0, kind: 'answer' },
      { type: 'abort', grund: 'Pattern-Treffer' },
      { type: 'text', chunk: 'Lass uns über etwas Schönes reden.', index: -1 },
      { type: 'audio', wavBase64: 'pivot', index: -1, kind: 'pivot' },
      { type: 'done', totalMs: 500, decision: 'abgebrochen' },
    ])

    expect(verlauf).toEqual([
      {
        rolle: 'begleiter',
        text: 'Ups, lass uns mal etwas anderes ausprobieren. Lass uns über etwas Schönes reden.',
      },
    ])
  })
})
