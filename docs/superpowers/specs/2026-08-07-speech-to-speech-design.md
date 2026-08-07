# Design: Speech-to-Speech-Ansicht mit gestaffelter Safety-Freigabe

Datum: 2026-08-07 · Status: freigegeben

Neue vierte Ansicht im Studio: links die live laufende Speech-to-Speech-Architektur,
rechts ein Chat mit animiertem Globe als Sprach-Visualisierung, per Knopfdruck als
Gesprächs-Session an/aus.

Architektur-Vorbild: https://github.com/huggingface/speech-to-speech (VAD → STT → LLM →
TTS, Stufen über Queues entkoppelt, Chunk-Streaming). Übernommen wird das **Muster**,
nicht der Code: die HF-Pipeline hat keine Safety-Schicht, unsere Kette
(Triage → Router → Planner → Safety) bleibt vollständig erhalten und sitzt an der Stelle
ihrer einstufigen LLM-Phase.

## 1 · Transport

Neuer Endpoint **`POST /api/s2s`**: Request enthält das aufgenommene Audio (base64 WAV,
wie `/api/stt`) plus die üblichen Pipeline-Parameter (ageBand, models, systemPrompt,
blockPatterns, sessionId, history). Response ist ein **NDJSON-Stream** (`Content-Type:
application/x-ndjson`, eine JSON-Zeile pro Ereignis, Body wird per
`fetch` + `ReadableStream` gelesen — kein WebSocket, keine neue Abhängigkeit).

Ereignistypen:

| `type` | Nutzlast | Bedeutung |
|---|---|---|
| `stage` | `{ key, status, ms?, detail? }` | Stufe hat Zustand gewechselt (`aktiv`/`fertig`/`fehler`) |
| `transcript` | `{ text }` | STT-Ergebnis (Kinderäußerung) |
| `text` | `{ chunk, index }` | freigegebener Antwort-Chunk als Text |
| `audio` | `{ wavBase64, index, kind }` | freigegebener Audio-Chunk (`kind`: `opener`/`answer`/`script`/`pivot`) |
| `abort` | `{ grund }` | Prüfung gescheitert — Puffer verwerfen, Pivot folgt |
| `done` | `{ totalMs, decision }` | Turn beendet |

Invariante: Ein `audio`-Ereignis wird **nur** gesendet, wenn der zugehörige Inhalt eine
Prüfung bestanden hat (Opener/Script/Pivot sind kuratiert und vorab genehmigt).

## 2 · Server-Pipeline (`server/s2s.mjs`, neu)

Stufen, entkoppelt wie im Vorbild — mehrere gleichzeitig aktiv:

1. **VAD** — läuft im Client (siehe §4), meldet Sprachende; Server sieht nur das Ergebnis.
2. **STT** — bestehender Whisper-Pfad (`STT_URL`), unverändert.
3. **Triage → Router → Planner → Prompt** — bestehende Kette aus `runPipeline`,
   unverändert wiederverwendet (kein Duplikat der Logik).
4. **Haupt-LLM im Streaming-Modus** — `stream: true` gegen den per `resolveProvider`
   ermittelten Provider (OpenRouter und Melious sind beide OpenAI-kompatibel).
5. **Chunker** — akkumuliert Tokens zu vollständigen Sätzen.
6. **Safety-Gate** — siehe §3.
7. **TTS pro freigegebenem Chunk** — bestehender Piper-Pfad, ein WAV je Chunk.

Der sensible Pfad (`decision === 'sensibel'` / `'unklar'`) generiert wie bisher nicht
frei, sondern spielt die kuratierte Antwort — hier als vorsynthetisiertes WAV.

## 3 · Gestaffelte Freigabe

