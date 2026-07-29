# Provider-Abstraktion (Melious neben OpenRouter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inferenz pro Modell wahlweise über OpenRouter (Default, ohne Prefix) oder Melious (`melious:`-Prefix, EU) — inkl. Katalog-Merge und Arena-Vergleichslauf.

**Architecture:** Neues reines Modul `server/providers.mjs` (Prefix-Parsing + Provider-Konfiguration, unit-getestet); `callModel` löst den Provider vor dem Fetch auf; `loadModels` merged den Melious-Katalog (Probe `/v1/models`, statischer Fallback) mit `-1` als Preis-unbekannt-Marker; Frontend zeigt „?" für unbekannte Preise und gruppiert Melious als „melious · EU".

**Tech Stack:** Node ≥ 20 (natives fetch), Vitest 4 (`npm test`, aktuell 37 grün), React 19.

**Spec:** `docs/superpowers/specs/2026-07-29-provider-abstraktion-design.md`

## Global Constraints

- Sprache in UI, Kommentaren und Commits: Deutsch; Commit-Messages enden mit `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Trunk-based: nach jedem Task `git add` → `commit` → `git push origin main`.
- Gates vor jedem Commit: `npx tsc -b && npm run build && npm test` grün.
- Ohne Prefix ändert sich NICHTS am heutigen Verhalten (OpenRouter, `data_collection: deny`).
- Keys: `OPENROUTER_API_KEY`, `MELIOUS_API_KEY` (beide liegen in `.env`).
- Melious: `https://api.melious.ai/v1/chat/completions`, Bearer-Auth (`sk-mel-…`), OpenAI-Format.

---

### Task 1: Provider-Modul + callModel-Umstellung

**Files:**
- Create: `server/providers.mjs`
- Modify: `server/index.mjs` (Zeilen 102–103 und `callModel` Zeilen 168–202)
- Test: `server/providers.test.mjs`

**Interfaces:**
- Produces: `resolveProvider(model: string) → { providerId: 'openrouter'|'melious', modelId: string }`; `providerConfig(providerId) → { url: string, key: string|undefined, isOpenRouter: boolean }`. Task 2 nutzt `process.env.MELIOUS_API_KEY` direkt; Task 3 verlässt sich auf das `melious:`-Prefix-Verhalten in `callModel`.

- [ ] **Step 1: Failing Tests schreiben** — `server/providers.test.mjs`:

```js
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
```

- [ ] **Step 2: Tests laufen lassen — müssen FEHLSCHLAGEN**

Run: `npm test`
Expected: FAIL — `Cannot find module './providers.mjs'`

- [ ] **Step 3: Modul schreiben** — `server/providers.mjs`:

```js
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
```

- [ ] **Step 4: `callModel` in `server/index.mjs` umstellen**

