import { useEffect, useRef, useState } from 'react'
import type { SessionZustand } from '../lib/s2sSession'

interface Props {
  zustand: SessionZustand
  analyser: AnalyserNode | null
}

const FARBE: Record<SessionZustand, string> = {
  aus: 'var(--muted-foreground)',
  hoert_zu: 'var(--status-ok)',
  denkt: 'var(--status-warn)',
  spricht: 'var(--chart-2)',
}

const BESCHRIFTUNG: Record<SessionZustand, string> = {
  aus: 'aus',
  hoert_zu: 'hört zu',
  denkt: 'denkt nach',
  spricht: 'spricht',
}

/** Sprach-Globe: SVG-Sphäre, deren Ringe mit der Amplitude atmen.
 *  Beim Zuhören folgt sie dem Mikrofon, beim Sprechen der Ausgabe. */
export function VoiceGlobe({ zustand, analyser }: Props) {
  const [pegel, setPegel] = useState(0)
  const [phase, setPhase] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const daten = new Uint8Array(analyser?.frequencyBinCount ?? 32)
    const tick = () => {
      if (analyser && zustand !== 'aus') {
        analyser.getByteFrequencyData(daten)
        let summe = 0
        for (let i = 0; i < daten.length; i += 1) summe += daten[i]
        setPegel(Math.min(1, summe / daten.length / 128))
      } else {
        setPegel(0)
      }
      setPhase((p) => (p + 0.6) % 360)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser, zustand])

  const farbe = FARBE[zustand]
  const aktiv = zustand !== 'aus'
  // „denkt" hat kein Audiosignal — dort atmet der Globe von selbst
  const staerke = zustand === 'denkt' ? 0.35 + 0.15 * Math.sin((phase * Math.PI) / 90) : pegel
  const radius = 60 + staerke * 22

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 240 240" className="h-56 w-56" role="img" aria-label={`Sprachstatus: ${BESCHRIFTUNG[zustand]}`}>
        {/* Aussenringe reagieren auf den Pegel */}
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="120" cy="120"
            r={radius + i * 14 + staerke * i * 10}
            fill="none"
            stroke={farbe}
            strokeWidth={1}
            opacity={aktiv ? 0.35 - i * 0.1 : 0.12}
          />
        ))}
        {/* Sphäre */}
        <circle cx="120" cy="120" r={radius} fill={farbe} opacity={aktiv ? 0.16 : 0.06} />
        <circle cx="120" cy="120" r={radius} fill="none" stroke={farbe} strokeWidth={1.5} opacity={aktiv ? 0.9 : 0.3} />
        {/* Längengrade: rotieren langsam, das macht die Kugel lesbar */}
        {[0.35, 0.7].map((f, i) => (
          <ellipse
            key={i}
            cx="120" cy="120"
            rx={radius * f * (0.6 + 0.4 * Math.abs(Math.cos((phase * Math.PI) / 180)))}
            ry={radius}
            fill="none" stroke={farbe} strokeWidth={1} opacity={aktiv ? 0.45 : 0.15}
          />
        ))}
        {/* Breitengrade */}
        {[-0.5, 0, 0.5].map((f, i) => (
          <ellipse
            key={i}
            cx="120" cy={120 + radius * f}
            rx={radius * Math.sqrt(Math.max(0.05, 1 - f * f))} ry={radius * 0.14}
            fill="none" stroke={farbe} strokeWidth={1} opacity={aktiv ? 0.35 : 0.12}
          />
        ))}
      </svg>
      <span className="font-mono text-[0.62rem] uppercase tracking-widest" style={{ color: farbe }}>
        {BESCHRIFTUNG[zustand]}
      </span>
    </div>
  )
}
