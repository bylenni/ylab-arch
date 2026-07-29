# Architektur-Studio · Sprach-KI-Begleiter (4–7 Jahre)

Interaktives Werkzeug, um die Systemarchitektur unseres voice-first KI-Begleiters für Kinder
zu visualisieren, zu bearbeiten und zu testen.

## Start

```bash
npm install
cp .env.example .env   # OPENROUTER_API_KEY eintragen (für den Live-Modus)
npm run dev            # startet Webapp (5173) + Live-API (8787) parallel
npm run stt            # optional, eigenes Terminal: lokales Whisper (Port 8788)
```

**Optional: EU-Provider Melious** ([melious.ai](https://melious.ai)) — für eine Pipeline, die
die EU nie verlässt. `MELIOUS_API_KEY` in die `.env` eintragen; passende Modelle erscheinen dann
im Modell-Dropdown als eigene Gruppe „melious · EU" (IDs mit `melious:`-Prefix). Ganz ohne
OpenRouter-Key nutzbar — es reicht, wenn irgendein Provider-Key gesetzt ist. Ob der Key erkannt
wurde, zeigt `curl localhost:8787/api/health` (Feld `hasMeliousKey`).

## Setup nach dem Klonen (einmalig)

Modell-Binaries und das TTS-venv sind aus Größengründen nicht im Repo:

```bash
# STT: whisper.cpp + deutsches Modell (~1,6 GB)
brew install whisper-cpp
mkdir -p server/models
curl -L -o server/models/ggml-large-v3-turbo.bin \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"

# TTS: Piper + deutsche Stimme (~110 MB)
python3 -m venv server/tts-venv
server/tts-venv/bin/pip install piper-tts
server/tts-venv/bin/python -m piper.download_voices de_DE-thorsten-high --data-dir server/tts-voices
```

## Git-Workflow

Trunk-based: **Jede Änderung wird direkt auf `main` committet und gepusht — `main` ist Production.**
Details in [CLAUDE.md](CLAUDE.md).

**Echtes STT/TTS im Test-Panel:**
- **STT (self-hosted)**: `brew install whisper-cpp`, Modell liegt unter `server/models/`
  (ggml-large-v3-turbo). `npm run stt` startet den whisper.cpp-Server; der
  🎙-Push-to-Talk-Button im Test-Panel nimmt auf (halten → sprechen → loslassen)
  und schreibt das Transkript in die Äußerung.
- **TTS**: „▶ Anhören"-Button unter der Antwort. Ohne Konfiguration spricht macOS
  `say` (Stimme Anna) als Platzhalter. Ein echter TTS-Server (z. B. Orpheus/
  Kartoffel hinter einem OpenAI-kompatiblen Endpoint) wird per `TTS_URL` in der
  `.env` angedockt — der Rest der Pipeline bleibt unverändert.

## Was die App kann

UI: Tailwind CSS v4 mit shadcn-artigem Neutral-Theme (`src/index.css`), Light/Dark per
Toggle in der Topbar (Klasse `.dark` auf `<html>`, Systempräferenz als Default).

- **Zwei Presets**: MVP-Architektur und Zielarchitektur (Umschalter oben). Änderungen werden
  pro Preset automatisch im Browser gespeichert; „Zurücksetzen" lädt das Preset neu.
- **Bearbeiten**: Komponenten anklicken → Tab „Komponente" in der Sidebar (Name, Typ, Latenz,
  Beschreibung, Konfiguration). Verbindungen von Knoten-Unterkante zu Oberkante ziehen;
  Kanten tragen Bedingungen (`normal`, `sensibel`, `unklar`, `ok`, `blockiert`), nach denen
  Router und Safety-Prüfung routen.
- **Testen — zwei Modi** (Tab „Testen"):
  - **Heuristik**: Keyword-Regeln simulieren die Modelle offline — testet Routing-Logik
    und konfigurierte Latenzbudgets.
  - **Live**: Die Äußerung läuft über [OpenRouter](https://openrouter.ai) durch echte
    Modelle — Triage-Klassifikation, Haupt-LLM-Antwort und Safety-Prüfung, mit gemessenen
    Latenzen und Token-Zahlen pro Step. **Welches Modell pro Step läuft, steht im
    Konfigurationsfeld `model` der Triage-, LLM- und Safety-Knoten** — Modell wechseln,
    Testlauf starten, vergleichen. So lässt sich die Kostenkurve (kleine Modelle,
    später self-hosted + feingetunt) gegen die Qualitätsmesslatte testen.
- **Export/Import**: Architektur als JSON sichern und teilen.

## Live-Backend

[server/index.mjs](server/index.mjs) implementiert die MVP-Pipeline mit echten Calls:
Triage (JSON-Klassifikation) → deterministischer Router (fail-closed bei unlesbarer
Triage) → geskripteter sensibler Pfad **ohne** LLM bzw. Haupt-LLM mit versioniertem
System-Prompt (Persona, Sokratik, Altersband) → deterministische Pattern-Schicht +
Safety-Modell → ggf. kuratierte Ersatzantwort. OpenRouter läuft mit
`provider.data_collection: "deny"` (keine Anbieter, die Prompts zum Training nutzen).
STT/TTS sind noch nicht angebunden — die Live-Latenz misst nur die Modellkette.

## Simulator-Semantik

Die Klassifikation ist eine Keyword-Heuristik als Platzhalter für die echten Modelle — sie
macht die *Routing-Logik* testbar, nicht die Modellqualität:

- `riskWords` / `emotionWords` / `clarifyMinWords` (Konfiguration der Triage-Komponente)
  steuern die Entscheidung normal / sensibel / Rückfrage.
- `blockPatterns` (Konfiguration der Safety-Komponenten) blockiert Antwortentwürfe und
  erzwingt die kuratierte Ersatzantwort (fail-closed).
- Latenzen der Komponenten summieren sich zum Budget „bis erstes Audio" (Ziel: p50 ≈ 1,5 s,
  wahrgenommen < 500 ms durch Earcon).

## Hintergrund

Das zugehörige Architektur-Review (Kritik des Ausgangsentwurfs, MVP- und Zielarchitektur,
Latenz-Realität, Safety-/Datenschutz-Analyse) liegt als Artifact vor.
