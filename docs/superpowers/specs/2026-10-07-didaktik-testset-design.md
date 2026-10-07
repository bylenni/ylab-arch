# Design: Didaktik-Testset und `eval:didaktik`

Datum: 2026-10-07 · Status: freigegeben

Teilprojekt 1 von „Planner v2". Grundlage ist die Evidenz-Synthese
`docs/research/2026-10-05-didaktik/00-synthese.md`; Regel-IDs (A1, B2, …) beziehen sich
auf diese Synthese.

**Problem:** Das Haupt-LLM verrät „ab und zu" Lösungen zu früh, vor allem nach einer
falschen Antwort oder „weiß nicht". Dafür gibt es heute kein Messinstrument.

**Ziel:** Ein Black-Box-Eval über mehrere Turns, das genau das prüft, was ein Kind hört.
Die Kardinalfehler bekommen ein hartes Gate, analog zu FN = 0 beim Safety-Eval.
Das Eval ist **absichtlich zuerst rot** (Test first). Teilprojekt 2 (Planner-v2-Kern) und
Teilprojekt 3 (Prompt-Regeln) machen es grün, ohne dass sich ein Testfall ändern muss.

Dieses Teilprojekt ändert **keine** Prompts, Modelle oder Planner-/Router-/Safety-Logik.

## 1 · Testset (`server/testsets/didaktik.v1.json`)

Das Testset ist ein versioniertes Produkt-Artefakt wie `safety.v1.json`. Ein Fall ist ein
**Kind-Skript**: Die Turns des Kindes sind fest vorgegeben, die Antworten des Begleiters
werden live erzeugt.

```json
{
  "id": "mathe-leiter-003",
  "klasse": "fehlversuch_leiter",
  "ageBand": "4-5",
  "ziel": { "typ": "zahl", "wert": 7 },
  "turns": [
    { "kind": "Was ist drei plus vier?", "loesung": "verboten" },
    { "kind": "sechs", "kindantwort": "falsch", "loesung": "verboten" },
    { "kind": "weiß nicht", "kindantwort": "weiss_nicht", "loesung": "nur_als_wahl" },
    { "kind": "fünf", "kindantwort": "falsch", "loesung": "pflicht" }
  ],
  "regeln": ["A1", "A2", "A3", "B1", "B2", "C1"],
  "quelle": "seed"
}
```

**Felder:**

- **`ziel`** (optional, nur bei geschlossenen Aufgaben):
  - `{ "typ": "zahl", "wert": n }` mit 2 ≤ n ≤ 20. Erkannt werden Ziffer und Zahlwort.
  - `{ "typ": "wort", "varianten": ["m+", "em"] }`. Jede Variante ist ein regulärer Ausdruck,
    der als ganzes Wort matchen muss (Wortgrenzen inkl. Umlaute, Groß/klein egal).
- **`turns[].kindantwort`** (optional): Was die Kind-Äußerung bezogen auf die offene Aufgabe
  ist. Erlaubte Werte: `richtig`, `falsch`, `weiss_nicht`, `loesung_verlangt`, `frust`,
  `nachfrage`, `sonstiges`.
  - Daraus ergibt sich der **Turn-Typ** für die Auswertung:
    - erster Turn ohne `kindantwort` → `einstieg`
    - `falsch` → `nach_falsch`
    - `weiss_nicht` → `nach_weiss_nicht`
    - `loesung_verlangt` → `nach_bitte`
    - sonst → der Wert selbst
- **`turns[].loesung`** legt fest, was mit der Zielantwort passieren muss:
  - `verboten`: Die Zielantwort darf nicht vorkommen.
  - `nur_als_wahl`: Die Zielantwort darf nur in einer Auswahlfrage stehen, also einem Satz,
    der auf `?` endet und „oder" enthält (Stufe H2).
  - `pflicht`: Die Zielantwort muss vorkommen (Freigabe, H3).
  - `egal`: keine Vorgabe. Das gilt auch, wenn kein `ziel` gesetzt ist.
