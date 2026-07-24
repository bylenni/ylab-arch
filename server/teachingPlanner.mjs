/**
 * Teaching Planner — Stufe 1: deterministisches Regelwerk.
 *
 * Entscheidet WIE didaktisch geantwortet wird (Strategie), nicht WAS (Haupt-LLM)
 * und nicht OB (Router). Der Kern ist eine reine Funktion ohne I/O:
 *   (Altersband, Skill, Lernstand, Frustsignal) → Strategie-Direktive
 *
 * Designprinzipien:
 * - Strukturierter Output → jede Regel ist ein harter Unit-/Eval-Test, kein Judge-Ermessen.
 * - Jede Regel trägt ihre Begründung → mit Pädagogen Zeile für Zeile review-bar.
 * - Stufe 2 ersetzt genau EINE Funktion (planStrategy) durch eine gelernte Policy
 *   (Contextual Bandit auf (Zustand, Strategie, Ergebnis)-Tupeln) — Interface bleibt gleich.
 */

export const STRATEGIES = {
  SOKRATISCH: 'sokratische_gegenfrage',
  HINWEIS: 'gestuetzter_hinweis',
  LOESUNG: 'loesung_mit_ermutigung',
  VARIATION: 'wiederholen_variation',
  STEIGERN: 'schwierigkeit_steigern',
}

/* ------------------------------------------------------------------ */
/* Signale (Prototyp: Heuristiken — Ziel: aus Triage-Klassifikator)    */
/* ------------------------------------------------------------------ */

/** Grobe Skill-Erkennung. Ziel: feingranulare Skill-Taxonomie aus dem Triage-Klassifikator. */
export function detectSkill(utterance) {
  const t = utterance.toLowerCase()
  if (/plus|minus|mal |geteilt|rechn|(?<!er)zähl|zahlen/.test(t)) return 'mathe.grundrechnen'
  if (/buchstab|schreibt man|lesen|abc/.test(t)) return 'schrift.buchstaben'
  if (/englisch|heißt .* auf|übersetz/.test(t)) return 'sprache.englisch'
  return null
}

/** Frustsignal in der Äußerung selbst. Ziel: Emotion aus Triage + Prosodie aus dem Audio-Kanal. */
export function detectFrustration(utterance) {
  return /kann ich nicht|zu schwer|keine ahnung|weiß nicht|schaff ich nicht|versteh.* nicht/i.test(utterance)
}

/* ------------------------------------------------------------------ */
/* Lernstand — datensparsam: Zähler pro Skill, keine Transkripte       */
/* ------------------------------------------------------------------ */

export function emptyLearnerState() {
  return { skills: {}, pendingExpectation: null, updatedAt: Date.now() }
}

function skillState(state, skill) {
  state.skills[skill] ??= { exposures: 0, consecutiveFrustrations: 0, successes: 0, mastered: false }
  state.skills[skill].successes ??= 0
  return state.skills[skill]
}

/** Nach jeder neuen Lernfrage aufrufen. */
export function recordExposure(state, skill, frustration) {
  if (!skill) return
  const s = skillState(state, skill)
  s.exposures += 1
  s.consecutiveFrustrations = frustration ? s.consecutiveFrustrations + 1 : 0
  state.updatedAt = Date.now()
}

/** Das Erfolgssignal — das Reward-Signal für Stufe 2 (Contextual Bandit).
 *  Bewusst NICHT als Reward: Nutzungsdauer. Mastery nach 3 Selbstlösungen. */
export function recordOutcome(state, skill, success) {
  if (!skill) return
  const s = skillState(state, skill)
  if (success) {
    s.successes += 1
    s.consecutiveFrustrations = 0
    if (s.successes >= 3) s.mastered = true
  } else {
    s.consecutiveFrustrations += 1
  }
  state.updatedAt = Date.now()
}

/* ------------------------------------------------------------------ */
/* Erwartete Antwort: deterministische Auswertung geschlossener Aufgaben */
/* ------------------------------------------------------------------ */

const NUMBER_WORDS = {
  null: 0, eins: 1, ein: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6,
  sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, dreizehn: 13,
  vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18,
  neunzehn: 19, zwanzig: 20,
}
const NUMBER_PATTERN = `(\\d+|${Object.keys(NUMBER_WORDS).join('|')})`

function parseNumber(token) {
  const t = token.toLowerCase()
  if (/^\d+$/.test(t)) return Number(t)
  return NUMBER_WORDS[t] ?? null
}

/** Extrahiert aus einer Rechenaufgabe im Text die erwartete Lösung (letzte Aufgabe gewinnt —
 *  so greift bei „…sind sieben! Und was ist 5 plus 2?" die NEU gestellte Aufgabe). */
export function extractExpectedAnswer(text) {
  const re = new RegExp(`${NUMBER_PATTERN}\\s*(plus|minus|mal|\\+|-|·|x)\\s*${NUMBER_PATTERN}`, 'gi')
  let match
  let last = null
  while ((match = re.exec(text)) !== null) last = match
  if (!last) return null
  const a = parseNumber(last[1])
  const b = parseNumber(last[3])
  if (a === null || b === null) return null
  const op = last[2].toLowerCase()
  const result = op === 'plus' || op === '+' ? a + b : op === 'minus' || op === '-' ? a - b : a * b
  return result >= 0 && result <= 100 ? result : null
}

