/**
 * Energie-basierte Sprecherkennung (VAD): gleitender RMS über die Mikrofon-Samples,
 * Schwelle plus Nachlaufzeit. Bewusst simpel und abhängigkeitsfrei — die Stufe ist
 * isoliert, damit Silero-VAD (wie im HF-Vorbild) später ein Austausch ist.
 */

export type VadZustand = 'still' | 'spricht' | 'ende'

interface VadOptionen {
  /** RMS-Schwelle, ab der Sprache angenommen wird. */
  schwelle?: number
  /** Stille-Dauer in ms, nach der das Sprachende gemeldet wird. */
  hangoverMs?: number
}

export function createEnergyVad({ schwelle = 0.02, hangoverMs = 700 }: VadOptionen = {}) {
  let spricht = false
  let stilleMs = 0

  return {
    /** Verarbeitet einen Sample-Block und liefert den Zustandswechsel. */
    push(samples: Float32Array, rate: number): VadZustand {
      let summe = 0
      for (let i = 0; i < samples.length; i += 1) summe += samples[i] * samples[i]
      const rms = Math.sqrt(summe / Math.max(1, samples.length))
      const blockMs = (samples.length / rate) * 1000

      if (rms >= schwelle) {
        spricht = true
        stilleMs = 0
        return 'spricht'
      }
      if (!spricht) return 'still'

      stilleMs += blockMs
      if (stilleMs >= hangoverMs) {
        spricht = false
        stilleMs = 0
        return 'ende'
      }
      return 'spricht'
    },
    reset() {
      spricht = false
      stilleMs = 0
    },
  }
}
