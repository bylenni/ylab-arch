// Unit-Tests für die deterministische Planner-Logik — jede Regel ist ein harter Testfall.
import { describe, it, expect } from 'vitest'
import {
  planStrategy, STRATEGIES, emptyLearnerState, recordExposure, recordOutcome,
  extractExpectedAnswer, containsNumber, detectSkill, detectFrustration,
} from './teachingPlanner.mjs'

describe('planStrategy — Regelwerk in Prioritätsordnung', () => {
  const base = { ageBand: '6-7', skill: 'mathe.grundrechnen', frustration: false }

  it('Regel 1: Frustsignal schlägt alles — auch Mastery', () => {
    const state = emptyLearnerState()
    state.skills['mathe.grundrechnen'] = { exposures: 5, consecutiveFrustrations: 0, successes: 3, mastered: true }
    const plan = planStrategy({ ...base, state, frustration: true })
    expect(plan.strategie).toBe(STRATEGIES.LOESUNG)
  })

  it('Regel 1: zwei Fehlversuche in Folge lösen die Frustbremse aus', () => {
    const state = emptyLearnerState()
    state.skills['mathe.grundrechnen'] = { exposures: 2, consecutiveFrustrations: 2, successes: 0, mastered: false }
    expect(planStrategy({ ...base, state }).strategie).toBe(STRATEGIES.LOESUNG)
  })

  it('Regel 2: gefestigter Skill → Schwierigkeit steigern', () => {
    const state = emptyLearnerState()
    state.skills['mathe.grundrechnen'] = { exposures: 3, consecutiveFrustrations: 0, successes: 1, mastered: false }
    expect(planStrategy({ ...base, state }).strategie).toBe(STRATEGIES.STEIGERN)
  })

  it('Regel 3: Wiederkehr → Variation', () => {
    const state = emptyLearnerState()
    state.skills['mathe.grundrechnen'] = { exposures: 1, consecutiveFrustrations: 0, successes: 0, mastered: false }
    expect(planStrategy({ ...base, state }).strategie).toBe(STRATEGIES.VARIATION)
  })

  it('Regel 4: Erstkontakt altersabhängig — 4-5 Hinweis, 6-7 sokratisch', () => {
    expect(planStrategy({ ...base, ageBand: '4-5', state: emptyLearnerState() }).strategie).toBe(STRATEGIES.HINWEIS)
    expect(planStrategy({ ...base, state: emptyLearnerState() }).strategie).toBe(STRATEGIES.SOKRATISCH)
  })

  it('ohne erkannten Skill: sanfter Default (Hinweis)', () => {
    expect(planStrategy({ ...base, skill: null, state: emptyLearnerState() }).strategie).toBe(STRATEGIES.HINWEIS)
  })
})

describe('recordOutcome — Erfolgssignal und Mastery', () => {
  it('Mastery nach 3 Selbstlösungen', () => {
    const state = emptyLearnerState()
    recordOutcome(state, 'mathe.grundrechnen', true)
    recordOutcome(state, 'mathe.grundrechnen', true)
    expect(state.skills['mathe.grundrechnen'].mastered).toBe(false)
    recordOutcome(state, 'mathe.grundrechnen', true)
    expect(state.skills['mathe.grundrechnen'].mastered).toBe(true)
  })

  it('Erfolg setzt den Frust-Zähler zurück', () => {
    const state = emptyLearnerState()
    recordOutcome(state, 'mathe.grundrechnen', false)
    recordOutcome(state, 'mathe.grundrechnen', false)
    expect(state.skills['mathe.grundrechnen'].consecutiveFrustrations).toBe(2)
    recordOutcome(state, 'mathe.grundrechnen', true)
    expect(state.skills['mathe.grundrechnen'].consecutiveFrustrations).toBe(0)
  })

  it('recordExposure zählt hoch und führt den Frust-Zähler', () => {
    const state = emptyLearnerState()
    recordExposure(state, 'mathe.grundrechnen', false)
    recordExposure(state, 'mathe.grundrechnen', true)
    expect(state.skills['mathe.grundrechnen'].exposures).toBe(2)
    expect(state.skills['mathe.grundrechnen'].consecutiveFrustrations).toBe(1)
  })
})

describe('extractExpectedAnswer — deterministischer Aufgaben-Parser', () => {
  it('Ziffern und Operatoren', () => {
    expect(extractExpectedAnswer('Was ist 3 plus 4?')).toBe(7)
    expect(extractExpectedAnswer('Was ist 10 minus 4?')).toBe(6)
    expect(extractExpectedAnswer('Was ist 3 mal 5?')).toBe(15)
  })

  it('deutsche Zahlwörter', () => {
    expect(extractExpectedAnswer('Was ist drei plus vier?')).toBe(7)
    expect(extractExpectedAnswer('Was ergibt zwölf minus fünf?')).toBe(7)
  })

  it('letzte Aufgabe gewinnt — die NEU gestellte Aufgabe zählt', () => {
    expect(extractExpectedAnswer('3 plus 4 sind sieben! Und was ist 5 plus 2?')).toBe(7)
    expect(extractExpectedAnswer('Super, 2 plus 2 ist vier. Jetzt schwerer: 6 plus 3?')).toBe(9)
  })

  it('kein Treffer und Ergebnis-Grenzen (0–100)', () => {
    expect(extractExpectedAnswer('Erzähl mir eine Geschichte!')).toBe(null)
    expect(extractExpectedAnswer('Was ist 90 mal 90?')).toBe(null)
  })
})

describe('containsNumber — Ziffer oder Zahlwort', () => {
  it('erkennt Ziffer, Zahlwort und Wortgrenzen', () => {
    expect(containsNumber('sieben!', 7)).toBe(true)
    expect(containsNumber('Ich glaube 7', 7)).toBe(true)
    expect(containsNumber('siebzehn', 7)).toBe(false)
    expect(containsNumber('17', 7)).toBe(false)
  })
})

describe('Signal-Heuristiken', () => {
  it('detectSkill erkennt Rechnen, detectFrustration erkennt Kampf', () => {
    expect(detectSkill('Was ist 3 plus 4?')).toBe('mathe.grundrechnen')
    expect(detectSkill('Erzähl was vom Ritter')).toBe(null)
    expect(detectFrustration('Das ist zu schwer!')).toBe(true)
    expect(detectFrustration('Was ist 3 plus 4?')).toBe(false)
  })

  it('detectSkill unterscheidet erzählen (Narrativ) von zählen (Mathe)', () => {
    expect(detectSkill('Zähl mal bis zehn')).toBe('mathe.grundrechnen')
    expect(detectSkill('Erzähl was vom Ritter')).toBe(null)
  })
})
