// Tests für die deterministische Router-Entscheidung — fail-closed ist hier Gesetz.
import { describe, it, expect } from 'vitest'
import { decideRoute, normalizeUtterance } from './router.mjs'

const triageOk = { intent: 'wissensfrage', risiko: false, emotion: false, konfidenz: 0.9 }

describe('decideRoute — fail-closed Router', () => {
  it('unlesbare Triage → sensibel (fail-closed)', () => {
    expect(decideRoute({ triage: null, utterance: 'Warum ist der Himmel blau?', dialogLength: 0, outcome: null })).toBe('sensibel')
  })

  it('Risiko oder Emotion → sensibel', () => {
    expect(decideRoute({ triage: { ...triageOk, risiko: true }, utterance: 'x y z', dialogLength: 0, outcome: null })).toBe('sensibel')
    expect(decideRoute({ triage: { ...triageOk, emotion: true }, utterance: 'x y z', dialogLength: 0, outcome: null })).toBe('sensibel')
  })

  it('niedrige Konfidenz → unklar', () => {
    expect(decideRoute({ triage: { ...triageOk, konfidenz: 0.3 }, utterance: 'Warum ist der Himmel blau?', dialogLength: 0, outcome: null })).toBe('unklar')
  })

  it('Ein-Wort-Äußerung OHNE Kontext → unklar (Erst-Turn-Regel)', () => {
    expect(decideRoute({ triage: triageOk, utterance: 'Papa', dialogLength: 0, outcome: null })).toBe('unklar')
  })

  it('„Ja"-Regression: Ein-Wort-Antwort MIT Dialogkontext → normal', () => {
    // Der Bug vom 2026-07: „Ja" auf eine Rückfrage löste eine erneute Rückfrage aus.
    expect(decideRoute({ triage: triageOk, utterance: 'Ja', dialogLength: 2, outcome: null })).toBe('normal')
  })

  it('erkanntes Antwort-Ergebnis überschreibt unklar — aber NIE sensibel', () => {
    const outcome = { type: 'richtig', expected: 7, skill: 'mathe.grundrechnen' }
    expect(decideRoute({ triage: { ...triageOk, konfidenz: 0.3 }, utterance: 'sieben', dialogLength: 2, outcome })).toBe('normal')
    expect(decideRoute({ triage: { ...triageOk, risiko: true }, utterance: 'sieben', dialogLength: 2, outcome })).toBe('sensibel')
  })

  it('fehlende Konfidenz zählt als 1 → normal', () => {
    expect(decideRoute({ triage: { intent: 'wissensfrage', risiko: false, emotion: false }, utterance: 'Warum ist der Himmel blau?', dialogLength: 0, outcome: null })).toBe('normal')
  })
})

describe('normalizeUtterance — Cache-Key-Normalisierung', () => {
  it('Groß/klein, Satzzeichen und Mehrfach-Leerzeichen fallen weg', () => {
    expect(normalizeUtterance('Warum ist der Himmel blau?')).toBe(normalizeUtterance('  warum ist der  himmel BLAU!! '))
  })
  it('unterschiedliche Fragen bleiben unterschiedlich', () => {
    expect(normalizeUtterance('Warum ist der Himmel blau?')).not.toBe(normalizeUtterance('Warum ist Gras grün?'))
  })
})
