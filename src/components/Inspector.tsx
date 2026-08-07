import type { ArchNode, ArchEdge, NodeKind } from '../types'
import { KIND_META, EDGE_CONDITIONS } from '../types'
import { openCodeModal } from './CodeModal'
import { ModelSelect } from './ModelSelect'
import { Button, Input, Label, Select, Textarea } from './ui'

interface Props {
  node: ArchNode | null
  edge: ArchEdge | null
  onNodeChange: (id: string, patch: Partial<ArchNode['data']>) => void
  onEdgeConditionChange: (id: string, condition: string) => void
  onDeleteNode: (id: string) => void
  onDeleteEdge: (id: string) => void
}

export function Inspector({ node, edge, onNodeChange, onEdgeConditionChange, onDeleteNode, onDeleteEdge }: Props) {
  if (edge) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted-foreground">
          Kante — die Bedingung steuert, welchen Weg Router und Safety-Prüfung nehmen.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edge-condition">Bedingung</Label>
          <Select
            id="edge-condition"
            value={String(edge.label ?? '')}
            onChange={(ev) => onEdgeConditionChange(edge.id, ev.target.value)}
          >
            {EDGE_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c === '' ? '(keine — immer folgen)' : c}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="destructive" onClick={() => onDeleteEdge(edge.id)}>
          Kante löschen
        </Button>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          Wähle eine Komponente oder Kante auf der Zeichenfläche, um sie zu bearbeiten. Neue Verbindungen ziehst du von
          der Unterkante eines Knotens zur Oberkante des nächsten.
        </p>
      </div>
    )
  }

  const { data } = node
  const configEntries = Object.entries(data.config)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="node-name">Name</Label>
        <Input id="node-name" value={data.label} onChange={(ev) => onNodeChange(node.id, { label: ev.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="node-kind">Typ</Label>
          <Select
            id="node-kind"
            value={data.kind}
            onChange={(ev) => onNodeChange(node.id, { kind: ev.target.value as NodeKind })}
          >
            {(Object.keys(KIND_META) as NodeKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_META[kind].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="node-latency">Latenz (ms)</Label>
          <Input
            id="node-latency"
            type="number"
            min={0}
            value={data.latencyMs}
            onChange={(ev) => onNodeChange(node.id, { latencyMs: Math.max(0, Number(ev.target.value) || 0) })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="node-description">Beschreibung</Label>
        <Textarea
          id="node-description"
          rows={4}
          value={data.description}
          onChange={(ev) => onNodeChange(node.id, { description: ev.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="node-finetuning">🎓 Finetuning-Plan</Label>
        <Textarea
          id="node-finetuning"
          rows={data.finetuning && data.finetuning.length > 120 ? 6 : 3}
          value={data.finetuning ?? ''}
          placeholder="Wird diese Komponente trainiert? Womit, wie viel Daten, was kostet es — oder bewusst nicht trainieren?"
          onChange={(ev) => onNodeChange(node.id, { finetuning: ev.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="node-code">&lt;/&gt; Referenz-Code</Label>
          {data.code && (
            <button
              type="button"
              onClick={() => openCodeModal(data.label, data.code ?? '')}
              className="cursor-pointer font-mono text-[0.62rem] text-muted-foreground underline hover:text-foreground"
            >
              als Modal öffnen
            </button>
          )}
        </div>
        <Textarea
          id="node-code"
          rows={data.code ? 8 : 3}
          value={data.code ?? ''}
          placeholder="Referenz-Code dieser Komponente. Erscheint als </>-Button auf dem Canvas-Knoten."
          className="font-mono text-xs"
          onChange={(ev) => onNodeChange(node.id, { code: ev.target.value })}
        />
      </div>

      {configEntries.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Konfiguration — <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">riskWords</code>,{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">emotionWords</code>,{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">clarifyMinWords</code> und{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">blockPatterns</code> steuern den
            Test-Simulator.
          </p>
          {configEntries.map(([key, value]) => (
            <div className="flex flex-col gap-1.5" key={key}>
              <Label htmlFor={`cfg-${key}`}>{key}</Label>
              {key === 'model' ? (
                <ModelSelect
                  id={`cfg-${key}`}
                  value={value}
                  onChange={(next) => onNodeChange(node.id, { config: { ...data.config, [key]: next } })}
                />
              ) : (
                <Textarea
                  id={`cfg-${key}`}
                  rows={value.length > 400 ? 14 : value.length > 60 ? 3 : 1}
                  value={value}
                  onChange={(ev) => onNodeChange(node.id, { config: { ...data.config, [key]: ev.target.value } })}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button onClick={() => onNodeChange(node.id, { config: { ...data.config, neuerSchluessel: '' } })}>
          + Konfigurationsfeld
        </Button>
        <Button variant="destructive" onClick={() => onDeleteNode(node.id)}>
          Komponente löschen
        </Button>
      </div>
    </div>
  )
}
