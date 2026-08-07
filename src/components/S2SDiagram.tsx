import { shortModelName } from '../scenarios'
import { ModelSelect } from './ModelSelect'

export interface StufenZustand {
  status: 'ruhend' | 'aktiv' | 'fertig' | 'fehler'
  ms?: number
  detail?: string
  /** Modell, mit dem diese Stufe beim letzten Lauf TATSÄCHLICH arbeitete (Server-Meldung,
   *  nur triage/main/safety/guard) — kann kurz nach einer Umstellung noch den alten Wert
   *  zeigen, siehe Abweichungs-Hinweis in der Zeilendarstellung unten. */
  model?: string
}

/** Dropdown-Steuerung einer Modell-Stufe. Fehlt der Eintrag für eine Stufe (kein passender
 *  Canvas-Knoten), bleibt sie reine Anzeige — siehe S2SView.nodeKindForStage. */
export interface ModellStufe {
  /** Am Canvas-Knoten eingestellter Wert — Quelle der Wahrheit für den Dropdown-Wert
   *  (nicht das zuletzt gemeldete `StufenZustand.model`). */
  configuredModel: string
  onChange: (model: string) => void
  disabled: boolean
  disabledTitle?: string
}

type ModellStufenKey = 'triage' | 'main' | 'safety'

interface Props {
  stufen: Record<string, StufenZustand>
  warteschlange: number
  modelStufen: Partial<Record<ModellStufenKey, ModellStufe>>
}

/** Reihenfolge und Beschriftung der Kette — bewusst fest, das ist die Architektur. */
const STUFEN: { key: string; label: string; hinweis: string; modelStufe?: ModellStufenKey }[] = [
  { key: 'vad', label: 'VAD', hinweis: 'Sprecherkennung im Client (energie-basiert)' },
  { key: 'stt', label: 'STT', hinweis: 'whisper.cpp, lokal' },
  { key: 'opener', label: 'Opener', hinweis: 'vorsynthetisiert — überbrückt die Denkzeit' },
  { key: 'triage', label: 'Triage', hinweis: 'Intent, Risiko, Emotion', modelStufe: 'triage' },
  { key: 'router', label: 'Router', hinweis: 'deterministisch, fail-closed' },
  { key: 'planner', label: 'Teaching Planner', hinweis: 'Strategie, kein LLM' },
  { key: 'main', label: 'Haupt-LLM (Stream)', hinweis: 'generiert satzweise', modelStufe: 'main' },
  { key: 'guard', label: 'Guard (Satz 1)', hinweis: 'gibt den ersten Satz frei — nutzt das Safety-Modell' },
  { key: 'safety', label: 'Vollprüfung', hinweis: 'gibt alle weiteren Sätze frei', modelStufe: 'safety' },
  { key: 'script', label: 'Kuratierte Antwort', hinweis: 'sensibler Pfad, vorsynthetisiert' },
]

const FARBE: Record<StufenZustand['status'], string> = {
  ruhend: 'var(--muted-foreground)',
  aktiv: 'var(--status-warn)',
  fertig: 'var(--status-ok)',
  fehler: 'var(--status-risk)',
}

/** Live-Flussdiagramm der s2s-Kette: mehrere Stufen können gleichzeitig aktiv sein. */
export function S2SDiagram({ stufen, warteschlange, modelStufen }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">
          Speech-to-Speech · live
        </h2>
        {/* Zählt alle im laufenden Turn eingetroffenen Audio-Chunks (Näherung, keine
            Rückmeldung über bereits Abgespieltes) — "Puffer" suggeriert fälschlich einen
            wartenden Füllstand, der Wert läuft nur hoch. */}
        <span className="font-mono text-[0.62rem] text-muted-foreground">
          Audio-Chunks: {warteschlange}
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
                {stufe.modelStufe && (
                  <ModellZeile
                    id={`s2s-modell-${stufe.key}`}
                    stufe={modelStufen[stufe.modelStufe]}
                    gelaufenesModell={zustand.model}
                  />
                )}
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

/** Modell-Zeile einer Stufe: Dropdown, wenn ein passender Canvas-Knoten existiert, sonst nur
 *  die letzte Server-Meldung als Text. Der Dropdown-Wert kommt IMMER vom Canvas (Quelle der
 *  Wahrheit fürs nächste Gespräch); `gelaufenesModell` ist nur die Meldung, mit welchem Modell
 *  der letzte Durchlauf TATSÄCHLICH lief. Beides kann kurz nach einer Umstellung auseinander-
 *  fallen — statt das zu verschweigen oder den Dropdown-Wert dafür zu "korrigieren" (was den
 *  Nutzer zwingen würde, den gerade gewählten Wert wieder im Blick zu behalten), zeigen wir den
 *  Unterschied explizit als kleinen, erklärten Hinweis an. */
function ModellZeile({
  id, stufe, gelaufenesModell,
}: { id: string; stufe: ModellStufe | undefined; gelaufenesModell?: string }) {
  if (!stufe) {
    // Kein passender Canvas-Knoten: reine Anzeige der letzten Server-Meldung.
    return gelaufenesModell ? (
      <p className="mt-1 truncate font-mono text-[0.6rem] text-muted-foreground">{shortModelName(gelaufenesModell)}</p>
    ) : null
  }
  const abweichend = Boolean(gelaufenesModell) && gelaufenesModell !== stufe.configuredModel
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <ModelSelect
        id={id}
        value={stufe.configuredModel}
        onChange={stufe.onChange}
        disabled={stufe.disabled}
        title={stufe.disabled ? stufe.disabledTitle : undefined}
        className="h-6 flex-1 text-[0.62rem]"
      />
      {abweichend && (
        <span
          className="shrink-0 font-mono text-[0.58rem] text-muted-foreground"
          title="Der letzte Durchlauf lief noch mit dem vorherigen Modell — eine Umstellung greift erst ab dem nächsten Turn."
        >
          lief: {shortModelName(gelaufenesModell)}
        </span>
      )}
    </div>
  )
}
