/**
 * Deckt nur die reine Zuordnungsfunktion ab (kein Rendering nötig): welche Modell-Stufe
 * des s2s-Ereignisstroms patcht welche Canvas-Knotenart, wenn eine Auswahl im Speech-
 * Dropdown getroffen wird.
 */
import { describe, it, expect } from 'vitest'
import { nodeKindForStage } from './S2SView'

describe('nodeKindForStage', () => {
  it('triage → triage', () => {
    expect(nodeKindForStage('triage')).toBe('triage')
  })

  it('main → llm', () => {
    expect(nodeKindForStage('main')).toBe('llm')
  })

  it('safety → safety', () => {
    expect(nodeKindForStage('safety')).toBe('safety')
  })

  it('unbekannte Stufe → null', () => {
    expect(nodeKindForStage('guard')).toBeNull()
    expect(nodeKindForStage('vad')).toBeNull()
    expect(nodeKindForStage('irgendwas')).toBeNull()
  })
})
