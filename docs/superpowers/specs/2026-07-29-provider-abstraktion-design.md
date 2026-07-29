# Design: Provider-Abstraktion — Melious (EU) neben OpenRouter

Datum: 2026-07-29 · Status: freigegeben

Ziel: Inferenz wahlweise über OpenRouter (Prototyp, Weltkatalog) oder Melious
(EU-Datenresidenz, Open-Weight-Modelle — https://melious.ai) — pro Modell wählbar,
damit die Arena gleiche Modelle über beide Provider blind vergleichen kann.

## Provider-Schema: Prefix im Modell-String

- Ohne Prefix = OpenRouter (unverändert): `mistralai/mistral-small-3.2-24b-instruct`
- Mit Prefix = Melious: `melious:<modell-id>` (Melious-eigene Modell-IDs; Routing-Suffixe
  wie `:eco` sind Teil der Melious-ID und werden durchgereicht)
- Begründung: Modelle sind überall im System schlicht Strings (Szenarien, Arena,
  Prüfstand, Export/Import, Kosten-Overlay) — das Prefix-Schema erfordert dort NULL
  Änderungen. Arena-A/B = zwei Szenarien, einmal mit, einmal ohne Prefix.

## Server (server/index.mjs)

- `PROVIDERS`-Tabelle:
  - `openrouter`: bestehende URL `https://openrouter.ai/api/v1/chat/completions`,
    Key `OPENROUTER_API_KEY`, Extras wie bisher (`provider: { data_collection: 'deny' }`).
  - `melious`: `https://api.melious.ai/v1/chat/completions`, Key `MELIOUS_API_KEY`
    (Bearer, `sk-mel-…`), keine OpenRouter-spezifischen Extras im Body.
- `resolveProvider(model)`: trennt ein `melious:`-Prefix ab → `{ provider, modelId }`.
- `callModel` nutzt die aufgelöste URL/Key; Request/Response bleiben OpenAI-Format
  (Messages, `usage.prompt_tokens`/`completion_tokens` wie gehabt).
- Fehlender Key des angeforderten Providers → Fehler mit klarer deutscher Meldung;
  landet wie jeder Modellfehler fail-closed in der Pipeline (Triage unlesbar → sensibel,
  Safety unlesbar → blockiert). Keine Sonderpfade.

## Katalog (/api/models)

- Wie bisher OpenRouter-Katalog; zusätzlich Melious:
  - Probe `GET https://api.melious.ai/v1/models` (OpenAI-Konvention, nicht dokumentiert).
    Wenn erreichbar: Modelle übernehmen. Wenn nicht: kuratierte statische Liste der für
    uns relevanten Melious-Modelle (Mistral Small, Qwen3, DeepSeek — IDs beim Bau per
    Live-Probe verifizieren).
  - Melious-Einträge bekommen `id: 'melious:<id>'` und, falls der Katalog keine Preise
    liefert, `in/out = -1` als „Preis unbekannt"-Marker.
- Kein Melious-Key/nicht erreichbar → Katalog ohne Melious-Einträge; App voll
  funktionsfähig (Verhalten wie heute).
- Frontend `useOpenRouterModels`/`formatPrice`: Preis `-1` wird als „?" angezeigt;
  `costOfRun`/CostOverlay behandeln unbekannte Preise wie heute fehlende (Stage fällt
  aus der Summe, kein Raten).

## UI (Inspector ModelSelect)

- Dropdown-Gruppierung lernt das Prefix: `melious:`-IDs erscheinen als eigene Gruppe
  „melious · EU" (oben einsortiert), Anzeige ohne Prefix-Doppelung.
- Sonst keine UI-Änderungen (Arena/Prüfstand funktionieren über das String-Schema).

## Bewusst NICHT in dieser Stufe

- Kein automatischer Provider-Fallback bei Ausfall (eigener Backlog-Punkt, zusammen
  mit 429-Retry).
- Kein Anthropic-Format-Support (`/v1/messages`) — OpenAI-Format genügt.
- Kein Melious-Whisper (STT bleibt lokal).

## Verifikation

1. Katalog: Melious-Gruppe erscheint im Modell-Dropdown.
2. Ein Live-Turn über ein `melious:`-Modell (Latenz im Verlauf sichtbar).
3. Arena: Mistral Small via OpenRouter vs. via Melious — Latenz/Kosten/Judge, blind.
4. `npm run eval:safety` gegen unveränderte Defaults — Ergebnis muss der Baseline
   entsprechen (Inferenz-Plumbing wurde angefasst; Regression ausschließen).

## Fehlerfälle

- `melious:`-Modell ohne MELIOUS_API_KEY → deutsche Fehlermeldung, fail-closed.
- Melious-Katalog-Probe scheitert → statische Liste bzw. leere Gruppe, kein Crash.
- Unbekannte Preise → „?" im Dropdown, keine erfundenen Kosten im Overlay.
