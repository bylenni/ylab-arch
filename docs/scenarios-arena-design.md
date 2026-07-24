# Design: Szenarien + Vergleichs-Arena (A+B)

Stand: 2026-07-20 · Status: freigegeben

Baut das Architektur-Studio von einem Editor zu einer Experimentier-Plattform aus:
Konfigurationen als Szenarien speichern und Modelle/Prompts head-to-head vergleichen.

## Datenmodell — Szenario

Ein Szenario ist ein **Parametersatz** (kein Graph) — die Werte, die `/api/run` konsumiert:

```ts
Scenario {
  id: string
  name: string
  createdAt: number
  models: { triage?: string; main?: string; safety?: string }
  systemPrompt: string
  plannerEnabled: boolean
  config: { blockPatterns; riskWords; emotionWords; clarifyMinWords }
}
```

- **Altersband gehört NICHT ins Szenario** — pro Lauf gewählt (dasselbe Szenario über 4–5 vs. 6–7 testen).
- Speicher: `localStorage["arch-studio-scenarios"]`. Export/Import als JSON.
- Aus dem Canvas „abgegriffen" (`captureScenario(nodes)`) bzw. auf den Canvas zurückgeschrieben (`applyScenario`, nur die editierbaren Werte — die Graph-Struktur bleibt).

## Szenario-Verwaltung (Test-Panel)

„💾 Als Szenario speichern" + Liste: laden, duplizieren, umbenennen, löschen, exportieren.

## Arena (Vollbild)

Header-Umschalter **Canvas ⇄ ⚔ Arena**. Ablauf: 2–3 Szenarien als Spalten wählen →
Äußerung (Text oder 🎙) + Altersband → „▶ Vergleich starten". Jedes Szenario läuft
**live und parallel** über den bestehenden `/api/run` (Payload direkt aus dem Szenario).

Pro Spalte: Antwort · Routing-Entscheidung · Gesamt-Latenz · **Kosten** (Tokens × Preis
aus dem OpenRouter-Katalog → Hochrechnung €/Kind/Monat bei ~1.100 Turns) · Step-Aufschlüsselung.

## Blind-Modus + Auto-Judge

- **Blind-Modus** (Default an): Spalten „A / B / C", Modelle verborgen, „Auflösen"-Button.
- **Auto-Judge** (`/api/judge`): Frontier-Modell (konfigurierbar, Default Claude Sonnet)
  bekommt Äußerung + alle **anonymisierten** Antworten + eine **editierbare Rubrik**
  (altersgerecht? sokratisch/kein Lösungs-Dump? konsistent [Fuchskind-Check]? warm? sicher?),
  liefert strukturiert Scores + Kurzbegründung + Ranking. „🏆 Gewinner"-Banner; Auflösen
  zeigt das Szenario. Judge-Kosten separat ausgewiesen.

## Bewusst NICHT in A+B (YAGNI)

Kein Batch über Testsets (= C), keine Server-Persistenz/Teilen, kein Multi-Turn.
Die Konsistenz-Prüfung steckt aber schon in der Judge-Rubrik für Einzelantworten.

## Umsetzung in Phasen

1. **Szenarien-Fundament**: Typ + localStorage-Store + capture/apply + Verwaltungs-UI.
2. **Arena-Vergleich**: Vollbild-View, Header-Toggle, N-Spalten-Lauf, Kosten, Blind-Modus.
3. **Auto-Judge**: `/api/judge` + editierbare Rubrik + Urteil/Gewinner-Anzeige.

Kein Git-Repo initialisiert → Spec liegt als Datei, kein Commit.
