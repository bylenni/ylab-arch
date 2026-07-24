import type { SimResult, SimStep } from '../simulate'

interface Props {
  result: SimResult | null
  visibleSteps: number
  running: boolean
}

const DECISION_LABEL: Record<SimResult['decision'], string> = {
  normal: 'Normaler Pfad',
  sensibel: 'Sensibler Pfad',
  unklar: 'Rückfrage',
}

const dotColor: Record<SimStep['status'], string> = {
  ok: 'bg-status-ok',
  warn: 'bg-status-warn',
  risk: 'bg-status-risk',
}

const badgeColor: Record<'ok' | 'warn' | 'risk', string> = {
  ok: 'border-status-ok bg-status-ok-soft',
  warn: 'border-status-warn bg-status-warn-soft',
  risk: 'border-status-risk bg-status-risk-soft',
}

/** Pipeline-Verlauf des letzten Turns als Timeline. */
export function RunTimeline({ result, visibleSteps, running }: Props) {
  if (!result) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          Noch kein Lauf. Starte rechts ein Gespräch — hier erscheint dann Schritt für Schritt, welchen Weg die
          Äußerung durch die Pipeline nimmt.
        </p>
      </div>
    )
  }

  const failed = result.steps.length === 0
  const done = !running
  const tone: 'ok' | 'warn' | 'risk' = result.blocked ? 'risk' : result.decision === 'normal' ? 'ok' : 'warn'
  const steps = result.steps.slice(0, visibleSteps)

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Kopf: Entscheidung + Latenz */}
      {!failed && (
        <div className={`rounded-lg border p-3 ${done ? badgeColor[tone] : 'border-border bg-muted/40'}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold">
              {done ? DECISION_LABEL[result.decision] : 'Läuft …'}
              {result.blocked ? ' · Output blockiert' : ''}
            </span>
            <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
              {result.totalMs} ms
            </span>
          </div>
          {done && (
            <p className="mt-1 text-xs text-muted-foreground">
              {result.totalMs <= 1500
                ? 'Im Zielkorridor (p50 ≈ 1,5 s). Earcon deckt die Wartezeit.'
                : result.totalMs <= 2500
                  ? 'Realistisch, aber über p50-Ziel — Earcon + Denk-Floskel nötig.'
                  : 'Zu langsam: Kette kürzen, kleinere Modelle oder parallelisieren.'}
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      <ol className="relative ml-1.5 flex flex-col border-l border-border pl-4">
        {steps.map((step, index) => (
          <li key={`${step.nodeId}-${index}`} className="sim-step-enter relative pb-4 last:pb-0">
            <span
              className={`absolute -left-[21.5px] top-1 size-2.5 rounded-full ring-4 ring-background ${dotColor[step.status]}`}
            />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[0.82rem] font-semibold leading-tight">{step.label}</span>
              <span className="whitespace-nowrap font-mono text-[0.68rem] tabular-nums text-muted-foreground">
                {step.latencyMs > 0 ? `+${step.latencyMs} ms` : ''}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{step.detail}</p>
          </li>
        ))}
      </ol>

      {done && result.warnings.length > 0 && (
        <div className="rounded-lg border border-status-warn bg-status-warn-soft px-3 py-2 text-xs">
          {result.warnings.map((warning) => (
            <p key={warning} className="my-0.5">
              ⚠ {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