/** Kommt die Zahl n in der Äußerung vor — als Ziffer oder deutsches Zahlwort? */
export function containsNumber(text, n) {
  const t = text.toLowerCase()
  if (new RegExp(`(^|[^\\d])${n}([^\\d]|$)`).test(t)) return true
  const words = Object.entries(NUMBER_WORDS).filter(([, v]) => v === n).map(([w]) => w)
  return words.some((w) => new RegExp(`(^|[^a-zäöüß])${w}([^a-zäöüß]|$)`).test(t))
}

/** Erste in der Äußerung genannte Zahl (für „Kind sagte X, richtig wäre Y"). */
export function firstNumber(text) {
  const re = new RegExp(NUMBER_PATTERN, 'gi')
  let match
  while ((match = re.exec(text.toLowerCase())) !== null) {
    const n = parseNumber(match[1])
    if (n !== null) return n
  }
  return null
}

/** Direktiven für den Erfolgs-/Fehlversuchs-Fall (Multi-Turn). */
export function outcomeDirective(outcome) {
  if (outcome.type === 'richtig') {
    return `\n\nPädagogik-Direktive des Teaching Planners für genau diese Antwort:\n- Das Kind hat die Aufgabe soeben SELBST richtig gelöst (Antwort: ${outcome.expected}). Lobe konkret und ehrlich (kein übertriebenes Dauerlob) und biete eine ähnliche oder leicht schwerere Aufgabe an.`
  }
  return `\n\nPädagogik-Direktive des Teaching Planners für genau diese Antwort:\n- Das Kind hat soeben FALSCH geantwortet (es sagte ${outcome.said}, richtig wäre ${outcome.expected}). Kein Tadel, kein „fast richtig". Sanft auflösen: Ergebnis nennen, in einem einfachen Bild erklären, ermutigen.`
}

/* ------------------------------------------------------------------ */
/* Kern: Zustand → Strategie (reine Funktion, deterministisch)         */
/* ------------------------------------------------------------------ */

/**
 * @param {{ ageBand: '4-5'|'6-7', skill: string|null, state: object, frustration: boolean }} input
 * @returns {{ strategie: string, begruendung: string }}
 */
export function planStrategy({ ageBand, skill, state, frustration }) {
  if (!skill) {
    return {
      strategie: STRATEGIES.HINWEIS,
      begruendung: 'Lernfrage ohne erkannten Skill — sanfter Default.',
    }
  }
  const s = state.skills[skill] ?? { exposures: 0, consecutiveFrustrations: 0, mastered: false }

  // Regel 1 — Frustbremse schlägt ALLES. Nie weiter sokratisieren, wenn das Kind kämpft.
  if (frustration || s.consecutiveFrustrations >= 2) {
    return {
      strategie: STRATEGIES.LOESUNG,
      begruendung: 'Frustsignal erkannt — Sokratik abbrechen, Lösung geben, ermutigen.',
    }
  }

  // Regel 2 — Gefestigt? Nicht langweilen: Schwierigkeit steigern.
  if (s.mastered || s.exposures >= 3) {
    return {
      strategie: STRATEGIES.STEIGERN,
      begruendung: `Skill ${s.exposures}× geübt — Zone der nächsten Entwicklung ansteuern.`,
    }
  }

  // Regel 3 — Wiederkehr desselben Skills: variieren statt identisch wiederholen.
  if (s.exposures >= 1) {
    return {
      strategie: STRATEGIES.VARIATION,
      begruendung: `Skill zum ${s.exposures + 1}. Mal — festigen durch Variation.`,
    }
  }

  // Regel 4 — Erstkontakt: altersabhängig. 4–5 (vor-schriftlich) braucht Anschauung,
  // 6–7 (Schulkind) verträgt eine echte Gegenfrage.
  return ageBand === '4-5'
    ? { strategie: STRATEGIES.HINWEIS, begruendung: 'Erstkontakt, 4–5 Jahre — bildhafter Hinweis statt abstrakter Gegenfrage.' }
    : { strategie: STRATEGIES.SOKRATISCH, begruendung: 'Erstkontakt, 6–7 Jahre — sokratische Gegenfrage.' }
}

/* ------------------------------------------------------------------ */
/* Direktive: Strategie → Prompt-Baustein fürs Haupt-LLM               */
/* ------------------------------------------------------------------ */

const DIRECTIVES = {
  [STRATEGIES.SOKRATISCH]:
    'Stelle genau EINE altersgerechte Gegenfrage, die das Kind selbst zur Lösung führt. Verrate die Lösung nicht.',
  [STRATEGIES.HINWEIS]:
    'Gib einen bildhaften Hinweis mit Alltagsdingen (Äpfel, Finger, Bauklötze). Verrate die Lösung noch nicht.',
  [STRATEGIES.LOESUNG]:
    'Nenne die Lösung freundlich und erkläre sie in einem einfachen Satz. Ermutige das Kind ausdrücklich — kein Tadel.',
  [STRATEGIES.VARIATION]:
    'Beantworte kindgerecht und stelle danach eine ähnliche, gleich schwere Übungsaufgabe.',
  [STRATEGIES.STEIGERN]:
    'Lobe kurz, dass das Kind das schon gut kann, und biete eine etwas schwierigere Aufgabe zum selben Thema an.',
}

export function directiveFor(plan) {
  return `\n\nPädagogik-Direktive des Teaching Planners für genau diese Antwort:\n- ${DIRECTIVES[plan.strategie]}`
}
