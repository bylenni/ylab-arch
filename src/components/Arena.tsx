import { useCallback, useMemo, useRef, useState } from 'react'
import type { ArchNode } from '../types'
import type { Scenario } from '../scenarios'
import { captureScenario, buildRunPayload, costOfRun, formatUsd, shortModelName } from '../scenarios'
import { useOpenRouterModels } from '../hooks/useOpenRouterModels'
import { PttRecorder } from '../lib/recorder'
import { Button, Input, Label, Textarea } from './ui'

const LETTERS = ['A', 'B', 'C', 'D']
const MAX_COLUMNS = 3

interface RunStageResult {
  key: string
  model: string | null
  ms: number
  tokens: { in: number; out: number } | null
  status: 'ok' | 'warn' | 'risk'
  summary: string
}
interface RunResult {
  ok: boolean
  error?: string
  decision?: 'normal' | 'sensibel' | 'unklar'
  answer?: string
  blocked?: boolean
  totalMs?: number
  stages?: RunStageResult[]
}
interface JudgeScore {
  label: string
  scores: Record<string, number>
  begruendung: string
}
interface JudgeVerdict {
  rankings: JudgeScore[]
  winner: string
  gesamturteil: string
}

interface Props {
  scenarios: Scenario[]
  onScenariosChange: (list: Scenario[]) => void
  currentNodes: ArchNode[]
  onLoadToCanvas: (scenario: Scenario) => void
}

