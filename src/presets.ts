import type { Architecture, ArchNode, ArchEdge, ArchNodeData } from './types'

const n = (
  id: string,
  x: number,
  y: number,
  data: Partial<ArchNodeData> & { label: string; kind: ArchNodeData['kind'] },
): ArchNode => ({
  id,
  type: 'arch',
  position: { x, y },
  data: { description: '', latencyMs: 0, config: {}, ...data },
})

const e = (source: string, target: string, condition = ''): ArchEdge => ({
  id: `${source}->${target}`,
  source,
  target,
  label: condition || undefined,
})

const TRIAGE_CONFIG = {
  model: 'google/gemini-2.5-flash-lite',
  riskWords: 'waffe, messer, feuerzeug, weh tun, sterben, tot, blut, geheimnis, verletzt, schlagen',
  emotionWords: 'angst, traurig, weinen, wütend, allein, streit',
  clarifyMinWords: '2',
}

const SAFETY_CONFIG = {
  model: 'openai/gpt-4o-mini',
  blockPatterns: 'adresse, telefonnummer, passwort, feuerzeug, messer, medikament',
}

const MAIN_LLM_CONFIG = {
  model: 'google/gemini-2.5-flash',
  altersband: '4–5 / 6–7',
  persona: 'Maschine, kein Freund-Ersatz',
}

/** Versionierter System-Prompt — {alter} wird zur Laufzeit durch das Altersband ersetzt. */
export const DEFAULT_SYSTEM_PROMPT = `Du bist ein freundlicher Sprach-Begleiter für ein Kind im Alter von {alter} Jahren. Deine Antwort wird vorgelesen (Text-to-Speech).

Regeln:
- Sprich einfach und warm, in gesprochener Sprache. 2 bis 4 kurze Sätze. Keine Listen, keine Emojis, keine Sonderzeichen.
- Bei Lernfragen (Rechnen, Buchstaben): Verrate die Lösung NICHT sofort. Gib einen Hinweis oder stelle genau eine Gegenfrage, die das Kind zur Lösung führt.
- Bei Wissensfragen: Erkläre kindgerecht und korrekt in 1-2 Sätzen, dann genau eine neugierig machende Gegenfrage. Keine Sokratik-Schleife.
- Bei Geschichtenwunsch: Erzähle einen kurzen, fantasievollen Abschnitt (3-4 Sätze) und frage, ob du weitererzählen sollst.
- Wenn du etwas nicht sicher weißt: Sag das ehrlich und schlage vor, gemeinsam mit Mama oder Papa nachzuschauen.
- Niemals: gefährliche Anleitungen, Erwachsenenthemen, nach persönlichen Daten fragen, behaupten du seist ein echter Freund oder ein Mensch. Auf die Frage danach: Du bist eine Maschine, die gern zuhört und erzählt.
- Erfinde keine Fakten. Lieber weniger sagen als etwas Falsches.`

const PROMPT_NODE_CONFIG = { prompt: DEFAULT_SYSTEM_PROMPT }

/* ---- Finetuning-Pläne pro Komponente (siehe Finetuning-Fahrplan-Artifact) ---- */

const FT_STT =
  '⭐ Priorität 1 — echtes Finetuning: Whisper large-v3-turbo per LoRA auf eigene Kinderaufnahmen (Start 20–50 h mit korrigierten Transkripten, Ziel 100–300 h → voller Finetune). Vorher 2–5 h Kinder-WER-Testset bauen — es misst alles Weitere. Parallel Parakeet-v3 auf demselben Testset vergleichen. ~5–15 k€, fast alles Transkription; GPU <300 €.'

const FT_LLM =
  '⭐ Priorität 2 — LoRA-SFT (bewusst KEIN volles Finetuning): 2.000–10.000 Gold-Dialoge (Frontier-Distillation durch unsere Prompts + Pädagogen-Review) formen Ton, Wärme und Sokratik-Treue. Volles Training würde Wissen/Deutsch der Basis beschädigen. Planner-Strategien als separate LoRAs (vLLM Multi-LoRA). ~3–10 k€, GPU <100 €. Regel: erst trainieren, wenn der Eval zeigt, dass Prompting nicht reicht.'

