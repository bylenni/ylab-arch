// Tests für den SSE-Parser der streamenden Modell-Aufrufe — kein echter Netzaufruf.
import { describe, it, expect, vi } from 'vitest'
import { callModelStream, parseJson } from './llm.mjs'
import * as providers from './providers.mjs'

/** Baut eine Fake-Response, deren body die übergebenen SSE-Zeilen streamt. */
function fakeSseResponse(zeilen) {
  const encoder = new TextEncoder()
  return {
    ok: true,
    body: (async function* () {
      for (const zeile of zeilen) yield encoder.encode(zeile)
    })(),
  }
}

describe('callModelStream — SSE-Verarbeitung', () => {
  it('setzt Deltas zusammen und meldet jedes Stück über onDelta', async () => {
    vi.spyOn(providers, 'providerConfig').mockReturnValue({
      url: 'https://example.test/v1/chat/completions', key: 'sk-test', isOpenRouter: true,
    })
    const globalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeSseResponse([
        'data: {"choices":[{"delta":{"content":"Der Himmel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" ist blau."}}]}\n\n',
        'data: {"usage":{"prompt_tokens":12,"completion_tokens":5},"choices":[{"delta":{}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    const stuecke = []
    const ergebnis = await callModelStream({
      model: 'test/modell', system: 's', user: 'u', onDelta: (d) => stuecke.push(d),
    })
    expect(stuecke).toEqual(['Der Himmel', ' ist blau.'])
    expect(ergebnis.text).toBe('Der Himmel ist blau.')
    expect(ergebnis.tokens).toEqual({ in: 12, out: 5 })
    globalFetch.mockRestore()
    vi.restoreAllMocks()
  })

  it('überspringt kaputte Fragmente, statt den Stream abzubrechen', async () => {
    vi.spyOn(providers, 'providerConfig').mockReturnValue({
      url: 'https://example.test/v1/chat/completions', key: 'sk-test', isOpenRouter: false,
    })
    const globalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeSseResponse([
        'data: {kaputt\n\n',
        'data: {"choices":[{"delta":{"content":"trotzdem da"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    const ergebnis = await callModelStream({ model: 'test/modell', system: 's', user: 'u' })
    expect(ergebnis.text).toBe('trotzdem da')
    globalFetch.mockRestore()
    vi.restoreAllMocks()
  })
})

describe('parseJson', () => {
  it('liest sauberes und umrahmtes JSON, sonst null', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 })
    expect(parseJson('Klar! {"a":1} — bitte sehr')).toEqual({ a: 1 })
    expect(parseJson('gar kein JSON')).toBe(null)
  })
})
