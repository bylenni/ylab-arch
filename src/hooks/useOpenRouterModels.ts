import { useEffect, useState } from 'react'

export interface OpenRouterModel {
  id: string
  name: string
  ctx: number
  /** Preis in $ pro 1M Input-Tokens */
  in: number
  /** Preis in $ pro 1M Output-Tokens */
  out: number
}

// Modulweiter Cache — der Katalog wird pro Seitenladen genau einmal geholt.
let cache: OpenRouterModel[] | null = null
let inflight: Promise<OpenRouterModel[]> | null = null

/** null = lädt noch · [] = nicht verfügbar (Backend aus o. Ä.) */
export function useOpenRouterModels(): OpenRouterModel[] | null {
  const [models, setModels] = useState<OpenRouterModel[] | null>(cache)

  useEffect(() => {
    if (cache) return
    inflight ??= fetch('/api/models')
      .then((res) => res.json())
      .then((data: { models?: OpenRouterModel[] }) => {
        cache = data.models ?? []
        return cache
      })
      .catch(() => {
        cache = []
        return cache
      })
    let cancelled = false
    void inflight.then((result) => {
      if (!cancelled) setModels(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return models
}

export const formatPrice = (value: number): string => {
  if (value === 0) return '0'
  if (value < 0.1) return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
