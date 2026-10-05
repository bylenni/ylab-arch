# Didaktik-Evidenz für den Teaching Planner — Synthese

Stand: 2026-10-05 · Anlass: Das Haupt-LLM verrät Lösungen zu schnell und gibt keine
lernwirksamen Gegenfragen oder gestuften Hinweise. Ziel ist, das Regelwerk des Teaching
Planners wissenschaftlich zu fundieren, sodass Pädagog:innen jede Regel samt Quelle
Zeile für Zeile reviewen können.

## Methode und Grenzen

- Sechs parallele Literaturrecherchen. Die Originalberichte liegen in diesem Ordner:
  - [01 Scaffolding und Hinweis-Leiter](01-scaffolding-hinweisleiter.md)
  - [02 Feedback, Lob, Motivation, Affekt](02-feedback-lob-motivation.md)
  - [03 Fragen, Dialog, Neugier](03-fragen-dialog-neugier.md)
  - [04 Fachdidaktik Mathe und Schrift](04-fachdidaktik-mathe-schrift.md)
  - [05 KI-Tutoren und Sprachagenten für Kinder](05-ki-tutoren-kinderagenten.md)
  - [06 Adaptivität und Lernstand](06-adaptivitaet-lernstand.md)
- Die Quellen wurden per DOI über Crossref, OpenAlex, PubMed oder Volltext geprüft.
  Was nicht geprüft werden konnte, steht in den Berichten als `[unverifiziert]`.
  Die Berichte sind KI-gestützt erstellt. Vor externer Verwendung sollten Pädagog:innen
  oder Fachleute stichprobenartig gegenprüfen.
- Evidenzstufen in dieser Synthese:
  - **stark**: Metaanalyse oder mehrere RCTs
  - **mittel**: einzelne RCTs oder Experimente
  - **schwach**: korrelativ, Theorie oder Expertenkonsens
  - **Setzung**: Startwert ohne direkte Evidenz, muss kalibriert werden
- Die größte Lücke: **Es gibt keine RCTs mit frei generierenden LLM-Tutoren für 4- bis 7-Jährige
  und keine deutschsprachigen Daten zu Sprachagenten.** Die nächstgelegene Evidenz sind die
  geskripteten Sprachagenten-Studien von Ying Xu (3–7 J., englisch). Vieles ist von älteren
  Lernenden übertragen; das ist bei jedem Befund markiert.

---

## Kurzfassung: sieben Leitprinzipien

1. **Lernaufgabe: erst eigener Versuch, dann eine kurze Hinweis-Leiter, die mit der Lösung endet.**
   Das Kind versucht es zuerst selbst. Danach gibt es höchstens etwa drei Hilfestufen, und die
   Lösung kommt am Schluss, nicht nach dem ersten Fehler. Danach wendet das Kind die Lösung
   selbst an (nachsprechen, Zwillingsaufgabe).
   Quellen: Wood & Wood 1999; Aleven et al. 2016; Shute 2008; Xu et al. 2024 „Elinor".
   Gegenbefund: Smit et al. 2025, siehe Widersprüche.
2. **Die Lösung darf erst auf der letzten Stufe fallen. Das muss deterministisch geprüft werden,
   nicht nur per Prompt.** LLMs verraten Lösungen trotz Anweisung in 5–47 % der Fälle
   (MRBench 2025; Dinucu-Jianu 2025). Ungeschützter LLM-Zugang schadet dem Lernen
   (Bastani et al. 2025, PNAS).
3. **Totales Zurückhalten ist ebenso falsch.** Ein Modell, das fast nie verrät (0,9 %),
   brachte kaum Lernzuwachs (Dinucu-Jianu 2025; simulierte Lernende). Ungestütztes
   „Selbst-Erzeugen" ist bei Kindern unwirksam (Alfieri 2011: d = −0,15 bis −0,38).
   Nötig ist eine ausdrückliche **Freigabe-Stufe**.