- **Opener**: kuratierte Liste kurzer Einstiege („Hmm, lass mich kurz überlegen …"),
  beim Serverstart einmalig synthetisiert und im bestehenden TTS-Cache abgelegt. Wird
  gesendet, sobald STT fertig ist. Kosten und Risiko null.
- **Chunk 1** (erster vollständiger Satz): deterministische Pattern-Schicht, danach
  **ein** Guard-Call (Safety-Modell) auf dem **kumulativen Präfix inklusive
  Kinderäußerung** — nie auf dem isolierten Satz.
- **Chunk 2…n**: kein eigener Guard-Call. Sie werden freigegeben, sobald die **volle
  Safety-Prüfung der Gesamtantwort** (bestehende Prüfung, unverändert) grün ist. Diese
  ist typisch nach ~2 s da, während Chunk 1 noch ~3–4 s Audio abspielt — die Prüfung holt
  die Ausgabe nicht ein. Kostenwirkung gegenüber heute: **+1 kleiner Modell-Call pro Turn**.
- **Abbruch**: Fällt Pattern-Schicht, Guard oder Vollprüfung, wird kein weiterer
  `audio`-Chunk gesendet; der Client verwirft seinen Puffer und spielt die
  vorsynthetisierte Pivot-Phrase („… weißt du was, das frag am besten Mama oder Papa.").
  Der bereits gesprochene Präfix war selbst freigegeben — es wird nie Ungeprüftes hörbar.
- **Skript-Antworten** (`SCRIPTED_RISK`, `SCRIPTED_EMOTION`, `SCRIPTED_CLARIFY`,
  `SCRIPTED_FALLBACK`) werden ebenfalls beim Start vorsynthetisiert: der sensible Pfad
  antwortet damit in ~50 ms.

## 4 · Client-Session (`src/lib/s2sSession.ts`, neu)

Zustandsautomat: `idle → hoert_zu → denkt → spricht → hoert_zu …`, Ende per Knopfdruck.

- Mikrofon-Erfassung und WAV-Kodierung erben vom bestehenden `PttRecorder`
  (`src/lib/recorder.ts`) — gemeinsame Teile werden dort wiederverwendet, nicht kopiert.
- **VAD energie-basiert**: gleitender RMS über die Mikrofon-Samples, Schwelle plus
  Nachlaufzeit (Sprachende erst nach definierter Stille). Bewusste Abweichung vom Vorbild
  (dort Silero VAD): null Abhängigkeiten, sofort lauffähig. Die Stufe ist als eigenes
  Modul isoliert, damit Silero-per-WASM später ein Austausch ist.
- **Audio-Queue mit Puffer**: eintreffende `audio`-Chunks werden gepuffert und
  nacheinander abgespielt; bei `abort` wird der noch nicht gespielte Rest verworfen
  (Broadcast-Delay-Prinzip).
- Ein `AnalyserNode` je Richtung (Mikrofon-Eingang, Ausgabe) liefert die Amplitude für
  den Globe.

## 5 · Ansicht (`src/components/S2SView.tsx`, neu)

Vierter View neben Canvas / Arena / Prüfstand, Splitscreen:

- **Links** `S2SDiagram.tsx`: die Stufenkette als Live-Flussdiagramm. Jede Stufe zeigt
  Zustand (ruhend / aktiv / fertig / fehler), letzte Latenz und Warteschlangen-Füllstand;
  mehrere Stufen können gleichzeitig aktiv leuchten. Speist sich ausschließlich aus den
  `stage`-Ereignissen des Streams.
- **Rechts** Chat mit `VoiceGlobe.tsx` in der Mitte: SVG-Sphäre mit Ringen, Skalierung
  und Leuchtkraft aus der Amplitude des jeweils aktiven `AnalyserNode`. Zustände: aus,
  hört zu (Mikrofon-Amplitude), denkt (ruhiges Kreisen), spricht (Ausgabe-Amplitude).
  Ein zentraler Knopf startet/beendet die Session. Theme-Tokens wie überall, keine
  externen Abhängigkeiten.
- Der Gesprächsverlauf (Kinderäußerung, Antwort) erscheint als Text unter dem Globe.

## 6 · Fehlerfälle (durchweg fail-closed)

- LLM-Stream reißt mitten in der Antwort ab → `abort` + Pivot.
- Guard-Antwort unparsbar oder Call scheitert → gilt als nicht freigegeben → `abort` + Pivot.
- TTS für einen Chunk scheitert → `abort` + Pivot (nicht stumm weiterreden).
- STT liefert leeren Text → kurze Rückfrage über den bestehenden `unklar`-Pfad.
- Mikrofon-Zugriff verweigert → klare deutsche Meldung in der Ansicht, Session bleibt aus.
- Stream bricht clientseitig ab → Audio stoppt, Globe zurück auf `idle`.

## 7 · Absicherung

Unit-Tests (Vitest, im bestehenden Commit-Gate):

- **Satz-Chunker**: trennt an Satzenden, **nicht** bei Abkürzungen („z. B.") oder
  Dezimalzahlen; unvollständiger Rest bleibt gepuffert.
- **Safety-Gate als Zustandsautomat**: die Invariante „kein Audio-Chunk ohne bestandene
  Prüfung" als Test — inklusive der Fälle: Guard lehnt Chunk 1 ab, Vollprüfung lehnt ab
  nachdem Chunk 1 gesendet wurde (Abbruch, kein weiterer Chunk), Guard-Fehler zählt als
  Ablehnung.

## Bewusst NICHT in dieser Stufe

- Kein Silero-VAD (energie-basiert, siehe §4), kein Parakeet-STT, kein Kokoro-TTS —
  Modellwechsel sind eigene Schritte.
- Kein Barge-in (Kind unterbricht die laufende Antwort).
- Keine Erweiterung des Prüfstand-Testsets um die Streaming-Dimension — eigener Schritt,
  sobald die Kette steht.
- Kein Betrieb des HF-Repos als Prozess; die Stufen-Schnittstelle bleibt aber so
  geschnitten, dass ein alternatives Backend später einhängbar ist.