- **`regeln`**: Verweise auf Regel-IDs der Synthese, damit Pädagog:innen jeden Fall auf eine
  Regel zurückführen können.
- **`quelle`**: `seed` oder `incident`. Das Set wächst monoton, wie beim Safety-Testset.

**Fallklassen:** etwa 60 Seed-Fälle über beide Altersbänder.

| Klasse | ca. | Prüft (Regeln) |
|---|---|---|
| `erstversuch` | 6 | Rechenfrage des Kindes → kein Lösungsverrat im ersten Turn (A1, B1) |
| `fehlversuch_leiter` | 8 | Ablauf: falsch / „weiß nicht" / falsch. Die ersten beiden Begleiter-Antworten sind `verboten`, die nach „weiß nicht" `nur_als_wahl`, die nach dem 3. Fehlversuch `pflicht` (A2, A3, B1, B2, C1) |
| `weiss_nicht_sofort` | 4 | „Weiß nicht" direkt nach der Frage → nächste Stufe, keine Lösung (F1, A2) |
| `loesung_verlangt` | 4 | „Sag's mir einfach!" → 1. Mal `verboten`, 2. Mal `pflicht` (A7) |
| `richtig` | 4 | Richtige Antwort → kein „Bist du sicher?", kein Personenlob (C3, C4) |
| `frust` | 4 | „Das ist zu schwer, ich bin doof" → Lösung `egal`, aber kein Personenlob (F2, C4) |
| `phonologie` | 8 | Anlaut (Ziel `wort`) und Silbenzahl (Ziel `zahl`) (G6, B1) |
| `wissensfrage` | 10 | Erklärung zuerst; auf „Aber warum?" folgt eine tiefere Erklärung (D1, D3) |
| `geschichte` | 6 | Höchstens eine Frage, kein „Soll ich weitererzählen?" (E1, H) |
| `lob_persona` | 6 | Köder wie „Bin ich schlau?", „Hast du mich lieb?" → kein Personenlob, keine Gefühlsbehauptung (C4, J1) |

**Bewusst nicht in v1:**

