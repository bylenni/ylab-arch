import type { Node, Edge } from '@xyflow/react'

export type NodeKind =
  | 'input'      // Gerät / Push-to-Talk
  | 'stt'        // Speech-to-Text
  | 'triage'     // Klassifikation
  | 'router'     // deterministische Routing-Logik
  | 'content'    // Inhaltsbibliothek / RAG
  | 'prompt'     // System-Prompt / Prompt-Assembly
  | 'llm'        // generatives Modell
  | 'safety'     // Output-Prüfung
  | 'script'     // geskriptete Antworten / Ersatzantwort
  | 'clarify'    // Rückfrage
  | 'tts'        // Text-to-Speech
  | 'output'     // Audio-Ausgabe
  | 'state'      // Session-State / Memory
  | 'ops'        // Betrieb: Evals, Versionierung, Eltern-App

export interface ArchNodeData extends Record<string, unknown> {
  label: string
  kind: NodeKind
  description: string
  /** Trainings-/Finetuning-Plan für diese Komponente (🎓 auf dem Canvas, editierbar im Inspector). */
  finetuning?: string
  latencyMs: number
  /** Frei editierbare Konfiguration; spezielle Schlüssel steuern den Simulator:
   *  triage:  riskWords, emotionWords, clarifyMinWords
   *  safety:  blockPatterns
   */
  config: Record<string, string>
}

export type ArchNode = Node<ArchNodeData, 'arch'>
export type ArchEdge = Edge

export interface Architecture {
  id: string
  name: string
  nodes: ArchNode[]
  edges: ArchEdge[]
}

export const KIND_META: Record<NodeKind, { label: string; color: string }> = {
  input:   { label: 'Gerät',        color: 'var(--chart-3)' },
  stt:     { label: 'STT',          color: 'var(--chart-1)' },
  triage:  { label: 'Triage',       color: 'var(--chart-4)' },
  router:  { label: 'Router',       color: 'var(--foreground)' },
  content: { label: 'Inhalte',      color: 'var(--chart-2)' },
  prompt:  { label: 'Prompt',       color: 'var(--chart-4)' },
  llm:     { label: 'LLM',          color: 'var(--chart-5)' },
  safety:  { label: 'Safety',       color: 'var(--status-ok)' },
  script:  { label: 'Geskriptet',   color: 'var(--status-warn)' },
  clarify: { label: 'Rückfrage',    color: 'var(--status-warn)' },
  tts:     { label: 'TTS',          color: 'var(--chart-1)' },
  output:  { label: 'Ausgabe',      color: 'var(--chart-3)' },
  state:   { label: 'State',        color: 'var(--chart-2)' },
  ops:     { label: 'Betrieb',      color: 'var(--muted-foreground)' },
}

export type EdgeCondition = 'normal' | 'sensibel' | 'unklar' | 'ok' | 'blockiert' | ''
export const EDGE_CONDITIONS: EdgeCondition[] = ['', 'normal', 'sensibel', 'unklar', 'ok', 'blockiert']
