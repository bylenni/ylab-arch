/**
 * Reine Bausteine der Speech-to-Speech-Kette: Satz-Chunker und Safety-Gate.
 * Bewusst ohne I/O — die Sicherheits-Invariante („kein Audio ohne bestandene
 * Prüfung") ist damit als Zustandsautomat testbar statt nur behauptet.
 */

/** Bekannte Abkürzungsformen, jeweils MIT abschließendem Punkt. */
const ABKUERZUNGEN = ['z. b.', 'z.b.', 'u. a.', 'u.a.', 'd. h.', 'd.h.', 'ca.', 'bzw.', 'ggf.', 'usw.', 'etc.', 'dr.', 'nr.', 'evtl.']

/** Ist der Punkt an Position i ein echtes Satzende? */
function istSatzende(text, i) {
  const zeichen = text[i]
  if (zeichen === '!' || zeichen === '?') return true
  if (zeichen !== '.') return false
  // Dezimalzahl: Ziffer davor UND danach
  if (/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) return false
  // Regel A: erster Punkt einer Mehrwort-Abkürzung — danach folgt ein Einzelbuchstabe + Punkt
  const danach = text.slice(i + 1)
  if (/^\s*[A-Za-zÄÖÜäöüß]\./.test(danach)) return false
  // Regel B: bekannte Abkürzung endet genau hier
  const bisHier = text.slice(0, i + 1).toLowerCase()
  for (const form of ABKUERZUNGEN) {
    if (bisHier.endsWith(form)) {
      const vorZeichen = bisHier[bisHier.length - form.length - 1]
      if (vorZeichen === undefined || /\s/.test(vorZeichen)) return false
    }
  }
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
        // Nur einen reinen Interpunktions-Cluster-Rest verwerfen (z. B. isoliertes "!"),
        // nicht beliebigen symbolischen Inhalt (Emoji, Währungs-/Mathezeichen etc.).
        if (satz && !/^[.!?,;:…]+$/.test(satz)) saetze.push(satz)
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