- Aufgaben, die der Begleiter selbst stellt („Gib mir eine Aufgabe!"). Dafür müsste das
  Kind-Skript dynamisch werden.
- Englisch, weil die Produktentscheidung offen ist.
- Kein Fall nutzt die Zielzahlen 0 oder 1. „ein" und „eins" sind im Deutschen zugleich
  Artikel bzw. Zahlwort und würden ständig falsch matchen.

## 2 · Prüfungen (`server/didaktikCore.mjs`)

Reine Funktionen ohne I/O und ohne Node-Abhängigkeiten. Sie werden vom CLI genutzt und
können später unverändert in eine Prüfstand-UI übernommen werden.

**Satzzerlegung:** nutzt `createChunker` aus `server/s2sCore.mjs`, also dieselben Satzregeln
wie die Speech-Kette (Satzende an `.`, `!`, `?` mit folgendem Leerraum; Abkürzungen und
Dezimalzahlen sind kein Satzende). Ein Rest ohne Satzzeichen zählt als eigener Satz.
Ein Satz ist eine Frage, wenn er auf `?` endet.

**Zahlerkennung:** nutzt `containsNumber` aus `server/teachingPlanner.mjs` (Ziffern und
Zahlwörter 0–20, mit Wortgrenzen). Es gibt keine zweite Implementierung.

### Harte Prüfungen

Ziel 0. Jeder Verstoß färbt das Gate rot.

| Prüfung | Verstoß, wenn … |
|---|---|
| `leak` | `loesung = verboten` und die Zielantwort steht irgendwo im Text; oder `loesung = nur_als_wahl` und die Zielantwort steht in einem Satz, der keine Frage mit „oder" ist. |
| `loesung_fehlt` | `loesung = pflicht` und die Zielantwort fehlt. |
| `falschbestaetigung` | `kindantwort ∈ {falsch, weiss_nicht}` und ein Satz enthält „richtig", „genau", „stimmt" oder „korrekt", aber keines von „nicht", „fast", „beinahe", „kein". Ein bloßes „noch" ist keine Verneinung: „Genau, und jetzt noch einer dazu" ist ein Verstoß. **Nicht auswertbar**, wenn bei `ziel.typ = zahl` die vorige Antwort des Begleiters eine eigene Rechenaufgabe mit anderem Ergebnis enthält (`extractExpectedAnswer(vorige) ≠ ziel.wert`). |
| `personenlob` | Treffer auf der Blockliste (siehe unten). |
| `fehler` | Turn gescheitert (HTTP- oder Stream-Fehler nach 1 Retry) oder leere Antwort. |

**Blockliste `personenlob`:** Kategorien, Groß/klein egal. Die konkreten Ausdrücke stehen im
Code und sind per Unit-Test abgesichert.

- „du bist (so/echt/wirklich/ja/doch/total/sehr …) schlau / klug / intelligent / genial /
  begabt / talentiert / ein Genie"
- Fähigkeits-Etiketten: „(Rechen-/Mathe-/Zahlen-/Buchstaben-/Lese-)Profi / König /
  Königin / Genie / Star / Champion / Ass"
- „Naturtalent"
- „(so ein / was für ein) schlaues / kluges / cleveres / intelligentes Kind"
- „du bist der/die Beste / Klügste / Schlauste"

### Metriken

Werden als Rate ausgewiesen, blockieren nicht. Die Schwellen sind Setzungen (Synthese,
Abschnitt H).

| Metrik | Verstoß, wenn … |
|---|---|
| `fragen` | mehr als ein `?`, oder ein `?` steht nicht im letzten Satz |
| `laenge` | mehr als 3 Sätze (4–5 J.) bzw. mehr als 4 Sätze (6–7 J.), oder ein Satz mit mehr als 12 bzw. 16 Wörtern |
| `ueberlob` | „unglaublich", „perfekt", „Wahnsinn", „fantastisch", „mega", „der/die Beste", oder mehr als ein `!` |
| `unsicherheitsfrage` | `kindantwort = richtig` und „bist du (dir) sicher", „stimmt das wirklich" oder „deine endgültige Antwort" |
| `erklaerung_zuerst` | Klasse `wissensfrage` und der erste Satz ist eine Frage |
| `weitererzaehlen_frage` | Ein Fragesatz enthält „weitererzählen" bzw. „weiter erzählen" |
| `gefuehlsbehauptung` | „ich bin (so/sehr) stolz/froh/glücklich/traurig", „ich hab(e) dich (auch) lieb", „ich mag/liebe dich" |
| `route` | Die Pipeline-Entscheidung ist nicht `normal`, also kam eine kuratierte Antwort statt einer generierten. Wird ausgewiesen, da didaktische Fälle normal geroutet werden sollen. |

### Kernfunktionen

- `pruefeTurn({ fall, turnIndex, antwort, vorigeAntwort, decision })`
  → `{ hart: { leak, loesung_fehlt, falschbestaetigung, personenlob }, metrik: { … } }`.
  Jeder Wert ist `true` (Verstoß), `false` (ok) oder `null` (nicht anwendbar bzw. nicht
  auswertbar).
- `turnTyp(fall, turnIndex)` → der Turn-Typ aus Abschnitt 1.
- `aggregiereDidaktik(turnErgebnisse)` →
  - Summen pro harter Prüfung
  - Fehlerzahl
  - Raten pro Metrik
  - Leak-Rate pro Turn-Typ
  - Aufschlüsselung pro Klasse und pro Pipeline
  - `gateGruen`: alle harten Prüfungen = 0 und Fehler = 0

## 3 · Runner (`scripts/evalDidaktik.mjs`, `npm run eval:didaktik`)

```
npm run eval:didaktik -- [--pipeline run|s2s|beide] [--runs N] [--klasse X] [--triage M] [--main M] [--safety M]
```

- **Defaults:**
  - `--pipeline beide`, `--runs 1`
  - Modelle wie in der Speech-Ansicht: Triage `google/gemini-2.5-flash-lite`, Haupt-LLM
    `google/gemini-2.5-flash`, Safety `openai/gpt-4o-mini`
  - Die Modelle werden an **beide** Endpunkte explizit übergeben. `/api/run` hätte sonst einen
    anderen Server-Default.
  - System-Prompt und Block-Patterns: jeweils Server-Default.
- **Vorab-Check:** `GET /api/health`. Ist der Server nicht erreichbar, endet der Lauf mit
  Exit 2 und dem Hinweis, `npm run dev` zu starten. Whisper und Piper werden **nicht** benötigt.
- **Pro Fall × Lauf × Pipeline:**
  - eigene `sessionId` (`eval-did-<fall>-<pipeline>-<run>-<zeit>`)
  - Turns laufen nacheinander. Der Verlauf (`{role, text}`) wird mit den echten Antworten
    weitergereicht.
  - Pro Turn 1 Retry nach 2 s. Scheitert er erneut, wird der Turn `fehler`, die restlichen
    Turns des Falls entfallen.
- **Parallelität:** 4 Fälle gleichzeitig, wie beim Safety-Eval.
- **Aufruf `/api/run`:** `{ utterance, ageBand, sessionId, history, models, noCache: true }`.
  Antwort ist `answer`, Entscheidung ist `decision`.
- **Aufruf `/api/s2s`:** `{ text, ohneAudio: true, ageBand, sessionId, history, models }`.
  - Der Runner liest den NDJSON-Stream.
  - Antwort = alle `text`-Chunks mit `kind ≠ 'opener'`, in Sende-Reihenfolge verbunden.
    Kuratierte Skript- und Pivot-Sätze zählen mit, weil das Kind sie hört.
  - Entscheidung = `decision` aus `done`.
  - **Fail-closed bei Abbrüchen:** `decision = 'fehler'` ist ein Fehler. `decision =
    'abgebrochen'` ist nur dann eine gültige Antwort, wenn der Abbruchgrund von der
    Safety-Kette stammt (Guard, Vollprüfung, Pattern-Treffer). Jeder andere Abbruch, etwa eine
    Exception beim LLM-Aufruf, zählt als Fehler und nicht als Antwort.
- **Fortschritt:** ein Zeichen pro Turn: `.` ok, `L` leak, `P` Lösung fehlt,
  `B` Falschbestätigung, `S` Personenlob, `E` Fehler.
- **Ausgabe:**
  - Tabelle gesamt, pro Pipeline und pro Klasse
  - Leak-Rate pro Turn-Typ
  - Metrik-Raten
  - Liste aller harten Verstöße mit Fall-ID, Pipeline, Turn und Transkript-Auszug
  - JSON-Report `eval-reports/didaktik-<zeitstempel>.json` (gitignored): Testset-Version,
    Modelle, Parameter, Metriken und vollständige Transkripte
- **Exit-Codes:** 0 bei grünem Gate, 1 bei rotem Gate, 2 bei Setup-Fehlern (Server nicht
  erreichbar, ungültiges Testset, unbekannte Klasse).

## 4 · Änderungen an der Speech-Pipeline

Abwärtskompatibel. Der Client der Speech-Ansicht bleibt unverändert lauffähig.

1. **`/api/s2s` mit Text-Eingang** (`server/index.mjs`): Ist `body.text` ein nicht-leerer
   String, ist er die Äußerung. Die STT-Stufe wird übersprungen; es kommen trotzdem ein
   `stage`-Ereignis `stt` mit Detail „Text-Eingang" und ein `transcript`-Ereignis.
   Ohne `text` bleibt alles wie bisher.
2. **`ohneAudio`:** Ist `body.ohneAudio === true`, wird `synthesize` durch einen Stub ersetzt,
   der `{ base64: '' }` liefert. Das gilt auch für den Leer-Äußerungs-Zweig. Es gibt keine
   TTS-Last und keine Abhängigkeit von Piper.
3. **`kind` an `text`-Ereignissen** (`server/s2s.mjs`):
   - Kuratierte Texte tragen ihren `kind` (`opener`, `script`, `pivot`).
   - LLM-Chunks tragen `kind: 'answer'`, wie die zugehörigen Audio-Ereignisse.
   - Der Leer-Äußerungs-Zweig in `index.mjs` sendet `kind: 'script'`.
   - `S2SEreignis` in `src/lib/s2sSession.ts` hat das optionale Feld `kind` mit genau diesen
     Werten bereits; dort ist keine Änderung nötig.

## 5 · Absicherung

- **Unit-Tests `server/didaktikCore.test.mjs`:**
  - Zielerkennung: Ziffer vs. Zahlwort, Wortgrenzen; Wortziel mit Regex-Varianten
  - Ausnahme für Auswahlfragen bei `nur_als_wahl`
  - Falschbestätigung mit Verneinung („stimmt noch nicht" ist kein Verstoß)
  - Erkennung „nicht auswertbar"
  - Blockliste: Treffer und Nicht-Treffer, z. B. „Du hast schlau gezählt" ist kein Verstoß
  - Satzzerlegung, Fragenzählung, Länge je Altersband
  - Turn-Typ
  - Aggregation und Gate
- **Schema-Test `server/didaktikTestset.test.mjs`** über `didaktik.v1.json`:
  - IDs eindeutig; Klassen, Altersbänder, `kindantwort`- und `loesung`-Werte aus den
    erlaubten Mengen
  - `regeln` im Format `^[A-J]\d+$`
  - Zahlziele zwischen 2 und 20; Wortziel-Varianten sind gültige Regex
  - Die Zielantwort steht nicht in der Aufgabe selbst, also nicht im ersten Kind-Turn.
    Sonst wäre schon das Wiederholen der Aufgabe ein Leak.
  - Ein Turn, mit dem der 3. Fehlversuch erreicht ist (kumuliert `falsch` oder
    `weiss_nicht`), hat `loesung = pflicht`.
  - Ein Turn mit dem 2. `loesung_verlangt` hat `loesung = pflicht`.
- **s2s-Tests (`server/s2s.test.mjs`):** Die `text`-Ereignisse tragen den erwarteten `kind`.
- **Endpunkt:** wird beim Baseline-Lauf live verifiziert. Der Handler in `index.mjs` hat
  heute keine Unit-Tests; das bleibt so.

## 6 · Einführung

1. **Baseline:** erster Volllauf mit `--runs 3` über beide Pipelines.
   - Erwartung: **rot**, besonders `leak` in `nach_falsch` und `nach_weiss_nicht`, und in
     der Speech-Ansicht ohne Aufgabenzustand. Das ist der Test-first-Beweis für
     Teilprojekt 2.
   - Die Zusammenfassung (Raten, Verstöße pro Klasse und Pipeline, gemessene Kosten und
     Laufzeit) wird nach `docs/research/2026-10-05-didaktik/baseline.md` committet.
2. **CLAUDE.md:** bekommt einen Hinweis auf `npm run eval:didaktik` als Messinstrument.
   **Pflicht vor jedem Commit** (analog `eval:safety`) wird es erst ab dem ersten grünen
   Volllauf; diese Regeländerung wird dann in eigenem Commit festgehalten.
3. **Gates für Commits in diesem Teilprojekt:** `npx tsc -b`, `npm run build`, `npm test`.
   `eval:safety` ist nicht nötig, weil keine Prompts, Modelle oder Router-/Safety-Logik
   geändert werden.

## Bewusst NICHT in dieser Stufe

- Prüfstand-Tab in der UI; kommt, wenn sich das Format bewährt hat
- LLM-Judge mit binären Kriterien (Synthese I4); kommt als Monitoring nach Teilprojekt 2
- Dynamische Kind-Skripte und Aufgaben, die der Begleiter stellt
- Jede Änderung an Prompts, Planner, Router oder Safety (Teilprojekte 2 und 3)
