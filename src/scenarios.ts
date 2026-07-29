import type { ArchNode } from './types'

/** Ein Szenario ist ein Parametersatz (kein Graph) — genau die Werte, die /api/run konsumiert. */
export interface Scenario {
  id: string
  name: string
  createdAt: number
  models: { triage?: string; main?: string; safety?: string }
  systemPrompt: string
  plannerEnabled: boolean
  config: {
    blockPatterns?: string
    riskWords?: string
    emotionWords?: string
    clarifyMinWords?: string
  }
}

const STORAGE_KEY = 'arch-studio-scenarios'

/* ---------------- Store (localStorage) ---------------- */

export function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Scenario[]) : []
  } catch {
    return []
  }
}

export function saveScenarios(list: Scenario[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/* ---------------- Capture / Apply (Canvas ⇄ Szenario) ---------------- */

const firstOfKind = (nodes: ArchNode[], kind: string) => nodes.find((n) => n.data.kind === kind)
const safetyNodes = (nodes: ArchNode[]) => nodes.filter((n) => n.data.kind === 'safety')

/** Greift den tunebaren Parametersatz vom aktuellen Canvas ab. */
export function captureScenario(nodes: ArchNode[], name: string): Scenario {
  const triage = firstOfKind(nodes, 'triage')
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    models: {
      triage: firstOfKind(nodes, 'triage')?.data.config.model,
      main: firstOfKind(nodes, 'llm')?.data.config.model,
      safety: safetyNodes(nodes)[0]?.data.config.model,
    },
    systemPrompt: firstOfKind(nodes, 'prompt')?.data.config.prompt ?? '',
    plannerEnabled: nodes.some((n) => n.data.label.toLowerCase().includes('planner')),
    config: {
      blockPatterns: safetyNodes(nodes)
        .map((n) => n.data.config.blockPatterns)
        .filter(Boolean)
        .join(', '),
      riskWords: triage?.data.config.riskWords,
      emotionWords: triage?.data.config.emotionWords,
      clarifyMinWords: triage?.data.config.clarifyMinWords,
    },
  }
}

/** Schreibt die editierbaren Werte eines Szenarios zurück auf den Canvas (Struktur bleibt). */
export function applyScenarioToNodes(nodes: ArchNode[], scenario: Scenario): ArchNode[] {
  return nodes.map((node) => {
    const kind = node.data.kind
    const patch: Record<string, string> = {}
    if (kind === 'triage') {
      if (scenario.models.triage) patch.model = scenario.models.triage
      if (scenario.config.riskWords !== undefined) patch.riskWords = scenario.config.riskWords
      if (scenario.config.emotionWords !== undefined) patch.emotionWords = scenario.config.emotionWords
      if (scenario.config.clarifyMinWords !== undefined) patch.clarifyMinWords = scenario.config.clarifyMinWords
    } else if (kind === 'llm' && scenario.models.main) {
      patch.model = scenario.models.main
    } else if (kind === 'safety') {
      if (scenario.models.safety) patch.model = scenario.models.safety
      if (scenario.config.blockPatterns !== undefined) patch.blockPatterns = scenario.config.blockPatterns
    } else if (kind === 'prompt') {
      patch.prompt = scenario.systemPrompt
    }
    if (Object.keys(patch).length === 0) return node
    return { ...node, data: { ...node.data, config: { ...node.data.config, ...patch } } }
  })
}

/** Baut den /api/run-Payload direkt aus einem Szenario (Arena braucht keinen Canvas-Umweg). */
export function buildRunPayload(scenario: Scenario, utterance: string, ageBand: string) {
  return {
    utterance,
    ageBand,
    sessionId: `arena-${scenario.id}-${crypto.randomUUID()}`,
    plannerEnabled: scenario.plannerEnabled,
    systemPrompt: scenario.systemPrompt,
    models: scenario.models,
    blockPatterns: scenario.config.blockPatterns ?? '',
  }
}

/* ---------------- Kosten ---------------- */

/** Nutzungsprofil: geschätzte Turns pro Interaktionsstunde (Frage-Modus dichter, Geschichten dünner). */
export const TURNS_PER_HOUR = 30
export const DEFAULT_HOURS_PER_WEEK = 5

/** Turns/Monat aus Stunden/Woche: h/Woche × (52/12) Wochen/Monat × Turns/Stunde. */
export function turnsPerMonth(hoursPerWeek: number): number {
  return Math.round(((hoursPerWeek * 52) / 12) * TURNS_PER_HOUR)
}

export interface RunStage {
  model: string | null
  tokens: { in: number; out: number } | null
}

/** $-Kosten eines Turns aus den Step-Tokens × Katalogpreis ($/1M). */
export function costOfRun(
  stages: RunStage[],
  priceOf: (modelId: string) => { in: number; out: number } | undefined,
  turns: number = turnsPerMonth(DEFAULT_HOURS_PER_WEEK),
): { perTurn: number; perMonth: number } {
  let perTurn = 0
  for (const stage of stages) {
    if (!stage.model || !stage.tokens) continue
    const price = priceOf(stage.model)
    if (!price || price.in < 0 || price.out < 0) continue
    perTurn += (stage.tokens.in / 1e6) * price.in + (stage.tokens.out / 1e6) * price.out
  }
  return { perTurn, perMonth: perTurn * turns }
}

export function formatUsd(value: number): string {
  if (value === 0) return '$0'
  if (value < 0.01) return `${(value * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} ¢`
  return `$${value.toFixed(2)}`
}