const FT_TTS =
  '⭐ Priorität 3 — Custom Voice (einmaliges Projekt): Sprecherin casten + Vertrag inkl. synthetischer Nutzung, 2–10 h Studioaufnahmen (Geschichten-/Erklär-/Trost-Ton, Zahlen sauber). Darauf zwei Stimmen trainieren: Piper (offline auf der Box) und Orpheus/Chatterbox (Produktqualität). Blindtest mit Eltern UND Kindern. ~2 Monate, 5–15 k€. Der Aufnahme-Datensatz ist modellagnostisch — Modelle darunter jederzeit tauschbar.'

const FT_TRIAGE_MVP =
  'Jetzt: API-Modell, kein Training. Später Distillation: 50–100k gelabelte Äußerungen fallen im Pilotbetrieb automatisch an (jeder Turn = 1 Label) → LoRA auf Qwen3-4B, Ziel <150 ms, heikle Fälle menschlich nachgeprüft. ~1–3 k€.'

const FT_TRIAGE_ZIEL =
  'Das Distillat selbst: LoRA auf Qwen3-4B, trainiert auf 50–100k automatisch gelabelten Pilot-Äußerungen (+2–5k menschlich geprüfte Grenzfälle). Optional zweite Stufe: GBERT-Encoder für <20 ms. ~1–3 k€, GPU <150 €.'

const FT_SAFETY =
  'Erst NICHT trainieren — Steuerung über Policy-Text (Guard-Modelle mit kleinen Datenmengen zu finetunen macht sie oft schlechter). Pflicht: deutsche Validierung auf eigenem Red-Team-Set (FN-Rate pro Kategorie). Ab 5–20k gelabelten deutschen Fällen: eigener GBERT-Klassifikator als Ersatz für Prüfer A. ~3–8 k€ (Experten-Labeling).'

const FT_AUDIO =
  'Kleine Klassifikatoren voll trainieren (sind winzig): AST/PANNs für Weinen/Schreien, ECAPA für Erwachsenen- vs. Kinderstimme. Basis: öffentliche Audio-Event-Datensätze + einige hundert eigene Validierungs-Clips. 1–2 Wochen, <500 €.'

const FT_KEIN_TRAINING_SOFTWARE =
  'Kein Training — deterministische Software: versioniert, getestet, auditierbar. Genau deshalb fail-closed verlässlich.'

const FT_KEIN_TRAINING_WISSEN =
  'Kein Training — Wissen wird kuratiert und nachgeschlagen (RAG-Prinzip), nie antrainiert: antrainierte Fakten kann man weder korrigieren noch löschen. Embedding-Finetuning frühestens mit großem Suchvolumen + Erfolgsdaten.'

const FT_PROMPT_EBENE =
  'Kein Training — Prompt-Ebene: in Minuten änderbar, versionierbar, sofort umkehrbar. Immer die erste Stellschraube, bevor irgendjemand eine GPU anwirft.'

const FT_PLANNER =
  'Kein LLM-Training! Der Planner lernt als Policy: Contextual Bandit auf (Zustand, Strategie, Ergebnis)-Tupeln aus dem Event-Log — Statistik, keine Gewichte. Reward = Selbstlösung/Retention, explizit NICHT Nutzungsdauer. Die sprachliche Ausführung der Strategien lernt das Haupt-LLM per LoRA.'

const FT_DETERMINISTISCH =
  'Nie trainieren — bewusst symbolisch (Regeln, Pattern, PII via Presidio): teilt keinen einzigen Fehlermodus mit neuronalen Netzen. Das ist die dritte Fehler-Spezies neben den zwei Modellfamilien.'

const FT_SCRIPT =
  'Kein Training — kuratierte, von Kinderschutz-Experten freigegebene Antwortbausteine. Änderungen laufen über Review, nicht über Gewichte.'

const FT_OPS =
  'Judge bleibt untrainiertes Frontier-Modell mit Rubrik (wer den eigenen Prüfer trainiert, prüft sich selbst). Eiserne Regeln: kein Finetune ohne Eval davor, keiner geht live ohne komplettes Safety-Regressionsset danach.'

