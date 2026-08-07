// Tests für die energie-basierte Sprecherkennung — reine Logik, kein Audio-Stack.
import { describe, it, expect } from 'vitest'
import { createEnergyVad } from './energyVad'

/** Blockweise Samples: `laut` erzeugt Ausschlag, sonst Stille. */
const block = (laut: boolean, laenge = 1600) =>
  Float32Array.from({ length: laenge }, () => (laut ? 0.5 : 0.0001))

describe('createEnergyVad', () => {
  it('meldet Stille, solange nichts gesprochen wird', () => {
    const vad = createEnergyVad()
    expect(vad.push(block(false), 16000)).toBe('still')
  })

  it('erkennt den Sprechbeginn ab Schwellwert', () => {
    const vad = createEnergyVad()
    expect(vad.push(block(true), 16000)).toBe('spricht')
  })

  it('meldet das Ende erst nach der Nachlaufzeit, nicht bei kurzer Pause', () => {
    const vad = createEnergyVad({ hangoverMs: 500 })
    vad.push(block(true), 16000)
    // 100 ms Stille — zu kurz für ein Satzende
    expect(vad.push(block(false, 1600), 16000)).toBe('spricht')
    // weitere 500 ms Stille → Ende
    expect(vad.push(block(false, 8000), 16000)).toBe('ende')
  })

  it('nach dem Ende beginnt ein neuer Zyklus', () => {
    const vad = createEnergyVad({ hangoverMs: 100 })
    vad.push(block(true), 16000)
    vad.push(block(false, 8000), 16000)
    expect(vad.push(block(true), 16000)).toBe('spricht')
  })

  it('reset setzt den Zustand zurück', () => {
    const vad = createEnergyVad()
    vad.push(block(true), 16000)
    vad.reset()
    expect(vad.push(block(false), 16000)).toBe('still')
  })
})
