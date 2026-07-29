// Tests für die Provider-Auflösung — reine Funktionen, kein Netz.
import { describe, it, expect } from 'vitest'
import { resolveProvider, providerConfig } from './providers.mjs'

describe('resolveProvider', () => {
  it('ohne Prefix → openrouter, ID unverändert', () => {
    expect(resolveProvider('mistralai/mistral-small-3.2-24b-instruct')).toEqual({
      providerId: 'openrouter',
      modelId: 'mistralai/mistral-small-3.2-24b-instruct',
    })
  })
  it('melious:-Prefix → melious, Prefix abgetrennt (Routing-Suffixe bleiben Teil der ID)', () => {
    expect(resolveProvider('melious:qwen3-30b-a3b:eco')).toEqual({
      providerId: 'melious',
      modelId: 'qwen3-30b-a3b:eco',
    })
  })
  it('nur ein führendes melious:-Prefix wird abgetrennt', () => {
    expect(resolveProvider('melious:melious:x').modelId).toBe('melious:x')
  })
})

describe('providerConfig', () => {
  it('openrouter: bestehende URL, OpenRouter-Extras aktiv', () => {
    const cfg = providerConfig('openrouter')
    expect(cfg.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(cfg.isOpenRouter).toBe(true)
  })
  it('melious: EU-Endpoint, keine OpenRouter-Extras', () => {
    const cfg = providerConfig('melious')
    expect(cfg.url).toBe('https://api.melious.ai/v1/chat/completions')
    expect(cfg.isOpenRouter).toBe(false)
  })
  it('liest Keys zur Aufrufzeit aus process.env', () => {
    const alt = process.env.MELIOUS_API_KEY
    process.env.MELIOUS_API_KEY = 'sk-mel-test'
    expect(providerConfig('melious').key).toBe('sk-mel-test')
    if (alt === undefined) delete process.env.MELIOUS_API_KEY
    else process.env.MELIOUS_API_KEY = alt
  })
})