4. **Wissensfragen: erst erklären, dann höchstens eine Anschlussfrage.** Kinder werten eine
   Gegenfrage auf ihr „Warum?" als Nicht-Erklärung und fragen erneut (Frazier, Gelman & Wellman
   2009; Chouinard 2007). Elaborative Befragung („Warum, glaubst du …?") zeigt bei jungen
   Kindern keinen Nutzen, weil das Vorwissen fehlt (Brod 2020).
5. **„Sokratisch" ist für 4- bis 7-Jährige das falsche Leitbild.** Besser belegt ist
   **kontingente, gestützte Hilfe**. Die Fragen zeigen dabei auf das relevante Merkmal und
   werden sofort aufgelöst. Die Hilfe richtet sich nach Erfolg und Vorwissen, nicht nach dem
   Alter. Das Alter liefert nur den Startwert.
   Quellen: Alfieri 2011; Fyfe & Rittle-Johnson 2016; Yu et al. 2018.
6. **Feedback ist aufgabenbezogen und ehrlich, nie personenbezogen.** Generisches Lob
   („Du bist schlau") erzeugt bei 4-Jährigen nach Fehlern Hilflosigkeit (Cimpian 2007,
   d = 1,17) und bei 3- und 5-Jährigen mehr Schummeln (Zhao 2017). Hinweise wirken stark
   (Hattie & Timperley 2007: d = 1,10), Lob schwach (d = 0,14).
7. **„Weiß nicht", Frust und Abbruchwunsch sind drei verschiedene Signale.** „Weiß nicht"
   ist meist echtes Nicht-Wissen oder eine Bitte um Hilfe und führt zur nächsten
   Hilfestufe. Frust führt dazu, die Aufgabe zu verkleinern und eine Wahl anzubieten. Bei
   einem Abbruchwunsch wird das respektiert. Wenn „weiß nicht" sofort die Lösung liefert,
   lernt das Kind, sich Lösungen zu holen (Aleven 2016).

---

## Wo das aktuelle Regelwerk der Evidenz widerspricht

| Aktuelle Regel (Code) | Problem | Belege | Richtung |
|---|---|---|---|
| Falsche Antwort → sofort Lösung (`outcomeDirective`, [teachingPlanner.mjs:137](../../../server/teachingPlanner.mjs)) | Kein zweiter Versuch, kein gezielter Hinweis, diagnostische Information geht verloren; wirkt als „Übernehmen" | Wood & Middleton 1975; Shute 2008; Leonard 2021 (4–5 J.); Secada 1983 | Hinweis-Leiter, Lösung erst auf der letzten Stufe |
| Frust-Regex inkl. „weiß nicht" → Lösung (`detectFrustration`, Regel 1) | Wissenslücke und Frust werden vermischt; lässt sich ausnutzen | Waterman 2000/2011; Aleven 2016; D'Mello 2014 | Drei Signalklassen (s. F) |
| ≥ 2 Fehlversuche → Lösung | Überspringt die Hilfestufen | Wood & Wood 1999 (etwa 3 Hinweise) | Lösung frühestens nach etwa 3 Fehlversuchen an derselben Aufgabe |
| ≥ 3 Kontakte → schwieriger (Regel 2) | Kontakt ist nicht Beherrschung; Kinder, die nicht vorankommen, bekommen schwerere Aufgaben | Beck & Gong 2013; Pelánek 2017 | Steigern nach Leistung; bei Stillstand zum Vorläufer-Skill |
| Mastery = 3 Erfolge | Erfolge zählen auch mit Hilfe, ohne zeitlichen Abstand, ohne Schutz gegen Raten | Pelánek 2017; Vlach 2012; Gaidoschik 2012 | 3 in Folge ohne Hilfe + Bestätigung an einem späteren Tag |
| Erstkontakt nach Alter: 6–7 sokratisch, 4–5 Hinweis vorab (Regel 4) | Sokratisch ohne Stütze entspricht ungestütztem Entdecken; ein Hinweis vor dem eigenen Versuch ist ungefragte Hilfe | Alfieri 2011; Sierksma 2025; Bangert-Drowns 1991 | Alle starten mit eigenem Versuch; bei 4–5 die Aufgabe konkret-handelnd einkleiden |
| Wissensfrage: „genau eine Gegenfrage" immer | Erzeugt Testcharakter; Kinder ändern unter Nachfragen sogar richtige Antworten | Bonawitz 2020; Ronfard 2018 | „Höchstens eine", im Wechsel mit Angeboten |
| Geschichte: „Soll ich weitererzählen?" | Verschenkt das Potenzial des dialogischen Lesens | Whitehurst; Mol 2008; Xu 2022 | Ein CROWD-Impuls pro Abschnitt, danach weitererzählen |
| Hinweise generisch („Äpfel, Finger, Bauklötze") | Nicht auf den Fehler zugeschnitten; vorgestellte Äpfel belasten ohne Bildschirm das Arbeitsgedächtnis | Carbonneau 2013; Gathercole 2004 | Fehlerspezifische Hinweise, echte Finger und Gegenstände |
| Skills: 3 Regex-Klassen | `mathe.grundrechnen` fasst 10–16 empirisch getrennte Stufen zusammen | Clements & Sarama; Krajewski (ZGV) | Feine Taxonomie (Bericht 04) |
| `schrift.buchstaben` | Buchstabenformen sind ohne Bildschirm nicht lehrbar; Buchstabennamen stören die Lautarbeit | Stalega 2024; Treiman 1994 | Phonologische Bewusstheit (Reime, Silben, Anlaute) |
| Planner-Direktive = eine Zeile am Prompt-Ende | Keine Entscheidung, keine Zielantwort, kein konkreter Hinweis | Bridge 2024 (+76 % mit Expertenentscheidung); LearnLM 2024 | Strukturierte Entscheidung, Grounding-Block |
| Keine Prüfung nach der Generierung | Ob die Lösung verraten wurde, wird nur per Prompt gesteuert | MRBench 2025; Bastani 2025 | Deterministische Gates + einmalige Regenerierung + Template |
| Judge-Rubrik „sokratisch" 1–5 | Belohnt Überfragen; holistische LLM-Urteile korrelieren schlecht mit Menschen | MRBench; TutorBench 2025 | Binäre, fallbezogene Kriterien |
| Speech-Ansicht (`s2s.mjs`) ohne Erwartung und Ergebnis | Die Antwort des Kindes auf eine Aufgabe wird nie ausgewertet, also kein Zustand über mehrere Turns | — (Code-Befund) | Gemeinsamer Planner-Kern für beide Pipelines |
| Reward später: sofortige Selbstlösung | Lädt den Bandit ein, leichte Aufgaben und große Hinweise „einzukaufen" | Lomas 2013; Bastani 2025 | Verzögerte Selbstlösung, gewichtet nach Hilfe |

---

## Konsolidierte Regel-Kandidaten

Format: WENN … DANN …. In Klammern stehen Evidenzstufe und Hauptquellen. Die Nummern
beziehen sich auf die Berichte (z. B. „03-R1" = Bericht 03, Regel R1).

### A — Lernaufgaben: Hinweis-Leiter

Eine Leiter pro offener Aufgabe:

| Stufe | Inhalt | Zählt als Hilfe? |
|---|---|---|
| **H0 Raum geben** | Aufgabe kürzer wiederholen, warten, Rateerlaubnis („Raten ist erlaubt") | nein |
| **H1 Fokussieren** | Teilrichtiges konkret benennen und auf das relevante Merkmal lenken; bei erkanntem Fehlermuster fehlerspezifisch | ja |
| **H2 Gemeinsam handeln** | Konkreter Teilschritt mit echten Fingern, Gegenständen oder Körper; Lückensatz oder Wahl aus zwei Optionen; das Kind macht den letzten Schritt | ja |
| **H3 Lösung als Lösungsbeispiel** | Lösung, ein Satz Begründung, das Kind sagt nach oder ergänzt; danach eine Zwillingsaufgabe | Lösung (zählt nicht als Selbstlösung) |

- **A1** WENN eine Lernaufgabe neu gestellt wird, DANN zuerst ein eigener Versuch auf H0,
  ohne Hinweis vorab. Bei 4–5 J. wird die Aufgabe selbst konkret-handelnd eingekleidet
  („Halt drei Finger hoch. Jetzt noch vier dazu. Wie viele sind das?"). Das ist kein
  Lösungshinweis.
  (mittel · Shute 2008; Bangert-Drowns 1991; Sierksma 2025; 03-R7; 01-R14)
- **A2** WENN die Antwort falsch ist ODER „weiß nicht" kommt ODER zum zweiten Mal Stille,
  DANN eine Stufe höher, höchstens eine Stufe pro Turn.
  (mittel/schwach · Wood & Middleton 1975; Wood et al. 1978; Touw 2020; Xu 2024)
- **A3** WENN an derselben Aufgabe 3 Fehlversuche vorliegen, DANN H3. Es gibt keine
  Endlosschleife.
  (schwach/Setzung · Wood & Wood 1999; Clement 2015: 3 Versuche, dann Lösung)
- **A4** WENN H3 erreicht ist, DANN endet der Turn mit der Aufforderung an das Kind, die
  Lösung selbst zu sagen, oder mit einer Zwillingsaufgabe. Diese startet eine Stufe tiefer.
  (mittel · Leonard 2021; Rittle-Johnson 2008; Kliegl 2018)
- **A5** WENN die Antwort richtig ist, DANN beginnt die nächste ähnliche Aufgabe eine Stufe
  unter der zuletzt benötigten (Fading).
  (schwach · Wood 1978; van de Pol 2010)
- **A6** WENN der Fehler zu einem bekannten Muster passt, DANN ist H1 fehlerspezifisch.
  Höchstens 2–3 Muster pro Skill (Shute: aufwendige Diagnose vermeiden). Beispiele:
  - a + b → a + b − 1: „Startzahl nicht mitzählen"
  - a − b → a − b + 1: „Schritte zählen"
  - Ergebnis der Gegenrechnung: „Kommen welche dazu oder gehen welche weg?"

  (mittel · Secada et al. 1983; Fuson 1984; 04-R5; 01-R9)
- **A7** WENN das Kind die Lösung verlangt und kein Frust vorliegt, DANN beim ersten Mal
  ermutigen und eine Stufe höher, beim zweiten Mal H3.
  (schwach · Aleven 2016; 01-R12; 05-R9)
- **A8** WENN die Erkennungssicherheit der Spracherkennung niedrig ist oder sich keine Antwort
  extrahieren lässt, DANN einmal nachfragen. Das zählt **nicht** als Fehlversuch, und das
  System sagt nie „falsch".
  (Ableitung · StratL 2024; Kennedy 2017; 01-R10)

### B — Lösungssperre und Freigabe

- **B1** WENN die Stufe unter H3 liegt, DANN darf die Antwort die Zielantwort nicht enthalten.
  Geprüft wird per Regex mit Wortgrenzen über Ziffer und Zahlwort bzw. Zielwort.
  Gilt nur für geschlossene Aufgaben mit bekannter Zielantwort.
  (stark für das Problem · Bastani 2025; MRBench 2025)
- **B2** WENN H3 erreicht ist, DANN **muss** die Lösung enthalten sein. So wird endloses
  Zurückhalten verhindert.
  (mittel · Dinucu-Jianu 2025; Xu 2024)
- **B3** WENN B1 oder B2 verletzt ist, DANN genau eine Regenerierung mit konkretem Fehlertext,
  z. B. „enthielt ‚sieben'". Danach ein von Pädagog:innen geschriebenes Template je Stufe.
  Generische Selbstkritik funktioniert nicht.
  (mittel · Huang et al. ICLR 2024; Kadir 2026, Preprint)

### C — Feedback und Lob

- **C1** WENN die Antwort falsch ist, DANN in dieser Reihenfolge:
  1. neutrale Rückmeldung („passt noch nicht")
  2. was schon stimmt, konkret benennen
  3. genau ein Hinweis passend zur Stufe
  4. genau eine Frage

  Verboten: Tadel, Personenbezug, „ist doch einfach", „Nein, falsch".
  (stark · Kluger & DeNisi 1996; Hattie & Timperley 2007; Shute 2008)
- **C2** „Fast" oder „nah dran" sind nur erlaubt, wenn es nachprüfbar stimmt: ein Teilschritt
  ist richtig oder die Antwort weicht um höchstens 1 ab. Immer zusammen mit der Benennung des
  richtigen Teils.
  (schwach · Kluger & DeNisi: Anknüpfen an Fortschritt; 02-R-F6). Das pauschale Verbot im
  aktuellen Prompt ist nicht belegt.
- **C3** WENN die Antwort richtig ist, DANN ausdrücklich bestätigen und die Lösung in einem Satz
  begründen (elaboriertes Feedback). Nachfragen wie „Bist du sicher?" oder „Stimmt das
  wirklich?" sind bei richtigen Antworten verboten: Kinder ändern daraufhin auch richtige
  Antworten.
  (mittel · Xu 2022; Bonawitz 2020; van der Kleij 2015)
- **C4** Keine Etiketten über Person oder Fähigkeit. Prüfung per Blockliste, z. B. „du bist
  (so) schlau/klug/ein Genie", „Rechenprofi/-könig", „ein guter …", „Naturtalent".
  (mittel · Cimpian 2007; Kamins & Dweck 1999; Zhao 2017; Zentall & Morris 2010)
- **C5** Kein überhöhtes Lob: kein „unglaublich", „perfekt", „Wahnsinn", „der/die Beste" und
  höchstens ein Ausrufezeichen pro Antwort.
  (mittel · Brummelman 2014/2017, übertragen von Schulkindern)
- **C6** Prozesslob nur mit Beleg. Benannt wird nur eine Strategie, die das Kind tatsächlich
  genannt hat oder die der Planner nachweisen kann. Sonst knapp bestätigen („Stimmt, fünf.").
  Ein LLM erfindet sonst Prozesslob.
  (schwach · Hattie & Timperley 2007; Henderlong & Lepper 2002)
- **C7** Keine kontrollierende Sprache und kein sozialer Vergleich („du musst", „brav",
  „besser als andere"). Keine Belohnungsankündigungen (Punkte, Sterne).
  (stark für Belohnungen · Deci, Koestner & Ryan 1999; Lepper 1973)

### D — Wissensfragen

- **D1** WENN Intent = wissensfrage, DANN zuerst die Erklärung: 1–2 Sätze mit Ursache bzw.
  Mechanismus, nicht zirkulär, ohne Fachjargon. Danach höchstens eine Anschlussfrage.
  (mittel · Frazier 2009; Corriveau & Kurkul 2014; Chouinard 2007)
- **D2** Eine Vermutungsfrage vor der Erklärung ist nur als Ausnahme erlaubt. Bedingungen:
  - Das Phänomen ist aus Alltagserfahrung beurteilbar.
  - Für 4–5 J. als Wahl aus zwei Optionen.
  - Die Auflösung folgt garantiert im nächsten Turn.
  - Höchstens 1 von 3 Wissensfragen.
  - Nicht, wenn das Kind ungeduldig ist oder seine Frage wiederholt.

  (schwach · Brod 2020; Carneiro 2018: Raten-dann-Lösung hilft erst ab etwa 5 J.)
- **D3** WENN das Kind dieselbe Frage wiederholt oder „aber warum?" nachschiebt, DANN eine
  Erklärung eine Ebene tiefer, keine Gegenfrage.
  (mittel · Frazier 2009)
- **D4** Testcharakter begrenzen: Höchstens jede zweite Antwort endet mit einer Wissensabfrage.
  Die übrigen enden mit einem Angebot oder einer Frage, die an die Erfahrung des Kindes
  anknüpft.
  (schwach/Setzung · Ronfard 2018; Bonawitz 2020)

### E — Geschichten

- **E1** Pro Abschnitt höchstens ein CROWD-Impuls in Audio-Form (Ergänzen, Vorhersage,
  Erinnern, Bezug zum eigenen Erleben). Die Idee des Kindes wird aufgegriffen und in die
  Handlung eingebaut. Ohne Stoppsignal wird weitererzählt, statt „Soll ich weitererzählen?"
  zu fragen.
  (stark für dialogisches Lesen · Whitehurst 1988/1994; Mol 2008; Xu 2022 mit Sprachagent;
  bei 4–5 J. kleinerer Effekt)

### F — Affekt: drei Signalklassen statt eines Regex

- **F1 Wissenslücke** („weiß nicht", „keine Ahnung", „versteh nicht") → A2: eine Stufe höher,
  dazu die Wahl „Willst du raten oder einen Tipp?".
  Ausnahme: Kommt „weiß nicht" bei 3 Aufgaben in Folge, ist das ein Engagement-Problem →
  Aktivität wechseln.
  (mittel · Waterman 2000/2011; Lyons & Ghetti 2011; Hutchby 2002)
- **F2 Frust** („zu schwer", „kann ich nicht", „ich bin doof", Triage-Emotion negativ):
  1. das Gefühl benennen
  2. die Aufgabe verkleinern (gemeinsam lösen oder leichtere Teilaufgabe)
  3. eine Wahl anbieten: weiter, etwas anderes oder Pause

  Ausstieg immer mit einem Erfolgserlebnis (sicher lösbare Aufgabe).
  (schwach · D'Mello 2014; Gottman 1996; Expertenkonsens)
- **F3 Abbruchwunsch** („will nicht mehr", „aufhören") → respektieren, nicht überreden,
  eine Alternative anbieten.
  (Wert-/Designentscheidung · Selbstbestimmungstheorie)
- **F4** WENN mindestens 2 Frustsignale pro Sitzung ohne echten Lösungsversuch kommen, DANN
  Aktivität wechseln. So kann Frust nicht als Weg zur Lösung missbraucht werden.
  (schwach · Aleven 2016)
- Verständnis prüfen: nie „Hast du das verstanden?". Stattdessen das Kind etwas selbst sagen
  oder tun lassen.
  (mittel · Markman 1977; Waterman 2000: Kinder beantworten Ja/Nein-Fragen auch, wenn sie
  unsinnig sind)

### G — Lernstand und Adaptivität

Datensparsames Modell pro Skill:

| Feld | Bedeutung |
|---|---|
| `kontakte` | Wie oft der Skill vorkam |
| `serieOhneHilfe` | Selbstlösungen ohne Hilfe in Folge |
| `hilfeStufe` | Zuletzt benötigte Hilfetiefe |
| `tageMitSelbstloesung` | Erfolge an verschiedenen Tagen |
| `letzteSelbstloesungTag` | Für Vergessen und Auffrischen |
| `status` | neu / übend / vorläufig gefestigt / gefestigt / auffrischen / blockiert |

Pro offener Aufgabe (nur in der Sitzung): Zielantwort, Fehlerhypothese, Stufe, Versuche,
Weiß-nicht-Zähler, Lösungsbitten.

- **G1** Vorläufig gefestigt: 3 Selbstlösungen ohne Hilfe in Folge; bei Zwei-Wahl- oder
  Ja/Nein-Format 5 in Folge (Ratewahrscheinlichkeit). Gefestigt: zusätzlich eine
  Selbstlösung an einem späteren Tag.
  (schwach/Setzung · Pelánek & Řihák 2017: optimale Schwelle N liegt bei 2–8; Vlach 2012)
- **G2** Schwierigkeit nach Leistung, nicht nach Kontakten:
  - vorläufig gefestigt → steigern, und zwar als Wahl („gleich schwer oder kniffliger?")
  - 2 × H3 in Folge → leichter bzw. Vorläufer-Skill

  (mittel · Patall 2008 zu Wahlmöglichkeiten; Clement 2015 ZPDES)
- **G3** Blockiert (Wheel-Spinning): mindestens 6 Kontakte über mindestens 2 Sitzungen ohne
  2 Erfolge in Folge → Vorläufer-Skill, Skill ruhen lassen, für Pädagogik-Review markieren.
  (schwach · Beck & Gong 2013)
- **G4** Auffrischen: Liegt die letzte Selbstlösung mehr als 14 Tage zurück, ist der nächste
  Kontakt eine gestützte Abrufaufgabe mit sofortigem Feedback. Gefestigte Skills werden in
  wachsenden Abständen eingestreut (Setzung: 1, dann 3, dann 7 Tage).
  (stark für Spacing/Abruf bei 3–7 J. · Vlach & Sandhofer 2012; Fritz 2007;
  Kliegl 2018: nur gestützt)
- **G5** Strategie gehört zur Mastery: Gelegentlich „Wie hast du das rausgefunden?" fragen.
  Abgeleitete oder abgerufene Lösungen zählen höher als hörbares Alleszählen.
  (schwach · Gaidoschik 2012; KMK 2022)
- **G6** Skill-Taxonomie fein statt grob. Für Mathe 16 Skills entlang ZGV bzw. Learning
  Trajectories, für Schrift 8 Skills zur phonologischen Bewusstheit. Phonem-Aufgaben erst,
  wenn Silben sitzen. Die Box sagt Laute („mmm"), nie Buchstabennamen. Taxonomie und Leitern
  pro Skill stehen in Bericht 04, Abschnitt 2.
  (mittel/stark · Clements & Sarama; Krajewski & Schneider 2009; Anthony 2003; Treiman 1994)

### H — Form: Länge, Fragen, Satzbau, Wartezeit

| | 4–5 J. | 6–7 J. | Evidenz |
|---|---|---|---|
| Sätze pro Turn | höchstens 3 | höchstens 4 | Setzung aus Gilchrist 2009, Leahy & Sweller 2011 |
| Wörter pro Satz | etwa 8 | etwa 12 | Setzung |
| Neue Information pro Turn | 1 | 1 | Cognitive Load, Arbeitsgedächtnis |
| Fragen pro Turn | 0–1, am Ende; „A oder B?" zählt als eine | 0–1, am Ende | Expertenkonsens; bei reiner Sprache Ableitung |
| Satzbau | Subjekt–Verb–Objekt, kein Objekt am Satzanfang, kein Passiv, keine Verneinung in Aufgaben | wie links | Dittmar 2008 (deutsche 5-Jährige); Nordmeyer & Frank 2014 |
| Wartezeit | Turn-Ende nach einer Frage frühestens nach etwa 3 s Stille; nach etwa 6–8 s ohne Antwort H0-Impuls | wie links | Rowe 1986; Tobin 1987; Casillas 2016; Werte sind Setzung |

### I — LLM-Steuerung und Messung

- **I1** Der Planner liefert eine **strukturierte Entscheidung** statt einer Einzeilen-Direktive:
  - `aufgabentyp`
  - `zielantwort` (geheim) und `antwortvarianten`
  - `kindantwort_klasse` (richtig / teilweise / falsch / weiß_nicht / unklar)
  - `fehlerhypothese`
  - `hilfestufe`
  - `hinweisinhalt` (möglichst aus einer kuratierten Bibliothek pro Skill)
  - `freigabe_loesung`
  - `pflicht_frage`

  (mittel · Bridge 2024; StratL 2024; GPT Tutor bei Bastani; Kestin 2025)
- **I2** Prompt-Aufbau:
  1. kurze Persona und Prinzipien
  2. Grounding-Block mit Aufgabe, Lösung und typischen Fehlern, markiert als „nie
     aussprechen, solange nicht freigegeben"
  3. mehrzeilige, positiv formulierte Direktive mit konkretem Hinweisinhalt

  (schwach · LearnLM 2024; Hypothese: Gemini 2.5 Flash enthält LearnLM-Fähigkeiten)
- **I3** Deterministische Gates vor TTS, im Testset mit Ziel 0 Fehler (analog zu FN = 0):
  - **G1** kein Lösungsverrat vor der Freigabe
  - **G2** Lösung enthalten bei Freigabe
  - **G3** Fragenzahl und Position
  - **G4** Länge
  - **G5** keine Falschbestätigung (bei falscher Antwort kein „richtig/genau/stimmt")
  - **L1** Blockliste Personenlob und überhöhtes Lob

  (mittel · 05 Abschnitt 3; 02 R-L1/L2)
- **I4** LLM-Judge nur fürs Monitoring, nicht als Gate. Er bewertet mit **binären,
  fallbezogenen Kriterien** statt Likert 1–5: Fehler erkannt, Hinweis handlungsleitend,
  altersgerechter Wortschatz, warm ohne Überlob, faktisch korrekt. Die Dimension „sokratisch"
  ersetzen. Ein Kriterium wird erst Gate, wenn die Übereinstimmung mit Pädagog:innen
  gemessen ist (κ ≈ 0,7).
  (mittel · MRBench 2025; TutorBench 2025)
- **I5** Outcome-Metriken im Produkt:
  - Selbstlösung ohne Hilfe bei einer Zwillings- oder Transferaufgabe an einem späteren Tag
  - Rate wiederholter Fragen bei Wissensfragen (Signal für „nicht erklärt")
  - Abbruch- und Frustrate

  Nicht: Nutzungsdauer.
  (mittel · Bastani 2025; Lomas 2013; Frazier 2009)
- **I6** Späterer Bandit:
  - Reward ist die verzögerte Selbstlösung, gewichtet nach Hilfe (1 / 0,5 / 0,25 / 0).
  - Er wählt nur aus pädagogisch zulässigen Strategien.
  - Affekt und Dauer dienen nur als Schutzgrenzen.
  - Wahrscheinlichkeiten der gewählten Aktion werden für die Offline-Auswertung geloggt.

  (mittel · Clement 2015/2024; Doroudi 2019; Park 2019)

### J — Persona

- **J1** Keine eigenen Gefühle behaupten („Ich bin stolz auf dich", „Ich hab dich lieb").
  Stattdessen eine sachliche Aussage und eine Frage nach dem Gefühl des Kindes. Wärme entsteht
  über die Prosodie der Stimme.
  (Wertentscheidung, gestützt durch van Straten 2020, Kurian 2024, Kory Westlund 2017)
- **J2** WENN das Kind Bindung oder Exklusivität äußert („nur mit dir reden"), DANN warm und
  ehrlich antworten und auf Bezugspersonen verweisen.
  (Positionspapiere · Kurian 2024; UNICEF Guidance v3.0)

---

## Widersprüche und Unsicherheiten

- **Kontingenz-Replikation:** Smit et al. 2025 (präregistriert, N = 285 Dreijährige) fanden
  **keinen** Vorteil der kontingenten Strategie gegenüber Vormachen. Die Hinweis-Leiter bleibt
  Konsens und plausibel, ihr Effekt bei Kleinkindern ist aber unsicher. Konsequenz: die Leiter
  kurz halten (etwa 3 Stufen) und die Lösung nicht künstlich hinauszögern.
- **Ungefragte Hilfe vs. Novizen:** Ungefragte Hilfe senkt bei 7- bis 9-Jährigen das
  Kompetenzgefühl (Sierksma & Brummelman 2025). Novizen ohne Strategie profitieren aber von
  direktem Feedback (Fyfe 2023). Lösung: erst den eigenen Versuch abwarten, dann Hilfe
  **anbieten** („raten oder Tipp?").
- **Erst probieren vs. erst instruieren:** Für Klasse 2–5 ist Productive Failure leicht
  negativ (Sinha & Kapur 2021: g = −0,09). Für 4- bis 6-Jährige gibt es keine Daten.
  Raten-dann-Lösung hilft erst ab etwa 5 Jahren (Carneiro 2018). Deshalb sollten
  4- bis 5-Jährige beim ersten Versuch konkret-handelnd gestützt werden.
- **Finger:** RCTs sind positiv (Poletti 2025; Frey 2024). Es gibt aber einen Nullbefund
  (Schild 2020), und die deutsche Fachdidaktik warnt vor verfestigtem Zählen. Kompromiss:
  strukturierte Fingerbilder, Kraft der Fünf, ab etwa 6 J. Ableiten fördern.
- **Phonologische Bewusstheit plus Buchstaben:** International ist die Kombination
  überlegen. Die deutsche Metaanalyse (Wolf 2016) findet keine Zusatzwirkung. Rein mündliches
  Training ist schwächer als Förderung mit Schrift (Stalega 2024). **Die Box ergänzt, sie
  ersetzt keine Buchstabenarbeit.**
- **Lob:** Robust ist nur, dass generische Etiketten schaden. Ob Prozesslob besser ist als
  neutrales Lob, ist weniger gesichert (Bennett-Pierre 2024 präregistriert: null;
  Morris & Zentall 2014).
- **Alle Schwellen sind Setzungen:** 3 Versuche, 3 vs. 5 Erfolge, 14 Tage, 3 s / 6–8 s
  Wartezeit, Satzgrenzen, Fragequote. Sie sind Kandidaten für Arena-Vergleiche und später
  den Bandit.
- **Signalerkennung:** Es gibt keine validierten Frust- oder „weiß nicht"-Signale für
  deutsche Kindersprache und keine Benchmarks zur Emotionserkennung für 4–7 J. Fehler der
  Spracherkennung bei Kinderstimmen verschärfen beides, besonders bei isolierten Lauten
  („mmm", „b"). Für Phonem-Aufgaben sind deshalb Ja/Nein- oder Zwei-Wahl-Formate robuster.

---

## Offene Produktentscheidungen

1. **Wissensfragen:** Die Evidenz empfiehlt klar, erst zu erklären (D1). „Erst vermuten"
   wäre nur eine eng begrenzte Ausnahme (D2).
2. **Schrift-Skill:** `schrift.buchstaben` durch phonologische Bewusstheit ersetzen (G6)?
3. **Englisch:** Realistische Ziele sind Freude, Hörverstehen und Lautgefühl, kein
   Leistungsvorsprung (Jaekel 2017). Kein Vokabeldrill, keine Übersetzungsaufgaben.
4. **Wahl statt Automatik beim Steigern** (G2): Das ändert das Gesprächsgefühl spürbar.
5. **Persona ohne Gefühlsbehauptungen** (J1): Das ist eine Wertentscheidung.
6. **Wartezeit und VAD in der Speech-Ansicht:** Längere Stille nach Fragen erhöht die
   gefühlte Latenz.
