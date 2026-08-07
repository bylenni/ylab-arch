# Design: Modelle in der Speech-Ansicht anzeigen und umstellen

Datum: 2026-08-07 · Status: freigegeben

Die Speech-Ansicht läuft gegen die Canvas-Konfiguration, zeigt aber nirgends, welche
Modelle das sind. Diese Stufe macht sie sichtbar und direkt umstellbar.

## 1 · Server: Modellname im Stufen-Ereignis

`server/s2s.mjs` ergänzt die `stage`-Ereignisse der drei Modell-Stufen um ein
`model`-Feld (Strings wie `google/gemini-2.5-flash` oder `melious:qwen3-30b-a3b-instruct`):

- `triage` → `triageModel`
- `main` → `mainModel`
- `safety` → `safetyModel` (gilt auch für die `guard`-Stufe — der Guard-Aufruf für den
  ersten Satz nutzt dasselbe Modell)

Damit zeigt das Diagramm, was **tatsächlich gelaufen ist**, nicht nur was eingestellt war.
`src/lib/s2sSession.ts` erweitert den Typ `S2SEreignis` um das optionale Feld.

## 2 · ModelSelect in eigene Datei

Das Dropdown (Gruppierung nach Anbieter, Gruppe „melious · EU" zuoberst, Preise pro 1M
Tokens, „?" bei unbekannten Preisen) liegt heute als private Funktion in
`src/components/Inspector.tsx`. Es wandert unverändert nach
`src/components/ModelSelect.tsx` und wird von Inspector und Diagramm importiert — kein
Duplikat, keine Verhaltensänderung. Sonst wird an Inspector nichts angefasst.

## 3 · Diagramm: Dropdown pro Modell-Stufe

`src/components/S2SDiagram.tsx` zeigt in den Zeilen `triage`, `main` und `safety` das
aktuell eingestellte Modell und ein kompaktes `ModelSelect`. Die übrigen Stufen (vad, stt,
opener, router, planner, guard, script) bleiben unverändert; die `guard`-Zeile weist im
Hinweistext darauf hin, dass sie das Safety-Modell verwendet.

Anzeige des Namens über das vorhandene `shortModelName` aus `src/scenarios.ts` — EU-Modelle
bleiben dadurch am `melious:`-Präfix erkennbar.

## 4 · Wirkung: auf den Canvas schreiben

Eine Auswahl patcht den `model`-Wert am passenden Canvas-Knoten über das bestehende
`patchNode` aus `src/App.tsx` — dieselbe Wirkung wie im Inspector. Eine Quelle der
Wahrheit für Chat, Arena, Prüfstand und Speech; die Änderung überlebt den Ansichtswechsel.

- `App.tsx` reicht `onNodeChange={patchNode}` an `S2SView` durch.
- `S2SView` findet den Zielknoten anhand der Stufe und ruft
  `onNodeChange(id, { config: { ...config, model } })`.
- Zuordnung Stufe → Knotenart als reine Funktion `nodeKindForStage(stageKey)`:
  `triage → 'triage'`, `main → 'llm'`, `safety → 'safety'`, alles andere → `null`.
- Existiert kein passender Knoten (Canvas ohne diese Komponente), wird kein Dropdown
  angezeigt — die Stufe bleibt reine Anzeige.

## 5 · Während laufender Session gesperrt

Die Session hält ihre Konfiguration vom Start (der Payload wird einmal als Closure
übergeben); eine Änderung mitten im Gespräch würde still nicht wirken. Die Dropdowns sind
deshalb `disabled`, solange die Session läuft — analog zum bereits gesperrten
Altersband-Select — mit erklärendem `title`.

## 6 · Absicherung

- Unit-Test für `nodeKindForStage` (alle drei Zuordnungen plus „unbekannte Stufe → null").
- Browser-Prüfung: Modelle erscheinen in den drei Zeilen; Umstellen ändert den Wert im
  Inspector des zugehörigen Canvas-Knotens; Dropdowns sind während einer Session gesperrt.

## Bewusst NICHT in dieser Stufe

- Keine lokale Übersteuerung nur für die Speech-Ansicht (bewusst eine Wahrheit).
- Keine Umstellung von STT- oder TTS-Engine (die kommen aus der Server-Umgebung, nicht aus
  dem Canvas).
- Kein Umbau des Inspectors über die reine Extraktion des Dropdowns hinaus.
