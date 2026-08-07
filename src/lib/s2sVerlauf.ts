/**
 * Reine Ableitung des Gesprächsverlaufs aus dem S2S-Ereignisstrom — ausgelagert aus
 * S2SView, damit die Opener/Kuratiert-Unterscheidung ohne React-Test-Infrastruktur
 * getestet werden kann.
 *
 * Kuratierte Chunks (Opener, Skript-Pfad, Pivot beim Abbruch) tragen alle `index: -1`
 * und lassen sich beim `text`-Ereignis NICHT unterscheiden — `S2SEreignis` trägt `kind`
 * laut Server-Vertrag (server/s2s.mjs) erst am nachfolgenden `audio`-Ereignis. Eine
 * Reihenfolge-Heuristik ("der erste text-Chunk pro Turn ist der Opener") greift daher
 * im STT-Fehlerpfad daneben: Versteht whisper nichts, sendet server/index.mjs die
 * Rückfrage (kind 'script') OHNE vorherigen Opener — sie wäre als "erster Chunk" fälschlich
 * verworfen worden. Deshalb: den Text bei `index: -1` zwischenspeichern und erst beim
 * zugehörigen `audio`-Ereignis anhand von `kind` entscheiden.
 */
import type { S2SEreignis } from './s2sSession'

export interface Nachricht {
  rolle: 'kind' | 'begleiter'
  text: string
}

export interface VerlaufZustand {
  verlauf: Nachricht[]
  /** Text eines `text`-Ereignisses mit index: -1, dessen kind (aus dem `audio`-Ereignis,
   *  das als Nächstes kommt) noch aussteht. */
  ausstehenderKuratierterText: string | null
}

export const ANFANGS_VERLAUF: VerlaufZustand = { verlauf: [], ausstehenderKuratierterText: null }

/** Hängt einen Begleiter-Chunk an — mehrere Chunks derselben Antwort werden zu einer Zeile zusammengeführt. */
function begleiterAnhaengen(verlauf: Nachricht[], text: string): Nachricht[] {
  const letzte = verlauf[verlauf.length - 1]
  if (letzte?.rolle === 'begleiter') {
    return [...verlauf.slice(0, -1), { rolle: 'begleiter', text: `${letzte.text} ${text}`.trim() }]
  }
  return [...verlauf, { rolle: 'begleiter', text }]
}

/** Reduziert ein einzelnes S2S-Ereignis in den Gesprächsverlauf. */
export function reduziereEreignis(zustand: VerlaufZustand, ereignis: S2SEreignis): VerlaufZustand {
  if (ereignis.type === 'transcript' && ereignis.text) {
    return { ...zustand, verlauf: [...zustand.verlauf, { rolle: 'kind', text: ereignis.text }] }
  }

  if (ereignis.type === 'text' && ereignis.chunk) {
    if (ereignis.index === -1) return { ...zustand, ausstehenderKuratierterText: ereignis.chunk }
    return { ...zustand, verlauf: begleiterAnhaengen(zustand.verlauf, ereignis.chunk) }
  }

  if (ereignis.type === 'audio' && ereignis.index === -1 && zustand.ausstehenderKuratierterText !== null) {
    const text = zustand.ausstehenderKuratierterText
    // Reiner Denkzeit-Opener: kein Gesprächsinhalt, wird verworfen. Alles andere mit
    // index: -1 (Skript-Pfad, Pivot) ist eine echte kuratierte Antwort.
    if (ereignis.kind === 'opener') return { ...zustand, ausstehenderKuratierterText: null }
    return { verlauf: begleiterAnhaengen(zustand.verlauf, text), ausstehenderKuratierterText: null }
  }

  return zustand
}
