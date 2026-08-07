/**
 * Modell-Aufrufe (blockierend und streamend) über die Provider-Abstraktion.
 * Aus index.mjs extrahiert, damit die Live-Pipeline und die Speech-to-Speech-Kette
 * denselben Code nutzen statt zweier Kopien.
 */
import { resolveProvider, providerConfig } from './providers.mjs'

/** Gemeinsamer Request-Body für beide Aufrufarten. */
function buildBody({ modelId, system, user, history, maxTokens, isOpenRouter, stream }) {
  return {
    model: modelId,
    max_tokens: maxTokens,
    stream,
    messages: [
      { role: 'system', content: system },
      ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text ?? '') })),
      { role: 'user', content: user },
    ],
    // Nur OpenRouter kennt das Anbieter-Feld; Melious ist EU-only
    ...(isOpenRouter ? { provider: { data_collection: 'deny' } } : {}),
  }
}

function headersFor({ key, isOpenRouter }) {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(isOpenRouter ? { 'HTTP-Referer': 'http://localhost:5173', 'X-Title': 'Architektur-Studio' } : {}),
  }
}

function requireKey(providerId, key) {
  if (!key) {
    throw new Error(
      `Kein API-Key für Provider "${providerId}" gesetzt (${providerId === 'melious' ? 'MELIOUS_API_KEY' : 'OPENROUTER_API_KEY'} in .env).`,
    )
  }
}

export async function callModel({ model, system, user, history = [], maxTokens = 400 }) {
  const started = performance.now()
  const { providerId, modelId } = resolveProvider(model)
  const { url, key, isOpenRouter } = providerConfig(providerId)
  requireKey(providerId, key)
  const res = await fetch(url, {
    method: 'POST',
    headers: headersFor({ key, isOpenRouter }),
    body: JSON.stringify(buildBody({ modelId, system, user, history, maxTokens, isOpenRouter, stream: false })),
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300)
    throw new Error(`Modell "${model}": HTTP ${res.status} — ${body}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  const usage = data.usage ?? {}
  return {
    text: text.trim(),
    ms: Math.round(performance.now() - started),
    tokens: { in: usage.prompt_tokens ?? 0, out: usage.completion_tokens ?? 0 },
  }
}

/**
 * Streamende Variante: ruft `onDelta(teilText)` für jedes eintreffende Textstück
 * und liefert am Ende den Gesamttext. Token-Zählung kommt aus dem letzten
 * usage-Feld, falls der Anbieter eines schickt (OpenAI-Konvention), sonst 0.
 */
export async function callModelStream({ model, system, user, history = [], maxTokens = 400, onDelta }) {
  const started = performance.now()
  const { providerId, modelId } = resolveProvider(model)
  const { url, key, isOpenRouter } = providerConfig(providerId)
  requireKey(providerId, key)
  const res = await fetch(url, {
    method: 'POST',
    headers: headersFor({ key, isOpenRouter }),
    body: JSON.stringify(buildBody({ modelId, system, user, history, maxTokens, isOpenRouter, stream: true })),
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300)
    throw new Error(`Modell "${model}" (Stream): HTTP ${res.status} — ${body}`)
  }

  const decoder = new TextDecoder()
  let puffer = ''
  let text = ''
  let usage = {}
  for await (const stueck of res.body) {
    puffer += decoder.decode(stueck, { stream: true })
    // SSE: durch Leerzeilen getrennte Blöcke, jede Nutzzeile beginnt mit "data: "
    let grenze
    while ((grenze = puffer.indexOf('\n')) !== -1) {
      const zeile = puffer.slice(0, grenze).trim()
      puffer = puffer.slice(grenze + 1)
      if (!zeile.startsWith('data:')) continue
      const rohdaten = zeile.slice(5).trim()
      if (rohdaten === '[DONE]') continue
      try {
        const teil = JSON.parse(rohdaten)
        const delta = teil.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          text += delta
          onDelta?.(delta)
        }
        if (teil.usage) usage = teil.usage
      } catch {
        // unvollständiges oder fremdes Fragment — überspringen, der Stream läuft weiter
      }
    }
  }
  return {
    text: text.trim(),
    ms: Math.round(performance.now() - started),
    tokens: { in: usage.prompt_tokens ?? 0, out: usage.completion_tokens ?? 0 },
  }
}

/** Tolerantes JSON-Parsing — Modelle ohne Structured-Output-Support liefern gern Text drumherum. */
export function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}
