import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import type { Connection, Edge, OnSelectionChangeParams } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { ArchNode, ArchNodeData, NodeKind } from './types'
import { mvpArchitecture, targetArchitecture } from './presets'
import { simulate } from './simulate'
import type { SimResult, SimStep } from './simulate'
import { ArchNodeView } from './components/ArchNodeView'
import { Inspector } from './components/Inspector'
import { ChatPanel } from './components/ChatPanel'
import { RunTimeline } from './components/RunTimeline'
import { Arena } from './components/Arena'
import { Logo } from './components/Logo'
import { Button } from './components/ui'
import { useResizable } from './hooks/useResizable'
import type { Scenario } from './scenarios'
import { loadScenarios, saveScenarios, applyScenarioToNodes } from './scenarios'

const nodeTypes = { arch: ArchNodeView }
const STORAGE_PREFIX = 'arch-studio-v4:'
const THEME_KEY = 'arch-studio-theme'

export type RunMode = 'heuristik' | 'live'
export type AgeBand = '4-5' | '6-7'

/** Eine Nachricht im Multi-Turn-Testgespräch. */
export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  meta?: string
}

interface LiveStage {
  key: 'triage' | 'router' | 'script' | 'planner' | 'prompt' | 'main' | 'safety' | 'fallback' | 'final'
  model: string | null
  ms: number
  tokens: { in: number; out: number } | null
  status: 'ok' | 'warn' | 'risk'
  summary: string
}

interface LiveResponse {
  ok: boolean
  error?: string
  decision?: SimResult['decision']
  answer?: string
  blocked?: boolean
  totalMs?: number
  stages?: LiveStage[]
  warnings?: string[]
}

const STAGE_KIND: Record<LiveStage['key'], NodeKind> = {
  triage: 'triage',
  router: 'router',
  script: 'script',
  planner: 'content',
  prompt: 'prompt',
  main: 'llm',
  safety: 'safety',
  fallback: 'script',
  final: 'output',
}

function sessionId(): string {
  let id = localStorage.getItem('arch-studio-session')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('arch-studio-session', id)
  }
  return id
}

const withEdgeDefaults = (edge: Edge): Edge => ({
  ...edge,
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
})

function loadArchitecture(presetId: 'mvp' | 'ziel'): { nodes: ArchNode[]; edges: Edge[] } {
  const stored = localStorage.getItem(STORAGE_PREFIX + presetId)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return { nodes: parsed.nodes, edges: parsed.edges.map(withEdgeDefaults) }
      }
    } catch {
      // korrupte Daten → Preset verwenden
    }
  }
  const preset = presetId === 'mvp' ? mvpArchitecture : targetArchitecture
  return {
    nodes: structuredClone(preset.nodes),
    edges: structuredClone(preset.edges).map(withEdgeDefaults),
  }
}

