import { useEffect, useMemo, useState } from 'react'
import type { ArchNode } from '../types'
import { captureScenario, buildRunPayload } from '../scenarios'
import { deriveIstRoute, bewerteFall, aggregiereMetriken } from '../../server/evalCore.mjs'
import type { Route, Wertung } from '../../server/evalCore.mjs'
import { Button } from './ui'

interface Fall {
  id: string
  klasse: string
  ageBand: string
  utterance: string
  erwartet: Route
  quelle: string
}

interface Ergebnis extends Fall {
  ist: Route | null
  wertung: Wertung
  grund?: string
  warnings?: string[]
}

const KONKURRENZ = 4
const WERTUNG_FARBE: Record<Wertung, string> = {
  bestanden: 'text-status-ok',
  fn: 'text-status-risk',
  fp: 'text-status-warn',
  abweichung: 'text-status-warn',
  fehler: 'text-status-risk',
}

/** Prüfstand — Safety-Batch-Eval gegen die AKTUELLE Canvas-Konfiguration. */
export function Pruefstand({ nodes }: { nodes: ArchNode[] }) {
  const [faelle, setFaelle] = useState<Fall[] | null>(null)
  const [ergebnisse, setErgebnisse] = useState<Map<string, Ergebnis>>(new Map())
  const [laufend, setLaufend] = useState(false)

  useEffect(() => {
    fetch('/api/testset')
      .then((r) => r.json())
      .then((d) => setFaelle(Array.isArray(d.faelle) ? d.faelle : []))
      .catch(() => setFaelle([]))
  }, [])

  const klassen = useMemo(() => [...new Set((faelle ?? []).map((f) => f.klasse))], [faelle])
  const fertige = [...ergebnisse.values()]
  const metriken = aggregiereMetriken(fertige)
  // Distinct Warnungstexte über alle gelaufenen Fälle — einzelne Warnzeilen pro Fall wären Lärm.
  const warnHinweise = [...new Set(fertige.flatMap((e) => e.warnings ?? []))]

  /** Batch mit fester Parallelität — jeder Fall 1 Retry, danach fail-closed 'fehler'. */
  const starte = async (nur?: string) => {
    if (!faelle || laufend) return
    const auswahl = nur ? faelle.filter((f) => f.klasse === nur) : faelle
    setLaufend(true)
    setErgebnisse((prev) => {
      const next = new Map(prev)
      for (const f of auswahl) next.delete(f.id)
      return next
    })
    const scenario = captureScenario(nodes, 'pruefstand')
    const queue = [...auswahl]

    const runFall = async (fall: Fall): Promise<Ergebnis> => {
      for (let versuch = 1; versuch <= 2; versuch += 1) {
        try {
          const payload = {
            ...buildRunPayload(scenario, fall.utterance, fall.ageBand),
            sessionId: `eval-${fall.id}-${Date.now()}`,
            noCache: true,
          }
          const res = await fetch('/api/run', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const data = await res.json()
          if (!res.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${res.status}`)
          const ist = deriveIstRoute(data)
          return { ...fall, ist, wertung: bewerteFall(fall.erwartet, ist), warnings: data.warnings }
        } catch (err) {
          if (versuch === 2) return { ...fall, ist: null, wertung: 'fehler', grund: String(err) }
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
      return { ...fall, ist: null, wertung: 'fehler' }
    }

    await Promise.all(
      Array.from({ length: KONKURRENZ }, async () => {
        while (queue.length > 0) {
          const fall = queue.shift()
          if (!fall) break
          const ergebnis = await runFall(fall)
          setErgebnisse((prev) => new Map(prev).set(ergebnis.id, ergebnis))
        }
      }),
    )
    setLaufend(false)
  }

  if (faelle === null) return <div className="p-6 text-sm text-muted-foreground">Testset wird geladen …</div>
  if (faelle.length === 0)
    return <div className="p-6 text-sm text-muted-foreground">Kein Testset — läuft der API-Server (npm run dev)?</div>

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6">
      {/* Kopf: Gate-Status + Metriken */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-card p-4">
        <div>
          <div className={`text-3xl font-bold tabular-nums ${fertige.length === 0 ? 'text-muted-foreground' : metriken.gateGruen ? 'text-status-ok' : 'text-status-risk'}`}>
            {metriken.fn + metriken.fehler}
          </div>
          <div className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">FN + Fehler</div>
        </div>
        <div>
          <div className="text-3xl font-bold tabular-nums">{(metriken.fpRate * 100).toFixed(0)} %</div>
          <div className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">FP-Rate (Köder)</div>
        </div>
        <div>
          <div className="text-3xl font-bold tabular-nums">
            {fertige.length}/{faelle.length}
          </div>
          <div className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">Fälle gelaufen</div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <Button onClick={() => void starte()} disabled={laufend}>
            {laufend ? 'Läuft …' : '▶ Voller Lauf (100 Fälle)'}
          </Button>
          <p className="text-[0.62rem] text-muted-foreground">Gegen die aktuelle Canvas-Konfiguration · Cache umgangen</p>
        </div>
        {Object.keys(metriken.proAgeBand).length > 0 && (
          <div className="w-full font-mono text-[0.66rem] text-muted-foreground">
            {Object.entries(metriken.proAgeBand)
              .map(([ageBand, m]) => `${ageBand}: ${m.bestanden} ✓ · ${m.fn} FN · ${m.fp} FP · ${m.abweichung} ~ · ${m.fehler} E`)
              .join(' | ')}
          </div>
        )}
        {warnHinweise.length > 0 && (
          <div className="w-full text-[0.66rem] text-status-warn">
            {warnHinweise.map((warning) => (
              <p key={warning} className="my-0.5">
                ⚠ {warning}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Fälle pro Klasse */}
      {klassen.map((klasse) => {
        const klassenFaelle = faelle.filter((f) => f.klasse === klasse)
        const m = metriken.proKlasse[klasse]
        return (
          <section key={klasse} className="rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2">
              <h2 className="font-mono text-xs uppercase tracking-widest">{klasse}</h2>
              <div className="flex items-center gap-3">
                {m && (
                  <span className="font-mono text-[0.66rem] text-muted-foreground">
                    {m.bestanden} ✓ · {m.fn} FN · {m.fp} FP · {m.abweichung} ~ · {m.fehler} E
                  </span>
                )}
                <Button onClick={() => void starte(klasse)} disabled={laufend}>
                  ▶ Nur diese Klasse
                </Button>
              </div>
            </header>
            <ul className="divide-y divide-border">
              {klassenFaelle.map((fall) => {
                const r = ergebnisse.get(fall.id)
                return (
                  <li key={fall.id} className="flex items-baseline gap-3 px-4 py-1.5 text-sm">
                    <span className={`w-5 shrink-0 text-center font-mono ${r ? WERTUNG_FARBE[r.wertung] : 'text-muted-foreground'}`}>
                      {!r ? '·' : r.wertung === 'bestanden' ? '✓' : r.wertung === 'fn' ? 'FN' : r.wertung === 'fehler' ? 'E' : r.wertung === 'fp' ? 'FP' : '~'}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={fall.utterance}>
                      „{fall.utterance}"
                    </span>
                    <span className="shrink-0 font-mono text-[0.66rem] text-muted-foreground">
                      {fall.ageBand} · soll {fall.erwartet}
                      {r && r.wertung !== 'bestanden' ? ` · ist ${r.ist ?? '—'}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <p className="text-[0.62rem] text-muted-foreground">
        FN = gefährlicher Fall rutscht durch (Gate rot) · FP = harmloser Köder umgeleitet · ~ = Routenabweichung
        (z. B. blockiert statt sensibel) · E = Lauf-Fehler (zählt fail-closed rot). Testset: server/testsets/safety.v1.json.
      </p>
    </div>
  )
}
