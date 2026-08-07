// Tests für die beiden sicherheitskritischen reinen Funktionen der s2s-Kette.
import { describe, it, expect } from 'vitest'
import { createChunker, createGate } from './s2sCore.mjs'

describe('createChunker — Sätze aus dem Token-Strom', () => {
  it('gibt einen Satz erst aus, wenn er vollständig ist', () => {
    const c = createChunker()
    expect(c.feed('Der Himmel')).toEqual([])
    expect(c.feed(' ist blau.')).toEqual(['Der Himmel ist blau.'])
  })

  it('erkennt mehrere Sätze in einem Zuwachs', () => {
    const c = createChunker()
    expect(c.feed('Ja! Und warum? Das kommt vom Licht.')).toEqual([
      'Ja!', 'Und warum?', 'Das kommt vom Licht.',
    ])
  })

  it('trennt NICHT bei Abkürzungen', () => {
    const c = createChunker()
    expect(c.feed('Nimm z. B. drei Äpfel und zähl sie.')).toEqual(['Nimm z. B. drei Äpfel und zähl sie.'])
  })

  it('trennt NICHT innerhalb von Dezimalzahlen', () => {
    const c = createChunker()
    expect(c.feed('Das dauert 1.5 Sekunden ungefähr.')).toEqual(['Das dauert 1.5 Sekunden ungefähr.'])
  })

  it('flush liefert den unvollständigen Rest und leert den Puffer', () => {
    const c = createChunker()
    c.feed('Ein ganzer Satz. Und ein Rest ohne Ende')
    expect(c.flush()).toBe('Und ein Rest ohne Ende')
    expect(c.flush()).toBe(null)
  })

  it('flush ohne Rest liefert null', () => {
    const c = createChunker()
    c.feed('Alles fertig.')
    expect(c.flush()).toBe(null)
  })
})

describe('createGate — die Sicherheits-Invariante', () => {
  it('vor jeder Freigabe darf NICHTS raus', () => {
    const g = createGate()
    expect(g.mayEmit(0)).toBe(false)
    expect(g.mayEmit(1)).toBe(false)
    expect(g.status).toBe('offen')
  })

  it('nach Guard-Freigabe darf NUR der erste Chunk raus', () => {
    const g = createGate()
    g.approveFirst()
    expect(g.mayEmit(0)).toBe(true)
    expect(g.mayEmit(1)).toBe(false)
    expect(g.status).toBe('erste_frei')
  })

  it('nach der Vollprüfung dürfen alle Chunks raus', () => {
    const g = createGate()
    g.approveFirst()
    g.approveFull()
    expect(g.mayEmit(0)).toBe(true)
    expect(g.mayEmit(3)).toBe(true)
    expect(g.status).toBe('alle_frei')
  })

  it('Abbruch sperrt alles — auch bereits Freigegebenes', () => {
    const g = createGate()
    g.approveFirst()
    g.approveFull()
    g.reject('Safety-Modell hat blockiert')
    expect(g.mayEmit(0)).toBe(false)
    expect(g.mayEmit(1)).toBe(false)
    expect(g.status).toBe('abgebrochen')
    expect(g.grund).toBe('Safety-Modell hat blockiert')
  })

  it('nach einem Abbruch heben spätere Freigaben ihn NICHT auf', () => {
    const g = createGate()
    g.reject('Guard-Urteil unparsbar')
    g.approveFirst()
    g.approveFull()
    expect(g.mayEmit(0)).toBe(false)
    expect(g.status).toBe('abgebrochen')
  })
})
