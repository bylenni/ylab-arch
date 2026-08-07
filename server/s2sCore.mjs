/**
 * Reine Bausteine der Speech-to-Speech-Kette: Satz-Chunker und Safety-Gate.
 * Bewusst ohne I/O — die Sicherheits-Invariante („kein Audio ohne bestandene
 * Prüfung") ist damit als Zustandsautomat testbar statt nur behauptet.
 */

/** Abkürzungen, nach denen ein Punkt KEIN Satzende ist. */
const ABKUERZUNGEN = ['z', 'b', 'u', 'a', 'd', 'h', 'ca', 'bzw', 'ggf', 'usw', 'etc', 'dr', 'nr', 'ab', 'evtl']

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
