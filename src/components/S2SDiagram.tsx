export interface StufenZustand {
  status: 'ruhend' | 'aktiv' | 'fertig' | 'fehler'
  ms?: number
  detail?: string
}

interface Props {
  stufen: Record<string, StufenZustand>
  warteschlange: number
}

/** Reihenfolge und Beschriftung der Kette — bewusst fest, das ist die Architektur. */
const STUFEN: { key: string; label: string; hinweis: string }[] = [
  { key: 'vad', label: 'VAD', hinweis: 'Sprecherkennung im Client (energie-basiert)' },
  { key: 'stt', label: 'STT', hinweis: 'whisper.cpp, lokal' },
  { key: 'opener', label: 'Opener', hinweis: 'vorsynthetisiert — überbrückt die Denkzeit' },
  { key: 'triage', label: 'Triage', hinweis: 'Intent, Risiko, Emotion' },
  { key: 'router', label: 'Router', hinweis: 'deterministisch, fail-closed' },
  { key: 'planner', label: 'Teaching Planner', hinweis: 'Strategie, kein LLM' },
  { key: 'main', label: 'Haupt-LLM (Stream)', hinweis: 'generiert satzweise' },
  { key: 'guard', label: 'Guard (Satz 1)', hinweis: 'gibt den ersten Satz frei' },
  { key: 'safety', label: 'Vollprüfung', hinweis: 'gibt alle weiteren Sätze frei' },
  { key: 'script', label: 'Kuratierte Antwort', hinweis: 'sensibler Pfad, vorsynthetisiert' },
]

const FARBE: Record<StufenZustand['status'], string> = {
  ruhend: 'var(--muted-foreground)',
  aktiv: 'var(--status-warn)',
  fertig: 'var(--status-ok)',
  fehler: 'var(--status-risk)',
}

/** Live-Flussdiagramm der s2s-Kette: mehrere Stufen können gleichzeitig aktiv sein. */
export function S2SDiagram({ stufen, warteschlange }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">
          Speech-to-Speech · live
        </h2>
        <span className="font-mono text-[0.62rem] text-muted-foreground">
          Audio-Puffer: {warteschlange}
        </span>
      </div>

      {STUFEN.map((stufe, i) => {
        const zustand = stufen[stufe.key] ?? { status: 'ruhend' as const }
        const farbe = FARBE[zustand.status]
        return (
          <div key={stufe.key} className="flex flex-col">
            <div
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 transition-colors"
              style={{ borderColor: zustand.status === 'ruhend' ? 'var(--border)' : farbe }}
            >
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: farbe, opacity: zustand.status === 'aktiv' ? 1 : 0.5 }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.84rem] font-semibold">{stufe.label}</span>
                  {zustand.ms !== undefined && (
                    <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground">{zustand.ms} ms</span>
                  )}
                </div>
                <p className="truncate text-[0.66rem] text-muted-foreground">{zustand.detail ?? stufe.hinweis}</p>
              </div>
            </div>
            {i < STUFEN.length - 1 && <div className="ml-[1.05rem] h-2 w-px bg-border" />}
          </div>
        )
      })}

      <p className="mt-2 text-[0.6rem] leading-tight text-muted-foreground/70">
        Entkoppelte Stufen nach dem Muster von huggingface/speech-to-speech — gesprochen wird bereits, während
        weiter generiert wird. Der erste Satz braucht die Guard-Freigabe, alle weiteren die Vollprüfung.
      </p>
    </div>
  )
}
