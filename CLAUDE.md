# ylab-arch · Architektur-Studio

Interaktives Studio für die Systemarchitektur unseres Sprach-KI-Begleiters für Kinder (4–7):
Canvas-Editor (React Flow) + Live-Pipeline (OpenRouter) + STT/TTS lokal + Szenarien-Arena mit Auto-Judge.

## Git-Workflow (verbindlich)

- **Trunk-based: Wir iterieren direkt auf `main`. `main` ist Production.**
- **Jede Änderung wird sofort committet und gepusht** — keine Feature-Branches, keine PRs,
  kein Ansammeln von uncommitteten Änderungen. Nach jedem abgeschlossenen, verifizierten
  Arbeitsschritt: `git add` → `git commit` → `git push origin main`.
- Vor dem Commit: Typecheck (`npx tsc -b`), Build (`npm run build`) und Unit-Tests
  (`npm test`) müssen grün sein.
- Vor jedem Commit, der Prompts, Modelle, Router-/Safety-Logik oder Patterns ändert,
  zusätzlich: `npm run eval:safety` muss grün sein (FN = 0 — ein einziger False
  Negative blockiert den Commit).
- Jeder echte Vorfall / gefundene Safety-Fehler wird als `incident`-Fall in
  `server/testsets/safety.v1.json` übernommen, BEVOR er gefixt wird — der neue
  Fall muss erst rot sein (Test first).
- Remote: https://github.com/bylenni/ylab-arch.git

## Projekt-Konventionen

- Sprache in UI, Kommentaren und Commits: Deutsch.
- Keine Secrets ins Repo: `.env` (OpenRouter-Key) ist gitignored.
- Große Binaries sind gitignored (Whisper-Modell, Piper-Stimme, tts-venv) —
  Setup-Anleitung dafür steht im README („Setup nach dem Klonen").
- System-Prompts, Regeln und Presets sind Produkt-Artefakte: Änderungen daran
  bewusst und nachvollziehbar committen.

## Struktur-Kurzreferenz

- `src/` — React-App (Canvas, TestPanel, Arena, Inspector)
- `src/presets.ts` — MVP- & Zielbild-Architektur inkl. Finetuning-Plänen pro Knoten
- `src/scenarios.ts` — Szenario-Datenmodell (Parametersätze für die Arena)
- `server/index.mjs` — Live-Pipeline-Backend (/api/run, /api/judge, /api/stt, /api/tts, /api/models)
- `server/teachingPlanner.mjs` — Teaching Planner Stufe 1 (deterministisches Regelwerk)
- `docs/` — Design-Dokumente
