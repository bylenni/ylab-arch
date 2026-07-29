/**
 * Provider-Abstraktion: OpenRouter (Default) und Melious (EU, `melious:`-Prefix).
 * Reine Funktionen — Keys werden zur Aufrufzeit aus process.env gelesen,
 * damit Tests und späte .env-Änderungen funktionieren.
 */

const PROVIDERS = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'OPENROUTER_API_KEY',
    isOpenRouter: true,
  },
  melious: {
    // EU-Inferenz (https://melious.ai) — OpenAI-kompatibel, Requests bleiben in der EU.
    url: 'https://api.melious.ai/v1/chat/completions',
    keyEnv: 'MELIOUS_API_KEY',
    isOpenRouter: false,
  },
}

/** Trennt genau ein führendes `melious:`-Prefix ab; alles andere ist OpenRouter. */
export function resolveProvider(model) {
  if (typeof model === 'string' && model.startsWith('melious:')) {
    return { providerId: 'melious', modelId: model.slice('melious:'.length) }
  }
  return { providerId: 'openrouter', modelId: model }
}

export function providerConfig(providerId) {
  const p = PROVIDERS[providerId]
  return { url: p.url, key: process.env[p.keyEnv], isOpenRouter: p.isOpenRouter }
}
