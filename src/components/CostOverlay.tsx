import { useEffect, useState } from 'react'
import { costOfRun, formatUsd, turnsPerMonth, DEFAULT_HOURS_PER_WEEK } from '../scenarios'
import type { RunStage } from '../scenarios'

export interface CostStage extends RunStage {
  key: string
  label: string
}

interface Props {
  stages: CostStage[] | null
  cached: boolean
  priceOf: (modelId: string) => { in: number; out: number } | undefined
}

const KEY_LABEL: Record<string, string> = {
  triage: 'Triage',
  main: 'Haupt-LLM',
  safety: 'Safety',
}

const HOURS_KEY = 'arch-studio-hours-per-week'

/** Preis unbekannt (z. B. Melious ohne Katalog-Preise, in/out = -1) — einzige Stelle,
 *  an der das geprüft wird, damit Stage-Zeile und Summenzeile nie auseinanderlaufen. */
const isPriceUnknown = (price: { in: number; out: number } | undefined): boolean =>
  !price || price.in < 0 || price.out < 0

/** Dauerhaftes Kosten-Overlay auf dem Canvas — Hochrechnung aus dem letzten Live-Turn,
 *  Nutzungsprofil (Std/Woche) direkt einstellbar. */
export function CostOverlay({ stages, cached, priceOf }: Props) {
  const [hours, setHours] = useState<number>(() => {
    const stored = Number(localStorage.getItem(HOURS_KEY))
    return stored > 0 && stored <= 40 ? stored : DEFAULT_HOURS_PER_WEEK
  })
  useEffect(() => {
    localStorage.setItem(HOURS_KEY, String(hours))
  }, [hours])

  const turns = turnsPerMonth(hours)
  const billable = (stages ?? []).filter((s) => s.model && s.tokens && (s.tokens.in > 0 || s.tokens.out > 0))
  const cost = costOfRun(billable, priceOf, turns)
  // Summenzeile darf "$0" nie mit "kostenlos" verwechselbar machen: fehlen bei ALLEN
  // billable-Stages die Katalogpreise (Normalfall bei reiner Melious-Pipeline ohne
  // Preis-Feed), zeigen wir "?" statt einer (falschen) Null. Fehlt nur ein Teil, bleibt
  // die Summe stehen, wird aber als Untergrenze ("≥") gekennzeichnet.
  const unknownCount = billable.filter((s) => isPriceUnknown(s.model ? priceOf(s.model) : undefined)).length
  const allUnknown = billable.length > 0 && unknownCount === billable.length
  const partiallyUnknown = unknownCount > 0 && !allUnknown

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-10 w-64 rounded-lg border border-border bg-card/95 p-3 text-card-foreground shadow-md backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">Inferenzkosten</span>
        {cached && <span className="font-mono text-[0.58rem] text-status-ok">⚡ cache</span>}
      </div>

      {/* Nutzungsprofil — Slider + Zahl, live */}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={hours}
          onChange={(ev) => setHours(Number(ev.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-primary"
          title="Nutzungsstunden pro Woche"
        />
        <input
          type="number"
          min={1}
          max={40}
          step={0.5}
          value={hours}
          onChange={(ev) => setHours(Math.max(1, Math.min(40, Number(ev.target.value) || 1)))}
          className="h-6 w-12 rounded border border-input bg-background px-1 text-right text-xs tabular-nums"
        />
        <span className="text-[0.62rem] text-muted-foreground">h/Wo.</span>
      </div>

      {stages === null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Starte einen Live-Turn im Chat — hier erscheinen die gemessenen Kosten, hochgerechnet auf ein Kind.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold tabular-nums">
              {allUnknown ? '?' : `${partiallyUnknown ? '≥' : ''}${formatUsd(cost.perMonth)}`}
            </span>
            <span className="text-[0.64rem] text-muted-foreground">/ Kind · Monat</span>
          </div>
          <p className="font-mono text-[0.6rem] text-muted-foreground">
            {allUnknown
              ? 'Preise für diese Modelle nicht im Katalog'
              : `${partiallyUnknown ? '≥ ' : ''}${formatUsd(cost.perTurn)} / Turn × ${turns} Turns / Monat${
                  partiallyUnknown ? ' · Preise für einzelne Stages fehlen' : ''
                }`}
          </p>

          {billable.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-border pt-1.5">
              {billable.map((s, i) => {
                const price = s.model ? priceOf(s.model) : undefined
                const priceUnknown = isPriceUnknown(price)
                const c = s.tokens && price && !priceUnknown ? (s.tokens.in / 1e6) * price.in + (s.tokens.out / 1e6) * price.out : 0
                return (
                  <div key={`${s.key}-${i}`} className="flex items-baseline justify-between gap-2 font-mono text-[0.6rem]">
                    <span className="truncate text-muted-foreground">
                      {KEY_LABEL[s.key] ?? s.label}
                      <span className="ml-1 opacity-60">{s.model?.split('/').pop()}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{priceUnknown ? '?' : formatUsd(c * turns)}</span>
                  </div>
                )
              })}
            </div>
          )}
          {cached && billable.length === 0 && (
            <p className="mt-1.5 border-t border-border pt-1.5 text-[0.6rem] text-status-ok">
              ⚡ Cache-Hit — kein Modell-Aufruf, ~0 Kosten diesen Turn.
            </p>
          )}
          <p className="mt-1.5 text-[0.56rem] leading-tight text-muted-foreground/70">
            Nur LLM-Kette (Preise via OpenRouter, $≈€). STT/TTS, Infra und Human-Review kommen hinzu.
          </p>
        </>
      )}
    </div>
  )
}
