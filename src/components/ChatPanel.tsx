import { useEffect, useRef, useState } from 'react'
import { testPresets } from '../presets'
import type { RunMode, AgeBand, ChatMessage } from '../App'
import { PttRecorder } from '../lib/recorder'

interface Props {
  conversation: ChatMessage[]
  running: boolean
  onRun: (utterance: string, mode: RunMode, ageBand: AgeBand) => void
  onReset: () => void
}

export function ChatPanel({ conversation, running, onRun, onReset }: Props) {
  const [utterance, setUtterance] = useState('')
  const [mode, setMode] = useState<RunMode>('heuristik')
  const [ageBand, setAgeBand] = useState<AgeBand>('4-5')
  const [recording, setRecording] = useState(false)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [ttsBusy, setTtsBusy] = useState(false)
  const recorderRef = useRef<PttRecorder | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [conversation.length, running])

  const autoresize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || running) return
    onRun(trimmed, mode, ageBand)
    setUtterance('')
    requestAnimationFrame(autoresize)
  }

  /* ---------- Mikrofon (Push-to-Talk) ---------- */

  const startRecording = async () => {
    try {
      const recorder = new PttRecorder()
      await recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setStatusLine(null)
    } catch (err) {
      setStatusLine(`Mikrofon nicht verfügbar: ${String(err)}`)
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
        setStatusLine('Aufnahme zu kurz — Mikrofon gedrückt halten.')
        return
      }
      setStatusLine('Whisper transkribiert …')
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64 }),
      })
      const data = await res.json()
      if (!data.ok) {
        setStatusLine(`⚠ ${data.error}`)
        return
      }
      setStatusLine(`STT: ${data.ms} ms · lokal (whisper.cpp)`)
      send(data.text)
    } catch (err) {
      setStatusLine(`⚠ STT fehlgeschlagen: ${String(err)}`)
    }
  }

  /* ---------- TTS ---------- */

  const speak = async (text: string) => {
    setTtsBusy(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!data.ok) {
        setStatusLine(`⚠ ${data.error}`)
        return
      }
      await new Audio(`data:audio/wav;base64,${data.audio}`).play()
      setStatusLine(`TTS: ${data.ms} ms · ${data.engine}`)
    } catch (err) {
      setStatusLine(`⚠ TTS fehlgeschlagen: ${String(err)}`)
    } finally {
      setTtsBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Kopfzeile */}
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
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
              title={id === 'live' ? 'Echte Modelle via OpenRouter, Multi-Turn mit Erfolgssignal' : 'Offline-Simulation mit Keyword-Regeln'}
              className={[
                'cursor-pointer rounded-[calc(var(--radius)-4px)] px-2.5 py-0.5 text-xs font-medium transition-colors',
                mode === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={ageBand}
          onChange={(ev) => setAgeBand(ev.target.value as AgeBand)}
          title="Altersband des Kindes"
          className="h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs"
        >
          <option value="4-5">4–5 J.</option>
          <option value="6-7">6–7 J.</option>
        </select>
        <div className="flex-1" />
        {conversation.length > 0 && (
          <button
            type="button"
            onClick={onReset}
            title="Neues Gespräch — Verlauf und Hervorhebung zurücksetzen"
            className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-ring hover:text-foreground"
          >
            ↺ Neu
          </button>
        )}
      </div>

      {/* Nachrichtenverlauf */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {conversation.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
            <p className="text-2xl">🧸</p>
            <p className="text-sm font-semibold">Was sagt das Kind?</p>
            <p className="text-xs text-muted-foreground">
              Tippen, Mikrofon halten — oder ein Beispiel wählen:
            </p>
            <div className="grid w-full grid-cols-2 gap-2">
              {testPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => send(preset.text)}
                  className="cursor-pointer rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-ring"
                >
                  <span className="block text-xs font-semibold">{preset.label}</span>
                  <span className="mt-0.5 block truncate text-[0.7rem] text-muted-foreground">{preset.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {conversation.map((msg, index) =>
              msg.role === 'user' ? (
                <div key={index} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div key={index} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">🧸</span>
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[0.64rem] text-muted-foreground">
                      {msg.meta && <span>{msg.meta}</span>}
                      <button
                        type="button"
                        disabled={ttsBusy}
                        onClick={() => speak(msg.text)}
                        className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline"
                      >
                        ▶ anhören
                      </button>
                    </div>
                  </div>
                </div>
              ),
            )}
            {running && (
              <div className="flex gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">🧸</span>
                <div className="flex items-center gap-1 py-1.5">
                  <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
                  <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
                  <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t bg-card p-3">
        {statusLine && <p className="mb-1.5 font-mono text-[0.64rem] text-muted-foreground">{statusLine}</p>}
        <div className="flex items-end gap-1.5 rounded-xl border border-input bg-background p-1.5 focus-within:border-ring">
          <button
            type="button"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={() => recording && stopRecording()}
            title="Push-to-Talk: halten, sprechen, loslassen"
            className={[
              'flex size-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-lg text-base transition-colors',
              recording ? 'bg-status-risk-soft text-status-risk' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}
          >
            {recording ? '●' : '🎙'}
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={utterance}
            placeholder="Was sagt das Kind?"
            onChange={(ev) => {
              setUtterance(ev.target.value)
              autoresize()
            }}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault()
                send(utterance)
              }
            }}
            className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            disabled={running || !utterance.trim()}
            onClick={() => send(utterance)}
            title="Senden (Enter)"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            ↑
          </button>
        </div>
        <p className="mt-1.5 text-center font-mono text-[0.6rem] text-muted-foreground">
          {mode === 'live' ? 'Live · Multi-Turn mit Erfolgssignal' : 'Heuristik · offline, Einzelturn-Logik'} · Enter sendet
        </p>
      </div>
    </div>
  )
}