export const mvpArchitecture: Architecture = {
  id: 'mvp',
  name: 'MVP-Architektur',
  nodes: [
    n('device', 0, 0, {
      label: 'Push-to-Talk Gerät',
      kind: 'input',
      latencyMs: 0,
      description:
        'Hardware-Mute als Default, LED-Anzeige, sofortiger Earcon + lokal gecachte Denk-Floskeln. Kein Always-On-Mikrofon.',
    }),
    n('stt', 0, 130, {
      label: 'Streaming-STT',
      kind: 'stt',
      latencyMs: 650,
      finetuning: FT_STT,
      description:
        'Auf Kindersprache evaluiert (eigenes Testset). Audio wird nach Transkription gelöscht. Enthält Endpoint-Erkennung mit Kinder-Pausenmustern.',
      config: { endpointMs: '500–800', audioRetention: 'keine' },
    }),
    n('triage', 0, 260, {
      label: 'Triage-LLM (1 Call)',
      kind: 'triage',
      latencyMs: 150,
      finetuning: FT_TRIAGE_MVP,
      description:
        'Ein schneller LLM-Call mit Structured Output: Intent, Risiko, Emotion, STT-Konfidenz. Läuft parallel zum STT-Endstück. Labelt nebenbei Daten für spätere destillierte Klassifikatoren.',
      config: TRIAGE_CONFIG,
    }),
    n('router', 0, 390, {
      label: 'Deterministischer Router',
      kind: 'router',
      latencyMs: 5,
      finetuning: FT_KEIN_TRAINING_SOFTWARE,
      description:
        'Dünne, versionierte, fail-closed Software-Logik. Entscheidet: normal / sensibel / Rückfrage bei niedriger Konfidenz.',
    }),
    n('clarify', -300, 520, {
      label: 'Rückfrage',
      kind: 'clarify',
      latencyMs: 10,
      finetuning: FT_SCRIPT,
      description: '„Magst du das noch einmal sagen?" — bei zu kurzer oder unsicherer Erkennung.',
    }),
    n('library', 0, 520, {
      label: 'Kuratierte Inhaltsbibliothek',
      kind: 'content',
      latencyMs: 40,
      finetuning: FT_KEIN_TRAINING_WISSEN,
      description:
        'Geschichten, Lernmodule, Faktenbausteine — von Pädagogen kuratiert, per Intent ausgewählt, als Prompt-Kontext. Kein Vektor-RAG im MVP.',
    }),
    n('scriptpath', 300, 520, {
      label: 'Sensibler Pfad (geskriptet)',
      kind: 'script',
      latencyMs: 20,
      finetuning: FT_SCRIPT,
      description:
        'Ausschließlich kuratierte Antwortbausteine: validieren, benennen, an Vertrauensperson verweisen. Eskalations-Policy + Human Review. Kein freies Generieren.',
    }),
    n('sysprompt', 0, 650, {
      label: 'System-Prompt (versioniert)',
      kind: 'prompt',
      latencyMs: 5,
      finetuning: FT_PROMPT_EBENE,
      description:
        'Persona-Policy, Pädagogik-Strategie (sokratisch mit Grenzen) und Altersband als versionierter Prompt. {alter} wird zur Laufzeit ersetzt. Im Live-Modus wird genau dieser Text an das Haupt-LLM geschickt — hier editieren und testen.',
      config: PROMPT_NODE_CONFIG,
    }),
    n('llm', 0, 780, {
      label: 'Haupt-LLM (Model-Gateway)',
      kind: 'llm',
      latencyMs: 550,
      finetuning: FT_LLM,
      description:
        'Austauschbares Foundation Model hinter Gateway. Der Schlüssel „model" bestimmt das OpenRouter-Modell im Live-Modus.',
      config: MAIN_LLM_CONFIG,
    }),
    n('safety', 0, 910, {
      label: 'Output-Safety (heterogen)',
      kind: 'safety',
      latencyMs: 200,
      finetuning: FT_SAFETY,
      description:
        'Safety-Modell einer anderen Modellfamilie + deterministische Pattern-/PII-Checks. Prüft mit Antwortkontext, segmentweise vor TTS-Freigabe.',
      config: SAFETY_CONFIG,
    }),
    n('fallback', 300, 910, {
      label: 'Kuratierte Ersatzantwort',
      kind: 'script',
      latencyMs: 10,
      finetuning: FT_SCRIPT,
      description: 'Fail-closed: Bei rotem Safety-Befund wird eine geprüfte Ersatzantwort ausgespielt.',
    }),
    n('tts', 0, 1040, {
      label: 'Streaming-TTS',
      kind: 'tts',
      latencyMs: 350,
      finetuning: FT_TTS,
      description: 'Beginnt erst nach Freigabe des ersten sicheren Segments.',
    }),
    n('out', 0, 1170, {
      label: 'Audio-Ausgabe',
      kind: 'output',
      latencyMs: 0,
      description: 'Wahrgenommene Latenz < 500 ms durch Earcon; erstes Antwort-Audio p50 ≈ 1,5 s.',
    }),
    n('ops', -340, 130, {
      label: 'Ab Tag 1: Eval-Harness & Ops',
      kind: 'ops',
      latencyMs: 0,
      finetuning: FT_OPS,
      description:
        'Eval-Suite mit kindgerechten Testfällen + Red-Team (läuft bei jeder Änderung), FP/FN-Metriken mit Produktschwellen, Versionierung, Eltern-App (Einwilligung, Limits, Löschung, Themen-Summaries), minimales Memory (Name, Altersband, 3–5 Interessen).',
    }),
  ],
  edges: [
    e('device', 'stt'),
    e('stt', 'triage'),
    e('triage', 'router'),
    e('router', 'clarify', 'unklar'),
    e('router', 'library', 'normal'),
    e('router', 'scriptpath', 'sensibel'),
    e('library', 'sysprompt'),
    e('sysprompt', 'llm'),
    e('llm', 'safety'),
    e('safety', 'tts', 'ok'),
    e('safety', 'fallback', 'blockiert'),
    e('fallback', 'tts'),
    e('scriptpath', 'tts'),
    e('clarify', 'tts'),
    e('tts', 'out'),
  ],
}

