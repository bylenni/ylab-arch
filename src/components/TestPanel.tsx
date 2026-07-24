import { useRef, useState } from 'react'
import type { SimResult, SimStep } from '../simulate'
import { testPresets } from '../presets'
import type { RunMode, AgeBand } from '../App'
import { PttRecorder } from '../lib/recorder'
import { Button, Label, Select, Textarea } from './ui'

interface Props {
  result: SimResult | null
  visibleSteps: number
  running: boolean
  onRun: (utterance: string, mode: RunMode, ageBand: AgeBand) => void
  onReset: () => void
}

const DECISION_LABEL: Record<SimResult['decision'], string> = {
  normal: 'Normaler Pfad',
  sensibel: 'Sensibler Pfad',
  unklar: 'Rückfrage',
}

const outcomeStyles: Record<'ok' | 'warn' | 'risk', string> = {
  ok: 'border-status-ok bg-status-ok-soft',
  warn: 'border-status-warn bg-status-warn-soft',
  risk: 'border-status-risk bg-status-risk-soft',
}

const stepBorder: Record<SimStep['status'], string> = {
  ok: 'border-l-status-ok',
  warn: 'border-l-status-warn',
  risk: 'border-l-status-risk',
}

export function TestPanel({ result, visibleSteps, running, onRun, onReset }: Props) {
  const [utterance, setUtterance] = useState('Warum ist der Himmel blau?')
  const [mode, setMode] = useState<RunMode>('heuristik')
  const [ageBand, setAgeBand] = useState<AgeBand>('4-5')
  const [recording, setRecording] = useState(false)
  const [sttInfo, setSttInfo] = useState<string | null>(null)
  const [ttsInfo, setTtsInfo] = useState<string | null>(null)
  const [ttsBusy, setTtsBusy] = useState(false)
  const recorderRef = useRef<PttRecorder | null>(null)

  const startRecording = async () => {
    try {
      const recorder = new PttRecorder()
      await recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setSttInfo(null)
    } catch (err) {
      setSttInfo(`Mikrofon nicht verfügbar: ${String(err)}`)
    }
  }

  const stopRecording = async () => {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (!recorder) return
    setRecording(false)
    try {
      const { base64, seconds } = await recorder.stop()
      if (seconds < 0.4) {
        setSttInfo('Aufnahme zu kurz — Button gedrückt halten, sprechen, loslassen.')
        return
      }
      setSttInfo('Whisper transkribiert …')
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64 }),
      })
      const data = await res.json()
      if (!data.ok) {
        setSttInfo(`⚠ ${data.error}`)
        return
      }
      setUtterance(data.text)
      setSttInfo(`STT: ${data.ms} ms · ${seconds.toFixed(1)} s Audio · ${data.engine}`)
    } catch (err) {
      setSttInfo(`⚠ STT fehlgeschlagen: ${String(err)}`)
    }
  }

  const speakAnswer = async (text: string) => {
    setTtsBusy(true)
    setTtsInfo(null)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!data.ok) {
        setTtsInfo(`⚠ ${data.error}`)
        return
      }
      await new Audio(`data:audio/wav;base64,${data.audio}`).play()
      setTtsInfo(`TTS: ${data.ms} ms · ${data.engine}`)
    } catch (err) {
      setTtsInfo(`⚠ TTS fehlgeschlagen: ${String(err)}`)
    } finally {
      setTtsBusy(false)
    }
  }

  const done = result !== null && !running
  const failed = done && result.steps.length === 0
  const shownSteps = result ? result.steps.slice(0, visibleSteps) : []
  const outcomeTone: 'ok' | 'warn' | 'risk' = result?.blocked ? 'risk' : result?.decision === 'normal' ? 'ok' : 'warn'

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Modus</Label>
          <div className="inline-flex rounded-md border bg-muted p-0.5">
            {(
              [
                ['heuristik', 'Heuristik'],
                ['live', 'Live'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={[
                  'cursor-pointer rounded-[calc(var(--radius)-4px)] px-2.5 py-0.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  mode === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="age-band">Altersband</Label>
          <Select id="age-band" className="w-24" value={ageBand} onChange={(ev) => setAgeBand(ev.target.value as AgeBand)}>
            <option value="4-5">4–5</option>
            <option value="6-7">6–7</option>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === 'heuristik'
          ? 'Heuristik: Keyword-Regeln simulieren die Modelle — testet Routing-Logik und Latenzbudget offline.'
          : 'Live: Die Äußerung läuft über OpenRouter durch echte Modelle. Welches Modell pro Step läuft, steht in der Konfiguration der Triage-, LLM- und Safety-Knoten (Schlüssel „model").'}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {testPresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="cursor-pointer rounded-full border bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={() => setUtterance(preset.text)}
            title={preset.text}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Textarea
        rows={2}
        value={utterance}
        onChange={(ev) => setUtterance(ev.target.value)}
        placeholder="Was sagt das Kind?"
      />

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={() => recording && stopRecording()}
          className={[
            'w-full cursor-pointer select-none rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            recording
              ? 'border-status-risk bg-status-risk-soft text-status-risk'
              : 'border-border bg-secondary text-secondary-foreground hover:border-ring',
          ].join(' ')}
        >
          {recording ? '● Aufnahme läuft — loslassen zum Senden' : '🎙 Push-to-Talk: halten, sprechen, loslassen'}
        </button>
        {sttInfo && <p className="font-mono text-[0.7rem] text-muted-foreground">{sttInfo}</p>}
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={running || utterance.trim() === ''}
          onClick={() => onRun(utterance, mode, ageBand)}
        >
          {running ? (mode === 'live' ? 'Modelle antworten …' : 'Läuft …') : '▶ Testlauf starten'}
        </Button>
        {result && (
          <Button onClick={onReset} title="Ergebnis und Pfad-Hervorhebung zurücksetzen" aria-label="Testlauf zurücksetzen">
            ↺ Zurücksetzen
          </Button>
        )}
      </div>

      {result && (
        <div className="flex flex-col gap-3">
          {done && !failed && (
            <div className={`rounded-lg border p-3 ${outcomeStyles[outcomeTone]}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">
                  {DECISION_LABEL[result.decision]}
                  {result.blocked ? ' · Output blockiert' : ''}
                </span>
                <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                  {result.totalMs} ms
                </span>
              </div>
              {result.answer && <p className="mt-2 text-sm">🔊 „{result.answer}"</p>}
              {result.answer && (
                <div className="mt-2 flex items-center gap-2">
                  <Button disabled={ttsBusy} onClick={() => speakAnswer(result.answer)}>
                    {ttsBusy ? 'Synthetisiert …' : '▶ Anhören (TTS)'}
                  </Button>
                  {ttsInfo && <span className="font-mono text-[0.7rem] text-muted-foreground">{ttsInfo}</span>}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {result.totalMs <= 1500
                  ? 'Im Zielkorridor (p50 ≈ 1,5 s). Earcon deckt die Wartezeit.'
                  : result.totalMs <= 2500
                    ? 'Realistisch, aber über p50-Ziel — Earcon + Denk-Floskel nötig.'
                    : 'Zu langsam: Kette kürzen, kleinere Modelle oder parallelisieren.'}
              </p>
            </div>
          )}

          <ol className="flex flex-col gap-1.5">
            {shownSteps.map((step, index) => (
              <li
                key={`${step.nodeId}-${index}`}
                className={`sim-step-enter rounded-r-lg border-l-[3px] bg-muted/60 px-3 py-2 ${stepBorder[step.status]}`}
              >
                <div className="flex justify-between gap-2">
                  <span className="text-[0.82rem] font-semibold">{step.label}</span>
                  <span className="whitespace-nowrap font-mono text-[0.72rem] tabular-nums text-muted-foreground">
                    {step.latencyMs > 0 ? `+${step.latencyMs} ms` : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
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
      )}
    </div>
  )
}