1. Import ergänzen (neben den anderen lokalen Imports):
```js
import { resolveProvider, providerConfig } from './providers.mjs'
```
2. Zeilen 102–103 (`const API_KEY = …` und `const OPENROUTER_URL = …`) **löschen**. Danach per grep prüfen: `grep -n "API_KEY\b\|OPENROUTER_URL" server/index.mjs` — die verbleibenden Nutzer (Health-Endpoint `hasKey`, Fehlermeldungen „Kein OPENROUTER_API_KEY gesetzt") auf `providerConfig('openrouter').key` umstellen.
3. `callModel` (Zeilen 168–202) ersetzen durch:

```js
async function callModel({ model, system, user, history = [], maxTokens = 400 }) {
  const started = performance.now()
  const { providerId, modelId } = resolveProvider(model)
  const { url, key, isOpenRouter } = providerConfig(providerId)
  if (!key) {
    throw new Error(`Kein API-Key für Provider "${providerId}" gesetzt (${providerId === 'melious' ? 'MELIOUS_API_KEY' : 'OPENROUTER_API_KEY'} in .env).`)
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(isOpenRouter ? { 'HTTP-Referer': 'http://localhost:5173', 'X-Title': 'Architektur-Studio' } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text ?? '') })),
        { role: 'user', content: user },
      ],
      // Nur OpenRouter kennt das Anbieter-Feld; Melious ist ohnehin EU-only ohne Training
      ...(isOpenRouter ? { provider: { data_collection: 'deny' } } : {}),
    }),
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
```

- [ ] **Step 5: Tests + Rauchtest**

Run: `npm test` — Expected: PASS (37 + 6 neue).
Rauchtest ohne Prefix (Server läuft via `npm run dev` oder kurz `npm run server` starten):
```bash
curl -s http://localhost:8787/api/run -X POST -H 'content-type: application/json' \
  -d '{"utterance":"Warum ist Gras grün?","ageBand":"6-7","noCache":true}' | head -c 200
```
Expected: `"ok":true` und normale Antwort — OpenRouter-Pfad unverändert.

- [ ] **Step 6: Gates + Commit + Push**

```bash
npx tsc -b && npm run build && npm test
git add server/providers.mjs server/providers.test.mjs server/index.mjs
git commit -m "Provider-Abstraktion: melious:-Prefix wählt EU-Inferenz (Melious)

resolveProvider/providerConfig als reines, getestetes Modul; callModel
löst den Provider vor dem Fetch auf. Ohne Prefix bleibt alles wie
bisher (OpenRouter inkl. data_collection deny).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: Katalog-Merge + Frontend (Preis „?", Gruppe „melious · EU")

**Files:**
- Modify: `server/index.mjs` (`loadModels` Zeilen ~498–519, Health-Endpoint ~537–555)
- Modify: `src/hooks/useOpenRouterModels.ts` (`formatPrice`)
- Modify: `src/scenarios.ts` (`costOfRun`-Guard)
- Modify: `src/components/Inspector.tsx` (`ModelSelect`-Gruppierung)

**Interfaces:**
- Consumes: `process.env.MELIOUS_API_KEY` (Task 1 Konvention).
- Produces: Katalog-Einträge `{ id: 'melious:<id>', name, ctx, in, out }` mit `in/out = -1` wenn Preis unbekannt; Health-Feld `hasMeliousKey: boolean`. Task 3 sieht die Gruppe im Dropdown.

- [ ] **Step 1: `loadModels` erweitern** — in `server/index.mjs` nach dem bestehenden OpenRouter-Teil (vor `modelsCache = …`):

```js
  // Melious-Katalog (EU) dazu mergen — Probe auf OpenAI-konventionelles /v1/models;
  // scheitert die Probe (Endpoint nicht dokumentiert), fällt eine kuratierte Liste ein.
  const meliousKey = process.env.MELIOUS_API_KEY
  if (meliousKey) {
    let meliousModels = []
    try {
      const mres = await fetch('https://api.melious.ai/v1/models', {
        headers: { Authorization: `Bearer ${meliousKey}` },
        signal: AbortSignal.timeout(4000),
      })
      if (mres.ok) {
        const mjson = await mres.json()
        meliousModels = (mjson.data ?? []).map((m) => ({
          id: `melious:${m.id}`,
          name: `${m.name ?? m.id}`,
          ctx: m.context_length ?? 0,
          // Preis nur übernehmen, wenn der Katalog ihn liefert — sonst -1 = „unbekannt"
          in: m.pricing?.prompt != null ? Number(m.pricing.prompt) * 1e6 : -1,
          out: m.pricing?.completion != null ? Number(m.pricing.completion) * 1e6 : -1,
        }))
      }
    } catch {
      // Probe gescheitert → kuratierter Fallback (IDs beim ersten Live-Lauf verifizieren)
    }
    if (meliousModels.length === 0) {
      meliousModels = ['mistral-small-3.2', 'qwen3-30b-a3b', 'deepseek-v3'].map((id) => ({
        id: `melious:${id}`, name: id, ctx: 0, in: -1, out: -1,
      }))
    }
    data.push(...meliousModels.sort((a, b) => a.id.localeCompare(b.id)))
  }
```
WICHTIG: Der bestehende `-1`-Filter (Zeile 508) betrifft nur den OpenRouter-Teil und bleibt unverändert — Melious-Einträge werden NACH dem Filter angehängt, `-1` ist dort bewusst der „Preis unbekannt"-Marker.

- [ ] **Step 2: Health-Endpoint ergänzen** — im `/api/health`-JSON nach `hasKey`:

```js
        hasMeliousKey: Boolean(process.env.MELIOUS_API_KEY),
```

- [ ] **Step 3: Frontend-Preis-Handling**

`src/hooks/useOpenRouterModels.ts` — `formatPrice` ersetzen:
```ts
export const formatPrice = (value: number): string => {
  if (value < 0) return '?' // Preis unbekannt (z. B. Melious ohne Katalog-Preise)
  if (value === 0) return '0'
  if (value < 0.1) return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
```

`src/scenarios.ts` — in `costOfRun` den Guard erweitern (unbekannte Preise nie verrechnen):
```ts
    const price = priceOf(stage.model)
    if (!price || price.in < 0 || price.out < 0) continue
```

- [ ] **Step 4: `ModelSelect`-Gruppierung** — in `src/components/Inspector.tsx`, im `groups`-useMemo die Provider-Ermittlung ersetzen:

```ts
    for (const model of models) {
      const provider = model.id.startsWith('melious:')
        ? 'melious · EU'
        : model.id.includes('/')
          ? model.id.split('/')[0]
          : 'sonstige'
      const list = byProvider.get(provider) ?? []
      list.push(model)
      byProvider.set(provider, list)
    }
    return [...byProvider.entries()].sort(([a], [b]) => {
      // EU-Gruppe zuoberst, Rest alphabetisch
      if (a === 'melious · EU') return -1
      if (b === 'melious · EU') return 1
      return a.localeCompare(b)
    })
```
Und im `<option>`-Label die Prefix-Doppelung vermeiden — die bestehende Anzeige-Logik ersetzen durch:
```ts
{model.id.startsWith('melious:')
  ? model.id.slice('melious:'.length)
  : model.id.includes('/')
    ? model.id.split('/').slice(1).join('/')
    : model.id} · ${formatPrice(model.in)}/${formatPrice(model.out)}
```

- [ ] **Step 5: Verifikation**

Server neu starten (damit `loadModels` frisch läuft; Katalog-Cache ist 1 h):
```bash
curl -s http://localhost:8787/api/models | python3 -c "import json,sys; d=json.load(sys.stdin); mel=[m for m in d['models'] if m['id'].startswith('melious:')]; print(len(mel), [m['id'] for m in mel[:5]])"
curl -s http://localhost:8787/api/health | python3 -c "import json,sys; print(json.load(sys.stdin).get('hasMeliousKey'))"
```
Expected: Melious-Modelle > 0 (Probe ODER Fallback-Liste), `True`.
Im Bericht festhalten: Kam der Katalog von der Live-Probe oder aus dem Fallback? Falls Fallback: die drei IDs per Test-Call verifizieren (Task 3 deckt das ab).

- [ ] **Step 6: Gates + Commit + Push**

```bash
npx tsc -b && npm run build && npm test
git add server/index.mjs src/hooks/useOpenRouterModels.ts src/scenarios.ts src/components/Inspector.tsx
git commit -m "Melious-Katalog im Modell-Dropdown: Gruppe „melious · EU", Preis-?-Marker

Katalog-Probe auf /v1/models mit kuratiertem Fallback; unbekannte
Preise (-1) erscheinen als ? und fallen aus der Kostenrechnung,
statt geraten zu werden. Health meldet hasMeliousKey.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: Live-Verifikation — Chat-Turn, Arena-A/B, Safety-Regression

**Files:** keine Code-Änderungen (reine Verifikation; Befunde → Bericht)

**Interfaces:**
- Consumes: `melious:`-Modelle aus Katalog (Task 2), `callModel`-Prefix-Verhalten (Task 1), Arena + `npm run eval:safety` (bestehend).

- [ ] **Step 1: Melious-Modell-ID live verifizieren**

```bash
curl -s http://localhost:8787/api/run -X POST -H 'content-type: application/json' \
  -d '{"utterance":"Warum ist der Himmel blau?","ageBand":"6-7","noCache":true,"models":{"main":"melious:<ID aus Task-2-Katalog>"}}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['ok'], [(s['key'],s['model'],s['ms']) for s in d['stages'] if s['key']=='main'])"
```
Expected: `True` und Main-Stage mit dem `melious:`-Modell und plausibler Latenz. Bei HTTP-Fehler „model not found": Katalog-IDs stimmen nicht → korrekte ID über die Melious-Doku/Pricing-Seite ermitteln, Fallback-Liste in `loadModels` korrigieren, als Fix committen.

- [ ] **Step 2: Arena-A/B — gleiches Modell, zwei Provider**

Im Browser (http://localhost:5173, Arena): Zwei Szenarien anlegen — „Mistral · OpenRouter" (`mistralai/mistral-small-3.2-24b-instruct` als Haupt-LLM) und „Mistral · Melious EU" (`melious:<mistral-id>`), gleicher Prompt/Config. 3 Testfragen (Wissensfrage, Lernfrage, Geschichte) mit Judge laufen lassen. Festhalten: Latenz beider Spalten, Judge-Urteile, Kosten (OpenRouter beziffert, Melious „?").

- [ ] **Step 3: Safety-Regression**

```bash
npm run eval:safety
```
Expected: Ergebnis entspricht der bekannten Baseline (Gate ROT mit 2 FN / 12 FP / 14 Abweichungen, ±LLM-Rauschen) — die Defaults sind unverändert, nur das Inferenz-Plumbing wurde angefasst. Deutliche Abweichung nach unten (mehr FN) → STOPP und Befund melden.

- [ ] **Step 4: Ergebnisse dokumentieren**

Messwerte (Latenzen, Judge, Katalog-Quelle Probe/Fallback) in den Task-Bericht — sie sind die Entscheidungsgrundlage „Melious als Pilot-Provider ja/nein" für Lenni.