export function Arena({ scenarios, onScenariosChange, currentNodes, onLoadToCanvas }: Props) {
  const models = useOpenRouterModels()
  const priceOf = useMemo(() => {
    const map = new Map((models ?? []).map((m) => [m.id, { in: m.in, out: m.out }]))
    return (id: string) => map.get(id)
  }, [models])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [utterance, setUtterance] = useState('Warum ist der Himmel blau?')
  const [ageBand, setAgeBand] = useState<'4-5' | '6-7'>('4-5')
  const [blind, setBlind] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, RunResult>>({})
  const [judgeOn, setJudgeOn] = useState(true)
  const [judgeModel, setJudgeModel] = useState('anthropic/claude-sonnet-4.6')
  const [rubric, setRubric] = useState('')
  const [showRubric, setShowRubric] = useState(false)
  const [judge, setJudge] = useState<{ verdict?: JudgeVerdict; ms?: number; error?: string } | null>(null)
  const [judgeRunning, setJudgeRunning] = useState(false)
  const [recording, setRecording] = useState(false)
  const [sttInfo, setSttInfo] = useState<string | null>(null)
  const recorderRef = useRef<PttRecorder | null>(null)

  const selected = selectedIds
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((s): s is Scenario => Boolean(s))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_COLUMNS) return prev
      return [...prev, id]
    })
    setResults({})
    setJudge(null)
    setRevealed(false)
  }

  /* ---------- Szenario-Verwaltung ---------- */

  const saveCurrent = () => {
    const name = window.prompt('Name für das Szenario (Snapshot des aktuellen Canvas):')
    if (!name?.trim()) return
    onScenariosChange([...scenarios, captureScenario(currentNodes, name.trim())])
  }
  const renameScenario = (s: Scenario) => {
    const name = window.prompt('Neuer Name:', s.name)
    if (!name?.trim()) return
    onScenariosChange(scenarios.map((x) => (x.id === s.id ? { ...x, name: name.trim() } : x)))
  }
  const duplicateScenario = (s: Scenario) => {
    onScenariosChange([...scenarios, { ...s, id: crypto.randomUUID(), name: `${s.name} (Kopie)`, createdAt: Date.now() }])
  }
  const deleteScenario = (s: Scenario) => {
    if (!window.confirm(`Szenario „${s.name}" löschen?`)) return
    onScenariosChange(scenarios.filter((x) => x.id !== s.id))
    setSelectedIds((prev) => prev.filter((x) => x !== s.id))
  }
  const exportScenario = (s: Scenario) => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `szenario-${s.name.replace(/\s+/g, '-')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const importScenario = (file: File) => {
    file.text().then((raw) => {
      try {
        const parsed = JSON.parse(raw)
        const items: Scenario[] = Array.isArray(parsed) ? parsed : [parsed]
        const fixed = items.map((s) => ({ ...s, id: crypto.randomUUID() }))
        onScenariosChange([...scenarios, ...fixed])
      } catch {
        window.alert('Kein gültiges Szenario-JSON.')
      }
    })
  }

  /* ---------- Mikrofon ---------- */

  const startRecording = async () => {
    try {
      const r = new PttRecorder()
      await r.start()
      recorderRef.current = r
      setRecording(true)
      setSttInfo(null)
    } catch (err) {
      setSttInfo(`Mikrofon nicht verfügbar: ${String(err)}`)
    }
  }
  const stopRecording = async () => {
    const r = recorderRef.current
    recorderRef.current = null
    if (!r) return
    setRecording(false)
    const { base64, seconds } = await r.stop()
    if (seconds < 0.4) return
    setSttInfo('Whisper transkribiert …')
    try {
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64 }),
      })
      const data = await res.json()
      if (data.ok) {
        setUtterance(data.text)
        setSttInfo(`STT: ${data.ms} ms`)
      } else setSttInfo(`⚠ ${data.error}`)
    } catch (err) {
      setSttInfo(`⚠ ${String(err)}`)
    }
  }

  /* ---------- Vergleich starten ---------- */

  const runComparison = useCallback(async () => {
    if (selected.length < 2 || !utterance.trim()) return
    setRunning(true)
    setResults({})
    setJudge(null)
    setRevealed(false)

    const runs = await Promise.all(
      selected.map(async (s) => {
        try {
          const res = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildRunPayload(s, utterance, ageBand)),
          })
          return [s.id, (await res.json()) as RunResult] as const
        } catch (err) {
          return [s.id, { ok: false, error: String(err) } as RunResult] as const
        }
      }),
    )
    const map = Object.fromEntries(runs)
    setResults(map)
    setRunning(false)

    if (judgeOn) {
      const answers = selected
        .map((s, i) => ({ label: LETTERS[i], text: map[s.id]?.answer ?? '' }))
        .filter((a) => a.text)
      if (answers.length >= 2) {
        setJudgeRunning(true)
        try {
          const res = await fetch('/api/judge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ utterance, ageBand, answers, model: judgeModel, rubric }),
          })
          const data = await res.json()
          setJudge(data.ok ? { verdict: data.verdict, ms: data.ms } : { error: data.error })
        } catch (err) {
          setJudge({ error: String(err) })
        } finally {
          setJudgeRunning(false)
        }
      }
    }
  }, [selected, utterance, ageBand, judgeOn, judgeModel, rubric])

  const hasResults = Object.keys(results).length > 0
  const winnerLabel = judge?.verdict?.winner

  return (
    <div className="flex h-full min-h-0">
      {/* Linke Leiste: Szenarien */}
      <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-mono text-[0.66rem] uppercase tracking-widest text-muted-foreground">Szenarien</span>
          <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Import
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(ev) => {
                const f = ev.target.files?.[0]
                if (f) importScenario(f)
                ev.target.value = ''
              }}
            />
          </label>
        </div>
        <div className="p-3">
          <Button variant="primary" className="w-full" onClick={saveCurrent}>
            ＋ Aktuellen Canvas speichern
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {scenarios.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Noch keine Szenarien. Stelle auf dem Canvas Modelle/Prompt ein und speichere den Stand.
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {scenarios.map((s) => {
              const idx = selectedIds.indexOf(s.id)
              const checked = idx >= 0
              const disabled = !checked && selectedIds.length >= MAX_COLUMNS
              return (
                <li key={s.id} className={`rounded-md border p-2 ${checked ? 'border-ring bg-accent/40' : 'border-border'}`}>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleSelect(s.id)}
                      title={checked ? 'Aus Vergleich entfernen' : 'Zum Vergleich hinzufügen'}
                      className={[
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-[0.6rem] font-bold',
                        checked ? 'border-ring bg-primary text-primary-foreground' : 'border-border',
                        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      {checked ? LETTERS[idx] : ''}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <div className="truncate font-mono text-[0.62rem] text-muted-foreground">
                        {shortModelName(s.models.main) ?? '—'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[0.6rem] text-muted-foreground">
                    <button type="button" className="hover:text-foreground" onClick={() => onLoadToCanvas(s)}>↺ laden</button>
                    <button type="button" className="hover:text-foreground" onClick={() => renameScenario(s)}>✎ umben.</button>
                    <button type="button" className="hover:text-foreground" onClick={() => duplicateScenario(s)}>⧉ dup.</button>
                    <button type="button" className="hover:text-foreground" onClick={() => exportScenario(s)}>⭳ export</button>
                    <button type="button" className="text-destructive/80 hover:text-destructive" onClick={() => deleteScenario(s)}>🗑</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      {/* Hauptbereich: Vergleich */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Steuerung */}
        <div className="flex flex-wrap items-end gap-3 border-b bg-card p-4">
          <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
            <Label htmlFor="arena-utterance">Kinderäußerung</Label>
            <Textarea
              id="arena-utterance"
              rows={2}
              value={utterance}
              onChange={(ev) => setUtterance(ev.target.value)}
              placeholder="Was sagt das Kind?"
            />
          </div>
          <button
            type="button"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={() => recording && stopRecording()}
            className={[
              'h-8 cursor-pointer select-none rounded-md border px-3 text-sm',
              recording ? 'border-status-risk bg-status-risk-soft text-status-risk' : 'border-border bg-secondary',
            ].join(' ')}
            title="Push-to-Talk"
          >
            {recording ? '● …' : '🎙'}
          </button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="arena-age">Altersband</Label>
            <select
              id="arena-age"
              value={ageBand}
              onChange={(ev) => setAgeBand(ev.target.value as '4-5' | '6-7')}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="4-5">4–5</option>
              <option value="6-7">6–7</option>
            </select>
          </div>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 text-sm">
            <input type="checkbox" checked={blind} onChange={(ev) => setBlind(ev.target.checked)} />
            Blind
          </label>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 text-sm">
            <input type="checkbox" checked={judgeOn} onChange={(ev) => setJudgeOn(ev.target.checked)} />
            Auto-Judge
          </label>
          <Button
            variant="primary"
            disabled={running || judgeRunning || selected.length < 2 || !utterance.trim()}
            onClick={runComparison}
          >
            {running ? 'Läuft …' : `▶ Vergleich (${selected.length})`}
          </Button>
        </div>

        {/* Judge-Optionen */}
        {judgeOn && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <span>Judge-Modell:</span>
            <Input className="h-7 w-64" value={judgeModel} onChange={(ev) => setJudgeModel(ev.target.value)} />
            <button type="button" className="underline hover:text-foreground" onClick={() => setShowRubric((v) => !v)}>
              Rubrik {showRubric ? 'ausblenden' : 'bearbeiten'}
            </button>
            {sttInfo && <span className="font-mono">{sttInfo}</span>}
          </div>
        )}
        {judgeOn && showRubric && (
          <div className="border-b bg-muted/40 px-4 py-2">
            <Textarea
              rows={4}
              value={rubric}
              placeholder="Leer = Standard-Rubrik (altersgerecht, sokratisch, Konsistenz, Wärme, Sicherheit)"
              onChange={(ev) => setRubric(ev.target.value)}
            />
          </div>
        )}

        {/* Spalten */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {selected.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Wähle links 2–3 Szenarien aus (Klick auf das Kästchen), gib eine Äußerung ein und starte den Vergleich.
            </p>
          ) : (
            <>
              {judge?.verdict && (
                <div className="mb-4 rounded-lg border border-status-ok bg-status-ok-soft p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold">
                      🏆 Gewinner: {winnerLabel}
                      {(revealed || !blind) && winnerLabel
                        ? ` — ${selected[LETTERS.indexOf(winnerLabel)]?.name ?? ''}`
                        : ''}
                    </span>
                    <span className="font-mono text-[0.7rem] text-muted-foreground">Judge {judge.ms} ms</span>
                  </div>
                  <p className="mt-1 text-sm">{judge.verdict.gesamturteil}</p>
                </div>
              )}
              {judge?.error && (
                <div className="mb-4 rounded-lg border border-status-warn bg-status-warn-soft p-3 text-xs">⚠ Judge: {judge.error}</div>
              )}
              {judgeRunning && (
                <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">Judge bewertet …</div>
              )}

              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))` }}>
                {selected.map((s, i) => {
                  const letter = LETTERS[i]
                  const r = results[s.id]
                  const cost = r?.stages ? costOfRun(r.stages, priceOf) : null
                  const jScore = judge?.verdict?.rankings.find((x) => x.label === letter)
                  const isWinner = winnerLabel === letter
                  return (
                    <div
                      key={s.id}
                      className={`flex flex-col gap-2 rounded-lg border p-3 ${isWinner ? 'border-status-ok ring-1 ring-status-ok/40' : 'border-border'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex size-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                          {letter}
                        </span>
                        <span className="truncate font-mono text-[0.66rem] text-muted-foreground">
                          {blind && !revealed ? '••• verborgen' : s.name}
                        </span>
                      </div>

                      {r && !r.ok && <p className="text-xs text-status-risk">⚠ {r.error}</p>}
                      {r?.ok && (
                        <>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.66rem] text-muted-foreground">
                            <span>{r.decision}{r.blocked ? ' · blockiert' : ''}</span>
                            <span>{r.totalMs} ms</span>
                            {cost && (
                              <span title="Hochrechnung bei ~1.100 Turns/Monat">
                                {formatUsd(cost.perTurn)}/Turn · ~{formatUsd(cost.perMonth)}/Kind·Mon
                              </span>
                            )}
                          </div>
                          <p className="text-sm">{r.answer}</p>
                          {jScore && (
                            <div className="mt-1 rounded-md bg-muted/60 p-2 text-[0.7rem]">
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono">
                                {Object.entries(jScore.scores).map(([k, v]) => (
                                  <span key={k}>
                                    {k.slice(0, 4)} <b className={v >= 4 ? 'text-status-ok' : v <= 2 ? 'text-status-risk' : ''}>{v}</b>
                                  </span>
                                ))}
                              </div>
                              <p className="mt-1 text-muted-foreground">{jScore.begruendung}</p>
                            </div>
                          )}
                        </>
                      )}
                      {!r && <p className="text-xs text-muted-foreground">—</p>}
                    </div>
                  )
                })}
              </div>

              {hasResults && blind && (
                <button
                  type="button"
                  className="mt-4 cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:border-ring"
                  onClick={() => setRevealed((v) => !v)}
                >
                  {revealed ? 'Wieder verbergen' : '🔓 Auflösen — welches Szenario ist welches?'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
