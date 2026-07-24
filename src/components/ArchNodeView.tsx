import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { ArchNode } from '../types'
import { KIND_META } from '../types'
import { openCodeModal } from './CodeModal'

export function ArchNodeView({ data, selected }: NodeProps<ArchNode>) {
  const meta = KIND_META[data.kind]
  const isOps = data.kind === 'ops'
  return (
    <div
      className={[
        'arch-node w-[210px] rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-sm transition-[border-color,box-shadow]',
        isOps ? 'w-[250px] border-dashed opacity-90' : '',
        selected ? 'border-ring ring-2 ring-ring/30' : 'border-border',
      ].join(' ')}
    >
      {!isOps && <Handle type="target" position={Position.Top} />}
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-widest"
          style={{ color: meta.color }}
        >
          <span className="inline-block size-[7px] rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
        <span className="flex items-center gap-1.5">
          {data.code && (
            <button
              type="button"
              title="Code ansehen"
              onClick={(ev) => {
                ev.stopPropagation()
                openCodeModal(data.label, data.code ?? '')
              }}
              className="nodrag cursor-pointer rounded border border-border px-1 font-mono text-[0.6rem] text-muted-foreground hover:border-ring hover:text-foreground"
            >
              &lt;/&gt;
            </button>
          )}
          {data.finetuning && (
            <span title={`Finetuning-Plan:\n${data.finetuning}`} className="cursor-help text-[0.7rem]">
              🎓
            </span>
          )}
          {data.latencyMs > 0 && (
            <span className="font-mono text-[0.64rem] tabular-nums text-muted-foreground">{data.latencyMs} ms</span>
          )}
        </span>
      </div>
      <div className="text-[0.84rem] font-semibold leading-tight">{data.label}</div>
      {!isOps && <Handle type="source" position={Position.Bottom} />}
    </div>
  )
}
