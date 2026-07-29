// Tests für costOfRun — Preise mit unbekanntem Marker (-1) dürfen nie verrechnet werden.
import { describe, it, expect } from 'vitest'
import { costOfRun, shortModelName } from './scenarios'
import type { RunStage } from './scenarios'

const PRICES: Record<string, { in: number; out: number }> = {
  'openai/gpt-4o-mini': { in: 0.15, out: 0.6 },
  'melious:qwen3-30b-a3b-instruct': { in: -1, out: -1 },
}
const priceOf = (modelId: string) => PRICES[modelId]

describe('costOfRun', () => {
  it('ignoriert Stages mit unbekanntem Preis (-1) komplett', () => {
    const stages: RunStage[] = [{ model: 'melious:qwen3-30b-a3b-instruct', tokens: { in: 1000, out: 500 } }]
    const cost = costOfRun(stages, priceOf, 100)
    expect(cost.perTurn).toBe(0)
    expect(cost.perMonth).toBe(0)
  })

  it('rechnet bekannte Preise korrekt, unbekannte Stages fallen einfach weg', () => {
    const stages: RunStage[] = [
      { model: 'openai/gpt-4o-mini', tokens: { in: 1_000_000, out: 1_000_000 } },
      { model: 'melious:qwen3-30b-a3b-instruct', tokens: { in: 1_000_000, out: 1_000_000 } },
    ]
    const turns = 10
    const cost = costOfRun(stages, priceOf, turns)
    // nur die gpt-4o-mini-Stage zählt: 1 × 0.15 + 1 × 0.6 = 0.75 $/Turn
    expect(cost.perTurn).toBeCloseTo(0.75, 10)
    expect(cost.perMonth).toBeCloseTo(0.75 * turns, 10)
  })

  it('Stage ohne Katalogeintrag (priceOf liefert undefined) wird ebenfalls übersprungen', () => {
    const stages: RunStage[] = [{ model: 'unbekannt/modell', tokens: { in: 1000, out: 1000 } }]
    const cost = costOfRun(stages, priceOf, 100)
    expect(cost.perTurn).toBe(0)
    expect(cost.perMonth).toBe(0)
  })
})

describe('shortModelName', () => {
  it('kürzt eine melious:-ID auf den letzten Pfadteil, Prefix bleibt erhalten', () => {
    expect(shortModelName('melious:mistralai/mistral-small')).toBe('melious:mistral-small')
  })

  it('kürzt eine OpenRouter-ID wie bisher auf den letzten Pfadteil', () => {
    expect(shortModelName('mistralai/mistral-small')).toBe('mistral-small')
  })

  it('liefert undefined für fehlende IDs, damit Aufrufer ihren eigenen Fallback zeigen können', () => {
    expect(shortModelName(undefined)).toBeUndefined()
    expect(shortModelName(null)).toBeUndefined()
  })
})
