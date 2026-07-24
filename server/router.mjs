/**
 * Deterministischer Router + Text-Normalisierung — reine Funktionen ohne I/O,
 * aus index.mjs extrahiert, damit sie unit-testbar sind (Prüfstand, Schicht A).
 */

/** Cache-Key-Normalisierung: Groß/klein, Satzzeichen, Mehrfach-Leerzeichen egalisieren. */
export const normalizeUtterance = (text) =>
  text.toLowerCase().trim().replace(/[!?.,;:]+/g, '').replace(/\s+/g, ' ')

/**
 * Fail-closed Router-Entscheidung.
 * Die Wortzahl-Regel gilt NUR für den ersten Turn: ohne Kontext ist ein Einzelwort („Papa")
 * verdächtig — im laufenden Gespräch sind Einwort-Antworten („Ja", „sieben") normal.
 * Ein erkanntes Antwort-Ergebnis überschreibt nur „unklar" — nie „sensibel".
 * @returns {'sensibel'|'unklar'|'normal'}
 */
export function decideRoute({ triage, utterance, dialogLength, outcome }) {
  const tooShortWithoutContext = dialogLength === 0 && utterance.trim().split(/\s+/).length < 2
  let decision = !triage
    ? 'sensibel'
    : triage.risiko || triage.emotion
      ? 'sensibel'
      : Number(triage.konfidenz ?? 1) < 0.5 || tooShortWithoutContext
        ? 'unklar'
        : 'normal'
  if (outcome && decision === 'unklar') decision = 'normal'
  return decision
}