function initialDark(): boolean {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function App() {
  const [presetId, setPresetId] = useState<'mvp' | 'ziel'>('mvp')
  const initial = useMemo(() => loadArchitecture('mvp'), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [tab, setTab] = useState<'test' | 'inspector'>('test')
  const [view, setView] = useState<'canvas' | 'arena'>('canvas')
  const [timelineWidth, startTimelineResize] = useResizable('arch-studio-w-timeline', 300, 220, 520)
  const [chatWidth, startChatResize] = useResizable('arch-studio-w-chat', 400, 300, 640)
  const [scenarios, setScenarios] = useState<Scenario[]>(() => loadScenarios())
  const [dark, setDark] = useState(initialDark)
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [conversation, setConversation] = useState<ChatMessage[]>([])
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [running, setRunning] = useState(false)
  const timersRef = useRef<number[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const firstRender = useRef(true)

  // Theme-Klasse am <html>-Element pflegen
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  }, [dark])

  // Szenarien persistieren
  useEffect(() => {
    saveScenarios(scenarios)
  }, [scenarios])

  const loadScenarioToCanvas = useCallback(
    (scenario: Scenario) => {
      setNodes((existing) => applyScenarioToNodes(existing, scenario))
      setView('canvas')
    },
    [setNodes],
  )

  // Preset-Wechsel lädt den gespeicherten Stand bzw. das Preset
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const loaded = loadArchitecture(presetId)
    setNodes(loaded.nodes)
    setEdges(loaded.edges)
    setSimResult(null)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [presetId, setNodes, setEdges])

  // Autosave
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem(STORAGE_PREFIX + presetId, JSON.stringify({ nodes, edges }))
    }, 400)
    return () => window.clearTimeout(id)
  }, [nodes, edges, presetId])

  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), [])

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((existing) =>
        addEdge(
          withEdgeDefaults({
            ...connection,
            id: `${connection.source}->${connection.target}-${Date.now()}`,
          } as Edge),
          existing,
        ),
      ),
    [setEdges],
  )

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
    setSelectedNodeId(selNodes[0]?.id ?? null)
    setSelectedEdgeId(selNodes.length === 0 ? (selEdges[0]?.id ?? null) : null)
    if (selNodes.length > 0 || selEdges.length > 0) setTab('inspector')
  }, [])

  const patchNode = useCallback(
    (id: string, patch: Partial<ArchNodeData>) =>
      setNodes((existing) =>
        existing.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)),
      ),
    [setNodes],
  )

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((existing) => existing.filter((node) => node.id !== id))
      setEdges((existing) => existing.filter((edge) => edge.source !== id && edge.target !== id))
      setSelectedNodeId(null)
    },
    [setNodes, setEdges],
  )

  const setEdgeCondition = useCallback(
    (id: string, condition: string) =>
      setEdges((existing) =>
        existing.map((edge) => (edge.id === id ? { ...edge, label: condition || undefined } : edge)),
      ),
    [setEdges],
  )

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((existing) => existing.filter((edge) => edge.id !== id))
      setSelectedEdgeId(null)
    },
    [setEdges],
  )

  const addNode = useCallback(() => {
    const id = `node-${Date.now()}`
    const node: ArchNode = {
      id,
      type: 'arch',
      position: { x: 420, y: 200 + Math.round((nodes.length % 5) * 90) },
      data: { label: 'Neue Komponente', kind: 'llm', description: '', latencyMs: 100, config: {} },
    }
    setNodes((existing) => [...existing, node])
    setSelectedNodeId(id)
    setTab('inspector')
  }, [nodes.length, setNodes])

  const resetPreset = useCallback(() => {
    localStorage.removeItem(STORAGE_PREFIX + presetId)
    const preset = presetId === 'mvp' ? mvpArchitecture : targetArchitecture
    setNodes(structuredClone(preset.nodes))
    setEdges(structuredClone(preset.edges).map(withEdgeDefaults))
    setSimResult(null)
  }, [presetId, setNodes, setEdges])

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ presetId, nodes, edges }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `architektur-${presetId}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [presetId, nodes, edges])

  const importJson = useCallback(
    (file: File) => {
      file.text().then((raw) => {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            setNodes(parsed.nodes)
            setEdges(parsed.edges.map(withEdgeDefaults))
            setSimResult(null)
          }
        } catch {
          window.alert('Datei konnte nicht gelesen werden — kein gültiger Architektur-Export.')
        }
      })
    },
    [setNodes, setEdges],
  )

  const playSteps = useCallback((result: SimResult) => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
    setSimResult(result)
    setVisibleSteps(0)
    setRunning(true)
    let elapsed = 0
    result.steps.forEach((step, index) => {
      elapsed += Math.max(120, Math.min(1200, step.latencyMs / 3))
      timersRef.current.push(
        window.setTimeout(() => {
          setVisibleSteps(index + 1)
          if (index === result.steps.length - 1) setRunning(false)
        }, elapsed),
      )
    })
    if (result.steps.length === 0) setRunning(false)
  }, [])

  const runLive = useCallback(
    async (utterance: string, ageBand: AgeBand, history: ChatMessage[]) => {
      timersRef.current.forEach((t) => window.clearTimeout(t))
      timersRef.current = []
      setSimResult(null)
      setRunning(true)

      const firstOfKind = (kind: NodeKind) => nodes.find((node) => node.data.kind === kind)
      const safetyNodes = nodes.filter((node) => node.data.kind === 'safety')
      const payload = {
        utterance,
        ageBand,
        sessionId: sessionId(),
        history: history.map((m) => ({ role: m.role, text: m.text })),
        // Architektur-Treue: Planner läuft nur, wenn er als Komponente auf dem Canvas existiert
        plannerEnabled: nodes.some((node) => node.data.label.toLowerCase().includes('planner')),
        systemPrompt: firstOfKind('prompt')?.data.config.prompt,
        models: {
          triage: firstOfKind('triage')?.data.config.model,
          main: firstOfKind('llm')?.data.config.model,
          safety: safetyNodes[0]?.data.config.model,
        },
        blockPatterns: safetyNodes
          .map((node) => node.data.config.blockPatterns)
          .filter(Boolean)
          .join(', '),
      }

      let data: LiveResponse
      try {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        data = (await res.json()) as LiveResponse
      } catch (err) {
        data = { ok: false, error: `Backend nicht erreichbar (${String(err)}). Läuft \`npm run dev\` mit beiden Prozessen?` }
      }

      if (!data.ok || !data.stages) {
        setRunning(false)
        setSimResult({
          steps: [], pathNodeIds: [], pathEdgeIds: [], totalMs: 0,
          decision: 'normal', answer: '', blocked: false,
          warnings: [data.error ?? 'Unbekannter Fehler im Live-Backend.'],
        })
        return
      }

      const decision = data.decision ?? 'normal'
      const nodeForStage = (stage: LiveStage): ArchNode | undefined => {
        if (stage.key === 'script' && decision === 'unklar') {
          return firstOfKind('clarify') ?? firstOfKind('script')
        }
        if (stage.key === 'fallback') {
          const scripts = nodes.filter((node) => node.data.kind === 'script')
          return scripts[1] ?? scripts[0]
        }
        if (stage.key === 'planner') {
          return nodes.find((node) => node.data.label.includes('Planner')) ?? firstOfKind('content')
        }
        return firstOfKind(STAGE_KIND[stage.key])
      }

      const inputNode = firstOfKind('input')
      const steps: SimStep[] = []
      const pathNodeIds: string[] = []
      let cumulative = 0
      if (inputNode) {
        pathNodeIds.push(inputNode.id)
        steps.push({
          nodeId: inputNode.id, label: inputNode.data.label,
          detail: `Live-Eingabe (Text statt Audio): „${utterance}"`,
          latencyMs: 0, cumulativeMs: 0, status: 'ok',
        })
      }
      for (const stage of data.stages) {
        const node = nodeForStage(stage)
        cumulative += stage.ms
        if (node && pathNodeIds[pathNodeIds.length - 1] !== node.id) pathNodeIds.push(node.id)
        const meta = [
          stage.model ? `Modell: ${stage.model}` : null,
          stage.tokens ? `${stage.tokens.in}→${stage.tokens.out} Tokens` : null,
        ].filter(Boolean).join(' · ')
        steps.push({
          nodeId: node?.id ?? stage.key,
          label: node?.data.label ?? stage.key,
          detail: meta ? `${stage.summary} · ${meta}` : stage.summary,
          latencyMs: stage.ms, cumulativeMs: cumulative, status: stage.status,
        })
      }
      const pathEdgeIds: string[] = []
      for (let i = 0; i < pathNodeIds.length - 1; i += 1) {
        const edge = edges.find((e) => e.source === pathNodeIds[i] && e.target === pathNodeIds[i + 1])
        if (edge) pathEdgeIds.push(edge.id)
      }

      playSteps({
        steps, pathNodeIds, pathEdgeIds,
        totalMs: data.totalMs ?? cumulative,
        decision, answer: data.answer ?? '', blocked: data.blocked ?? false,
        warnings: data.warnings ?? [],
      })
      if (data.answer) {
        const answerText = data.answer
        setConversation((prev) => [
          ...prev,
          { role: 'assistant', text: answerText, meta: `${decision}${data.blocked ? ' · blockiert' : ''} · ${data.totalMs} ms` },
        ])
      }
    },
    [nodes, edges, playSteps],
  )

  const runSimulation = useCallback(
    (utterance: string, mode: RunMode, ageBand: AgeBand) => {
      setTab('test')
      // Historie = Gespräch VOR diesem Turn; die aktuelle Äußerung schickt der Server separat
      const history = conversation
      setConversation((prev) => [...prev, { role: 'user', text: utterance }])
      if (mode === 'live') {
        void runLive(utterance, ageBand, history)
        return
      }
      const result = simulate(nodes, edges, utterance, ageBand)
      playSteps(result)
      if (result.answer) {
        setConversation((prev) => [
          ...prev,
          { role: 'assistant', text: result.answer, meta: `${result.decision} · ${result.totalMs} ms · Heuristik` },
        ])
      }
    },
    [nodes, edges, playSteps, runLive, conversation],
  )

  const resetRun = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
    setSimResult(null)
    setConversation([])
    setVisibleSteps(0)
    setRunning(false)
  }, [])

  // Simulations-Hervorhebung auf der Zeichenfläche
  const activePath = simResult ? simResult.pathNodeIds.slice(0, visibleSteps) : []
  const activeEdges = simResult ? simResult.pathEdgeIds.slice(0, Math.max(0, visibleSteps - 1)) : []
  const currentNodeId = activePath[activePath.length - 1]

  const highlightActive = simResult !== null && simResult.steps.length > 0
  const displayNodes: ArchNode[] = nodes.map((node) => ({
    ...node,
    className: highlightActive
      ? activePath.includes(node.id)
        ? node.id === currentNodeId && running
          ? 'sim-on-path sim-current'
          : 'sim-on-path'
        : 'sim-dimmed'
      : '',
  }))
  const displayEdges: Edge[] = edges.map((edge) => ({
    ...edge,
    animated: activeEdges.includes(edge.id),
    className: highlightActive ? (activeEdges.includes(edge.id) ? 'sim-edge-active' : 'sim-edge-dimmed') : '',
  }))

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-auto text-foreground" />
          <div className="border-l border-border pl-3">
            <h1 className="text-sm font-bold tracking-tight">Architektur-Studio</h1>
            <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">
              Sprach-KI-Begleiter · 4–7 Jahre
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-muted p-0.5">
            {(['canvas', 'arena'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={[
                  'cursor-pointer rounded-[calc(var(--radius)-4px)] px-3 py-1 text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  view === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {id === 'canvas' ? 'Canvas' : '⚔ Arena'}
              </button>
            ))}
          </div>

          {view === 'canvas' && (
            <>
              <div className="inline-flex rounded-md border bg-muted p-0.5">
                {(['mvp', 'ziel'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPresetId(id)}
                    className={[
                      'cursor-pointer rounded-[calc(var(--radius)-4px)] px-3 py-1 text-sm font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      presetId === id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {id === 'mvp' ? 'MVP' : 'Zielbild'}
                  </button>
                ))}
              </div>
              <Button onClick={addNode}>+ Komponente</Button>
              <Button onClick={exportJson}>Export</Button>
              <Button onClick={() => fileInputRef.current?.click()}>Import</Button>
              <Button onClick={resetPreset} title="Änderungen verwerfen, Preset neu laden">
                Zurücksetzen
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => setDark((value) => !value)}
            title={dark ? 'Helles Theme' : 'Dunkles Theme'}
            aria-label={dark ? 'Helles Theme aktivieren' : 'Dunkles Theme aktivieren'}
          >
            {dark ? '☀' : '☾'}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(ev) => {
              const file = ev.target.files?.[0]
              if (file) importJson(file)
              ev.target.value = ''
            }}
          />
        </div>
      </header>

      {view === 'arena' ? (
        <Arena
          scenarios={scenarios}
          onScenariosChange={setScenarios}
          currentNodes={nodes}
          onLoadToCanvas={loadScenarioToCanvas}
        />
      ) : (
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            colorMode={dark ? 'dark' : 'light'}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>

        {/* Resize-Griff: Verlauf/Komponente-Panel */}
        <div
          onPointerDown={startTimelineResize}
          title="Ziehen zum Vergrößern/Verkleinern"
          className="w-1 shrink-0 cursor-col-resize border-l bg-transparent transition-colors hover:bg-ring/40 max-md:hidden"
        />
        <aside
          style={{ width: timelineWidth }}
          className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground max-md:max-h-[40vh] max-md:w-full! max-md:border-t"
        >
          <div className="flex border-b">
            {(
              [
                ['test', 'Verlauf'],
                ['inspector', 'Komponente'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={[
                  'flex-1 cursor-pointer border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  tab === id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'test' ? (
              <RunTimeline result={simResult} visibleSteps={visibleSteps} running={running} />
            ) : (
              <Inspector
                node={selectedNode}
                edge={selectedEdge}
                onNodeChange={patchNode}
                onEdgeConditionChange={setEdgeCondition}
                onDeleteNode={deleteNode}
                onDeleteEdge={deleteEdge}
              />
            )}
          </div>
        </aside>

        {/* Resize-Griff: Chat-Panel */}
        <div
          onPointerDown={startChatResize}
          title="Ziehen zum Vergrößern/Verkleinern"
          className="w-1 shrink-0 cursor-col-resize border-l bg-transparent transition-colors hover:bg-ring/40 max-md:hidden"
        />
        <aside
          style={{ width: chatWidth }}
          className="flex shrink-0 flex-col border-l-0 bg-background max-md:max-h-[50vh] max-md:w-full! max-md:border-t"
        >
          <ChatPanel conversation={conversation} running={running} onRun={runSimulation} onReset={resetRun} />
        </aside>
      </div>
      )}
    </div>
  )
}
