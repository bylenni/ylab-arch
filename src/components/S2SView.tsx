import { useCallback, useRef, useState } from 'react'
import type { ArchNode } from '../types'
import { captureScenario, buildRunPayload } from '../scenarios'
import { S2SSession } from '../lib/s2sSession'
import type { S2SEreignis, SessionZustand } from '../lib/s2sSession'
import { VoiceGlobe } from './VoiceGlobe'
import { S2SDiagram } from './S2SDiagram'
import type { StufenZustand } from './S2SDiagram'
import { Button, Select } from './ui'

interface Nachricht {
  rolle: 'kind' | 'begleiter'
  text: string
}

/** Splitscreen: links die live laufende Architektur, rechts Globe und Gesprächsverlauf. */
export function S2SView({ nodes }: { nodes: ArchNode[] }) {
  const [zustand, setZustand] = useState<SessionZustand>('aus')
  const [stufen, setStufen] = useState<Record<string, StufenZustand>>({})
  const [verlauf, setVerlauf] = useState<Nachricht[]>([])
  const [ageBand, setAgeBand] = useState<'4-5' | '6-7'>('4-5')
  const [fehler, setFehler] = useState<string | null>(null)
  const [warteschlange, setWarteschlange] = useState(0)
  const sessionRef = useRef<S2SSession | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  // Der Opener ("Hmm, lass mich kurz überlegen …") ist pro Turn immer der ERSTE
  // `text`-Chunk mit index: -1 — reine Denkzeit-Überbrückung, kein Gesprächsinhalt.
  // Kuratierte Antworten (Skript-Pfad, Pivot beim Abbruch) tragen ebenfalls index: -1,
  // kommen aber immer NACH dem Opener und sind echte Antworten, die im Verlauf
  // erscheinen sollen. Da `S2SEreignis` bei `text` kein `kind` mitschickt (nur `audio`
  // tut das), unterscheiden wir per Reihenfolge: das Flag wird bei jedem neuen Turn
  // (Start der STT-Stufe) gesetzt und beim ersten `text`-Ereignis wieder gelöscht.
  const openerAussteht = useRef(false)

  const verarbeite = useCallback((ereignis: S2SEreignis) => {
    if (ereignis.type === 'stage' && ereignis.key) {
      if (ereignis.key === 'stt' && ereignis.status === 'aktiv') openerAussteht.current = true
      setStufen((alt) => ({
        ...alt,
        [ereignis.key!]: {
          status: ereignis.status === 'aktiv' ? 'aktiv' : ereignis.status === 'fehler' ? 'fehler' : 'fertig',
          ms: ereignis.ms,
          detail: ereignis.detail,
        },
      }))
    }
    if (ereignis.type === 'transcript' && ereignis.text) {
      setVerlauf((alt) => [...alt, { rolle: 'kind', text: ereignis.text! }])
    }
    if (ereignis.type === 'text' && ereignis.chunk) {
      const istOpenerFuellsatz = openerAussteht.current
      openerAussteht.current = false
      if (!istOpenerFuellsatz) {
        setVerlauf((alt) => {
          const letzte = alt[alt.length - 1]
          if (letzte?.rolle === 'begleiter') {
            return [...alt.slice(0, -1), { rolle: 'begleiter', text: `${letzte.text} ${ereignis.chunk}`.trim() }]
          }
          return [...alt, { rolle: 'begleiter', text: ereignis.chunk! }]
        })
      }
    }
    // Audio-Puffer: zählt tatsächlich synthetisierte Audio-Chunks, nicht Text-Chunks —
    // `S2SSession` queued/spielt genau ein Element pro `audio`-Ereignis (inkl. Opener,
    // Skript und Pivot). Der Brief zählte `text`-Ereignisse hoch; das läuft dem Text
    // faktisch parallel (ein `text` pro `audio`), misst aber semantisch den Textstrom,
    // nicht den Audio-Puffer. Eine echte "fertig abgespielt"-Rückmeldung gibt es aus der
    // Session nicht, daher bleibt das eine Näherung: "wie viele Audio-Chunks sind für
    // diesen Turn bislang eingetroffen", zurückgesetzt bei `done`/`abort`.
    if (ereignis.type === 'audio') setWarteschlange((n) => n + 1)
    if (ereignis.type === 'abort') {
      setFehler(`Abgebrochen: ${ereignis.grund ?? 'unbekannt'}`)
      setWarteschlange(0)
    }
    if (ereignis.type === 'done') setWarteschlange(0)
  }, [])

  const payload = useCallback(() => {
    const szenario = captureScenario(nodes, 's2s')
    return { ...buildRunPayload(szenario, '', ageBand), sessionId: 's2s-live' }
  }, [nodes, ageBand])

  const umschalten = useCallback(async () => {
    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
      setAnalyser(null)
      return
    }
    setFehler(null)
    setStufen({})
    const session = new S2SSession({
      payload,
      onEreignis: verarbeite,
      onZustand: (z) => {
        setZustand(z)
        setAnalyser(sessionRef.current?.getAnalyser(z) ?? null)
      },
      onFehler: (m) => setFehler(m),
    })
    sessionRef.current = session
    await session.start()
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
          <Select value={ageBand} onChange={(ev) => setAgeBand(ev.target.value as '4-5' | '6-7')} className="h-7 w-24 text-xs">
            <option value="4-5">4–5 J.</option>
            <option value="6-7">6–7 J.</option>
          </Select>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <VoiceGlobe zustand={zustand} analyser={analyser} />
          <Button onClick={() => void umschalten()}>{aktiv ? '■ Gespräch beenden' : '● Gespräch starten'}</Button>
          {fehler && <p className="max-w-sm text-center text-xs text-status-risk">{fehler}</p>}
          {!aktiv && !fehler && (
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              Ein Druck startet die Session: Das Mikrofon bleibt offen, die Sprecherkennung merkt selbst, wann du
              fertig gesprochen hast. Erneut drücken beendet.
            </p>
          )}
        </div>

        <div className="max-h-[38%] min-h-0 overflow-y-auto border-t px-4 py-3">
          {verlauf.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch kein Gespräch.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {verlauf.map((n, i) => (
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
