import { useCallback, useEffect, useRef, useState } from 'react'
import type { ArchNode } from '../types'
import { captureScenario, buildRunPayload } from '../scenarios'
import { S2SSession } from '../lib/s2sSession'
import type { S2SEreignis, SessionZustand } from '../lib/s2sSession'
import { ANFANGS_VERLAUF, reduziereEreignis, type VerlaufZustand } from '../lib/s2sVerlauf'
import { VoiceGlobe } from './VoiceGlobe'
import { S2SDiagram } from './S2SDiagram'
import type { StufenZustand } from './S2SDiagram'
import { Button, Select } from './ui'

/** Splitscreen: links die live laufende Architektur, rechts Globe und Gesprächsverlauf. */
export function S2SView({ nodes }: { nodes: ArchNode[] }) {
  const [zustand, setZustand] = useState<SessionZustand>('aus')
  const [stufen, setStufen] = useState<Record<string, StufenZustand>>({})
  const [verlaufZustand, setVerlaufZustand] = useState<VerlaufZustand>(ANFANGS_VERLAUF)
  // `payload()` wird pro Turn von S2SSession aufgerufen, aber nur EINMAL beim Start
  // übergeben (Closure über die damaligen Props). Läse `payload()` `verlaufZustand`
  // direkt, bekäme jeder Turn den Verlauf von Turn 1 — deshalb ein Ref, das bei jeder
  // Verlaufs-Änderung synchron mitgeführt wird.
  const verlaufRef = useRef<VerlaufZustand>(ANFANGS_VERLAUF)
  const [ageBand, setAgeBand] = useState<'4-5' | '6-7'>('4-5')
  const [fehler, setFehler] = useState<string | null>(null)
  // Getrennt von `fehler`: ein Safety-Abbruch ist eine reguläre, gewollte Verhaltensweise
  // der Pipeline — kein technischer Defekt. Beides im selben roten Fehlertext zu zeigen
  // suggeriert dem Kind/den Eltern fälschlich einen kaputten Dienst.
  const [pivotHinweis, setPivotHinweis] = useState<string | null>(null)
  const [warteschlange, setWarteschlange] = useState(0)
  const sessionRef = useRef<S2SSession | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  // Verlässt die Nutzerin die Ansicht (Header-Wechsel zu Canvas/Arena/Prüfstand) während
  // eine Session läuft, MUSS das Mikrofon sofort freigegeben werden — sonst laufen
  // MediaStream, AudioContext und der offene /api/s2s-Stream unbegrenzt weiter. Bei einem
  // Kinderprodukt ist ein "unsichtbar offenes Mikro" ein Vertrauens- und Datenschutzthema,
  // kein bloßer Ressourcen-Leak.
  useEffect(() => {
    return () => {
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [])

  const verarbeite = useCallback((ereignis: S2SEreignis) => {
    if (ereignis.type === 'stage' && ereignis.key) {
      setStufen((alt) => ({
        ...alt,
        [ereignis.key!]: {
          status: ereignis.status === 'aktiv' ? 'aktiv' : ereignis.status === 'fehler' ? 'fehler' : 'fertig',
          ms: ereignis.ms,
          detail: ereignis.detail,
        },
      }))
    }
    // Verlauf (Opener verwerfen, kuratierte Antworten übernehmen, Chunks zusammenführen)
    // ist als reine Funktion ausgelagert (s2sVerlauf.ts) — dort auch die Begründung, warum
    // eine Reihenfolge-Heuristik dafür nicht reicht.
    if (ereignis.type === 'transcript' || ereignis.type === 'text' || ereignis.type === 'audio') {
      setVerlaufZustand((alt) => {
        const neu = reduziereEreignis(alt, ereignis)
        verlaufRef.current = neu
        return neu
      })
    }
    // Ein neuer Turn beginnt hier (STT ist fertig, der Text steht) — eine Meldung vom
    // VORHERIGEN Turn (Fehler oder Sicherheits-Abbruch) darf jetzt nicht mehr stehen bleiben.
    if (ereignis.type === 'transcript') {
      setFehler(null)
      setPivotHinweis(null)
    }
    // Audio-Puffer: zählt tatsächlich synthetisierte Audio-Chunks, nicht Text-Chunks —
    // `S2SSession` queued/spielt genau ein Element pro `audio`-Ereignis (inkl. Opener,
    // Skript und Pivot). Eine echte "fertig abgespielt"-Rückmeldung gibt es aus der Session
    // nicht, daher bleibt das eine Näherung: "wie viele Audio-Chunks sind für diesen Turn
    // bislang eingetroffen", zurückgesetzt bei `done`/`abort`.
    if (ereignis.type === 'audio') setWarteschlange((n) => n + 1)
    if (ereignis.type === 'abort') {
      // Regulärer Safety-Pivot — kein technischer Fehler, deshalb neutral formuliert und
      // getrennt von `fehler` gehalten (siehe Deklaration oben).
      setPivotHinweis('Abbruch aus Sicherheitsgründen — der Begleiter hat auf eine andere Antwort umgeschaltet.')
      setWarteschlange(0)
    }
    if (ereignis.type === 'done') setWarteschlange(0)
  }, [])

  const payload = useCallback(() => {
    const szenario = captureScenario(nodes, 's2s')
    // Ohne history sieht der Server jeden Turn isoliert: dialogLength bleibt 0, die
    // Ein-Wort-Regel des Routers greift bei JEDER kurzen Antwort ("Ja", "Sieben") und
    // erzwingt eine Rückfrage — das Gespräch wäre ab Turn 2 nicht führbar. `verlaufRef`
    // (nicht `verlaufZustand`) ist hier Pflicht, siehe Kommentar an der Deklaration.
    const history = verlaufRef.current.verlauf
      .filter((n) => n.text.trim())
      .map((n) => ({ role: n.rolle === 'kind' ? 'user' : 'assistant', text: n.text }))
    return { ...buildRunPayload(szenario, '', ageBand), history, sessionId: 's2s-live' }
  }, [nodes, ageBand])

  const umschalten = useCallback(async () => {
    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
      setAnalyser(null)
      // Manueller Abbruch mitten in einem Turn darf keine eingefrorene Anzeige hinterlassen:
      // ohne Reset bliebe z. B. "Haupt-LLM" dauerhaft als "aktiv" markiert und der
      // Audio-Puffer auf dem letzten Stand vor dem Stopp stehen.
      setStufen({})
      setWarteschlange(0)
      return
    }
    setFehler(null)
    setPivotHinweis(null)
    setStufen({})
    // Neue Session, neues Gespräch: ein stehengebliebener Verlauf der vorigen Session
    // würde sonst als (falscher) Kontext in den ersten Turn der neuen Session einfließen.
    setVerlaufZustand(ANFANGS_VERLAUF)
    verlaufRef.current = ANFANGS_VERLAUF
    // Erfolgreicher Start setzt onZustand mindestens einmal auf einen Nicht-"aus"-Wert
    // (S2SSession.start() ruft es synchron mit 'hoert_zu' auf, bevor es zurückkehrt).
    // Schlägt der Start fehl (z. B. Mikrofon verweigert), meldet start() das nur über
    // onFehler und onZustand feuert nie — ohne dieses Flag bliebe ein toter Ref stehen,
    // und der nächste Klick würde fälschlich in den Stop-Zweig laufen statt neu zu starten.
    let gestartet = false
    const session = new S2SSession({
      payload,
      onEreignis: verarbeite,
      onZustand: (z) => {
        if (z !== 'aus') gestartet = true
        setZustand(z)
        setAnalyser(sessionRef.current?.getAnalyser(z) ?? null)
      },
      onFehler: (m) => setFehler(m),
      onVadZustand: (status) =>
        setStufen((alt) => ({
          ...alt,
          vad: {
            status,
            detail: status === 'aktiv' ? 'Sprache erkannt (Client)' : 'Turn abgeschickt (Client)',
          },
        })),
    })
    sessionRef.current = session
    await session.start()
    if (!gestartet) {
      sessionRef.current = null
      return
    }
    setAnalyser(session.getAnalyser('hoert_zu'))
  }, [payload, verarbeite])

  const aktiv = zustand !== 'aus'

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 border-r">
        <S2SDiagram stufen={stufen} warteschlange={warteschlange} />
      </div>

      <div className="flex w-[46%] min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <span className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">Gespräch</span>
          <Select
            value={ageBand}
            onChange={(ev) => setAgeBand(ev.target.value as '4-5' | '6-7')}
            disabled={aktiv}
            title={aktiv ? 'Erst nach Sessionende änderbar' : undefined}
            className="h-7 w-24 text-xs"
          >
            <option value="4-5">4–5 J.</option>
            <option value="6-7">6–7 J.</option>
          </Select>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <VoiceGlobe zustand={zustand} analyser={analyser} />
          <Button onClick={() => void umschalten()}>{aktiv ? '■ Gespräch beenden' : '● Gespräch starten'}</Button>
          {fehler && <p className="max-w-sm text-center text-xs text-status-risk">{fehler}</p>}
          {!fehler && pivotHinweis && <p className="max-w-sm text-center text-xs text-status-warn">{pivotHinweis}</p>}
          {!aktiv && !fehler && !pivotHinweis && (
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              Ein Druck startet die Session: Das Mikrofon bleibt offen, die Sprecherkennung merkt selbst, wann du
              fertig gesprochen hast. Erneut drücken beendet.
            </p>
          )}
        </div>

        <div className="max-h-[38%] min-h-0 overflow-y-auto border-t px-4 py-3">
          {verlaufZustand.verlauf.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch kein Gespräch.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {verlaufZustand.verlauf.map((n, i) => (
                <li key={i} className="text-sm">
                  <span className="mr-2 font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                    {n.rolle === 'kind' ? 'Kind' : '🧸'}
                  </span>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