export const targetArchitecture: Architecture = {
  id: 'ziel',
  name: 'Zielarchitektur',
  nodes: [
    n('device', 0, 0, {
      label: 'Push-to-Talk Gerät',
      kind: 'input',
      latencyMs: 0,
      description: 'Hardware-Mute, lokaler Degraded Mode mit Offline-Geschichten, per-Device-Zertifikat, signierte OTA-Updates.',
    }),
    n('stt', -170, 130, {
      label: 'Kinder-STT (adaptiert)',
      kind: 'stt',
      latencyMs: 600,
      finetuning: FT_STT,
      description: 'Auf eigenen Kindersprach-Daten nachtrainiert bzw. adaptiert.',
    }),
    n('audiosig', 170, 130, {
      label: 'Audio-Signal-Kanal',
      kind: 'stt',
      latencyMs: 80,
      finetuning: FT_AUDIO,
      description: 'Safety-Signal direkt auf Audio: Weinen, Schreien, fremde/erwachsene Stimme. Unabhängig vom Transkript — bricht die STT-als-SPOF-Kette.',
    }),
    n('triage', 0, 260, {
      label: 'Destillierter Multi-Task-Klassifikator',
      kind: 'triage',
      latencyMs: 60,
      finetuning: FT_TRIAGE_ZIEL,
      description: 'Trainiert auf gelabelten MVP-Logs. Schnell und günstig — die Evolutionsstufe des Triage-LLM-Calls.',
      config: TRIAGE_CONFIG,
    }),
    n('session', -340, 260, {
      label: 'Session-State-Service',
      kind: 'state',
      latencyMs: 15,
      finetuning: FT_KEIN_TRAINING_SOFTWARE,
      description: 'Dialogmodus, Geschichtenstand, offene sokratische Frage, Safety-Kontext über Turns. Grundlage für Multi-Turn-Safety.',
    }),
    n('router', 0, 390, {
      label: 'Deterministischer Router',
      kind: 'router',
      latencyMs: 5,
      finetuning: FT_KEIN_TRAINING_SOFTWARE,
      description: 'Fail-closed, versioniert, auditierbar.',
    }),
    n('rag', -150, 520, {
      label: 'Kuratiertes RAG',
      kind: 'content',
      latencyMs: 90,
      finetuning: FT_KEIN_TRAINING_WISSEN,
      description: 'Gewachsene Bibliothek mit Vektor-Retrieval. Kurationspipeline selbst gesichert (Injection-Vektor!).',
    }),
    n('scriptpath', 300, 520, {
      label: 'Sensibler Pfad (geskriptet)',
      kind: 'script',
      latencyMs: 20,
      finetuning: FT_SCRIPT,
      description: 'Eskalations-Policy mit Kinderschutzexperten, Human Review mit definierten Reaktionszeiten.',
    }),
    n('planner', -150, 650, {
      label: 'Teaching Planner (adaptiv)',
      kind: 'content',
      latencyMs: 50,
      finetuning: FT_PLANNER,
      description: 'Eigene Komponente mit Lernstands-Memory und Altersbändern. Sokratik mit „einfach mal antworten"-Option.',
    }),
    n('sysprompt', -150, 780, {
      label: 'System-Prompt (versioniert)',
      kind: 'prompt',
      latencyMs: 5,
      finetuning: FT_PROMPT_EBENE,
      description:
        'Prompt-Assembly: Persona, Pädagogik-Strategie vom Teaching Planner, Altersband, RAG-Kontext. {alter} wird zur Laufzeit ersetzt.',
      config: PROMPT_NODE_CONFIG,
    }),
    n('llm', 0, 910, {
      label: 'Foundation Model + SFT',
      kind: 'llm',
      latencyMs: 500,
      finetuning: FT_LLM,
      description: 'Hinter Model-Gateway. SFT für Tonalität — pro unterstütztem Modell bewusst eingepreist.',
      config: MAIN_LLM_CONFIG,
    }),
    n('safetyA', -150, 1040, {
      label: 'Safety-Prüfer A (Familie 1)',
      kind: 'safety',
      latencyMs: 120,
      finetuning: FT_SAFETY,
      description: 'Erste Modellfamilie.',
      config: SAFETY_CONFIG,
    }),
    n('safetyB', -150, 1170, {
      label: 'Safety-Prüfer B (Familie 2)',
      kind: 'safety',
      latencyMs: 120,
      finetuning: FT_SAFETY,
      description: 'Zweite, andere Modellfamilie — heterogene Redundanz gegen korrelierte blinde Flecken.',
      config: SAFETY_CONFIG,
    }),
    n('det', -150, 1300, {
      label: 'Deterministische Schicht',
      kind: 'safety',
      latencyMs: 15,
      finetuning: FT_DETERMINISTISCH,
      description: 'Pattern, PII, Regeln. Fail-closed.',
      config: SAFETY_CONFIG,
    }),
    n('fallback', 200, 1300, {
      label: 'Kuratierte Ersatzantwort',
      kind: 'script',
      latencyMs: 10,
      finetuning: FT_SCRIPT,
      description: 'Bei rotem Befund einer der drei Schichten.',
    }),
    n('tts', 0, 1430, {
      label: 'Streaming-TTS',
      kind: 'tts',
      latencyMs: 300,
      finetuning: FT_TTS,
      description: 'Segmentweise Freigabe.',
    }),
    n('out', 0, 1560, {
      label: 'Audio-Ausgabe',
      kind: 'output',
      latencyMs: 0,
      description: '',
    }),
    n('ops', -400, 0, {
      label: 'Betrieb',
      kind: 'ops',
      latencyMs: 0,
      finetuning: FT_OPS,
      description: 'Incident-Pipeline mit Human Review, Eval-Suite + Live-Drift-Monitoring, Kosten-Telemetrie pro Turn, EU-Deployment mit No-Training-Verträgen.',
    }),
  ],
  edges: [
    e('device', 'stt'),
    e('device', 'audiosig'),
    e('stt', 'triage'),
    e('audiosig', 'triage'),
    e('session', 'triage'),
    e('triage', 'router'),
    e('router', 'rag', 'normal'),
    e('router', 'scriptpath', 'sensibel'),
    e('rag', 'planner'),
    e('planner', 'sysprompt'),
    e('sysprompt', 'llm'),
    e('llm', 'safetyA'),
    e('safetyA', 'safetyB', 'ok'),
    e('safetyB', 'det', 'ok'),
    e('det', 'tts', 'ok'),
    e('safetyA', 'fallback', 'blockiert'),
    e('safetyB', 'fallback', 'blockiert'),
    e('det', 'fallback', 'blockiert'),
    e('fallback', 'tts'),
    e('scriptpath', 'tts'),
    e('tts', 'out'),
  ],
}

export const presets: Architecture[] = [mvpArchitecture, targetArchitecture]

export const testPresets: { label: string; text: string }[] = [
  { label: 'Wissensfrage', text: 'Warum ist der Himmel blau?' },
  { label: 'Geschichte', text: 'Erzähl mir eine Geschichte von einem kleinen Drachen' },
  { label: 'Lernen', text: 'Was ist 3 plus 4?' },
  { label: 'Emotional', text: 'Ich hab Angst im Dunkeln' },
  { label: 'Risiko', text: 'Wo ist das Messer in der Küche?' },
  { label: 'Unklar', text: 'Papa' },
]
