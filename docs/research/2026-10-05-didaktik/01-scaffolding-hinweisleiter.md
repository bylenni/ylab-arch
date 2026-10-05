# Recherchebericht: Scaffolding, Hinweis-Leiter und Fehlerumgang bei 4- bis 7-Jährigen

**Zur Prüfung der Quellen:** Alle DOIs habe ich über Crossref, PubMed oder OpenAlex geprüft. Hinter jeder Quelle steht, was ich gelesen habe: **VT** = Volltext, **A** = nur Abstract. **[unverifiziert]** heißt: Der Inhalt stammt nur aus Sekundärwissen.

**Abkürzungen für die Evidenzart:**
- **MA** = Metaanalyse
- **RCT** = randomisiertes kontrolliertes Experiment
- **Exp** = Experiment
- **Korr** = korrelative Studie
- **Rev** = Review oder Theorie
- **Qual** = qualitative Studie

Weil das Kontingent an Websuchen ausgeschöpft war, habe ich die letzten Belege nur noch über Datenbank-APIs und PDFs geprüft. Ich habe keine Dateien im Repo geändert.

---

## 1. Kernbefunde

### A. Kontingenz („contingent shift")

**K1 – Die Grundregel: Bei Misserfolg mehr Hilfe, bei Erfolg weniger.**
- Wood & Middleton 1975, 12 Mutter-Kind-Paare ([10.1111/j.2044-8295.1975.tb01454.x](https://doi.org/10.1111/j.2044-8295.1975.tb01454.x), A, Korr): Mütter, die ihre Anleitung an der vorigen Reaktion des Kindes ausrichteten, hatten Kinder, die danach erfolgreicher waren.
- Wood, Wood & Middleton 1978 ([10.1177/016502547800100203](https://doi.org/10.1177/016502547800100203), A, Exp): 3- bis 4-Jährige, N = 32. Die kontingente Strategie war besser als Vormachen, rein verbale Hilfe und „swing" (Wechsel zwischen sehr wenig und sehr viel Hilfe).
- Die fünf Stufen von 1978 (laut Smit et al., VT):
  1. allgemeine Ermunterung
  2. spezifische verbale Information
  3. Material zeigen oder auswählen
  4. Material vorbereiten
  5. vormachen
- **Nur die Stufen 1 und 2 sind rein sprachlich.** Für eine Box ohne Bildschirm lässt sich die Hierarchie deshalb nur teilweise übernehmen.
- Wood & Wood 1999 operationalisieren die Regel ([10.1016/S0360-1315(99)00030-5](https://doi.org/10.1016/S0360-1315(99)00030-5), VT, Rev/Korr, 14- bis 15-Jährige):
  - Nach „etwa drei Hinweisen zunehmender Explizitheit" kommt die Lösung oder das Vormachen.
  - Bei Erfolg wird die Hilfe zurückgenommen.
  - Wer viel Hilfe brauchte, bekommt bei der nächsten Aufgabe etwas Hilfe, ohne darum zu bitten.
  - Schwächere Lernende holen sich zu selten Hilfe.

**K2 – Wichtigster Gegenbefund: Die Replikation findet keinen Vorteil.**
- Smit, de Kleijn, Wicherts & van de Pol 2025 ([10.1037/edu0000965](https://doi.org/10.1037/edu0000965), VT): präregistrierte direkte Replikation, RCT, N = 285 Dreijährige.
- Kontingente Instruktion war **nicht** besser als Vormachen, rein verbale Hilfe oder „swing".
- Die Autor:innen folgern:
  - Hilfestufen lassen sich nicht sauber hierarchisch ordnen.
  - Dieselbe Stufe zu wiederholen sowie Schweigen und Warten gehören zum Repertoire.
  - Kinder wollen die Aufgabe fertig bekommen und holen sich so viel Hilfe wie möglich.
- **Folge für uns:** Kontingenz bleibt plausibel, aber die Größe ihres Effekts ist unklar.

**K3 – Reviews und Metaanalysen.**
- van de Pol, Volman & Beishuizen 2010 ([10.1007/s10648-010-9127-6](https://doi.org/10.1007/s10648-010-9127-6), A, Rev): Scaffolding besteht aus Kontingenz, schrittweisem Abbau der Hilfe (Fading) und Übergabe der Verantwortung an den Lernenden.
- van de Pol et al. 2015 ([10.1007/s11251-015-9351-z](https://doi.org/10.1007/s11251-015-9351-z), A, Korr, ältere Schüler:innen): Hoch kontingente Hilfe war nur bei viel selbstständiger Arbeitszeit besser. Bei häufigem Eingreifen war wenig kontingente Hilfe sogar besser.
- Belland et al. 2017 ([10.3102/0034654316670999](https://doi.org/10.3102/0034654316670999), A, MA): Computerbasiertes Scaffolding wirkt mit g = 0,46, in allen Altersgruppen positiv, am stärksten bei Erwachsenen.

### B. Gestufte Hilfen (Hinweis-Leiter)

**K4 – Graduated Prompts aus der dynamischen Diagnostik (Campione & Brown; Resing).**
- Touw et al. 2020 ([10.1111/bjep.12272](https://doi.org/10.1111/bjep.12272), VT, Exp mit Kontrollgruppe, N = 164, Durchschnittsalter 7;11 Jahre). Das Protokoll:
  1. zwei metakognitive Prompts („Schau dir die Reihe nochmal an. Was musst du tun?" und „Was ändert sich, was bleibt gleich?")
  2. zwei kognitive Prompts (relevante Merkmale benennen, dann nur die fehlerhaften Teile markieren)
  3. danach die Lösung
  4. nach jeder richtigen Antwort: „Warum?"
- Trainierte Kinder machten mehr Fortschritt als Kinder, die ohne Anleitung übten.
- Resing et al. 2019 ([10.1111/jcal.12358](https://doi.org/10.1111/jcal.12358), A): Auch mit einem Roboter als Tutor wirksam (6 bis 9 Jahre).

**K5 – Hinweis-Hierarchien in Tutorsystemen (ITS).**
- Aleven et al. 2016 ([10.1007/s40593-015-0089-1](https://doi.org/10.1007/s40593-015-0089-1), VT, Korr/Rev, Oberstufe):
  - Die Leiter endet mit einem „bottom-out hint", also der Lösung.
  - Schüler:innen klickten 68 % der Hinweisstufen in unter einer Sekunde weg, um an die Lösung zu kommen.
  - Nach drei Fehlern fragten sie nur in 34 % der Fälle nach Hilfe.
  - Hinweise wirken vor allem bei mittlerem Kompetenzniveau.
  - Die Lösung als letzte Stufe ist nötig und hilft, wenn das Kind sie sich selbst erklärt.
- Shute 2008 ([10.3102/0034654307313795](https://doi.org/10.3102/0034654307313795), VT, Rev):
  - Hilfen schrittweise, spezifisch und knapp geben.
  - Feedback erst nach einem eigenen Lösungsversuch.
  - Keine Hinweis-Leiter, die ohne Schutz vor Missbrauch immer in der Lösung endet.
  - Aufwendige Fehlerdiagnose möglichst vermeiden.
- Koedinger & Aleven 2007 ([10.1007/s10648-007-9049-0](https://doi.org/10.1007/s10648-007-9049-0), A): Das „Assistance Dilemma" (wann Hilfe geben, wann zurückhalten) ist ausdrücklich ungelöst.
- AutoTutor (Graesser et al. 2004, [10.3758/BF03195563](https://doi.org/10.3758/BF03195563), A) nutzt vier Gesprächszüge, ca. 0,7σ Lerngewinn bei Studierenden:
  - Pump („Und weiter?")
  - Hinweis
  - Prompt (Lückensatz)
  - Assertion (Inhalt selbst nennen)

**K6 – Speziell zu LLMs.**
- Bastani et al. 2025, PNAS ([10.1073/pnas.2422633122](https://doi.org/10.1073/pnas.2422633122), Feld-RCT, High School):
  - GPT-4 ohne Leitplanken: +48 % beim Üben, aber −17 % in der späteren Prüfung ohne KI.
  - Eine Tutor-Version mit Hinweisen von Lehrkräften statt Lösungen dämpfte diesen Schaden weitgehend.
- MathDial ([10.18653/v1/2023.findings-emnlp.372](https://doi.org/10.18653/v1/2023.findings-emnlp.372), A): LLMs verraten Lösungen zu früh.
- LearnLM (arXiv 2412.16429): Generative KI ist standardmäßig darauf getrimmt, Information zu präsentieren.
- **Euer beobachtetes Problem ist also ein bekanntes Modellverhalten.** Es muss deterministisch abgefangen werden, ein Prompt allein reicht nicht.

### C. Wann ist die Lösung besser als weiteres Fragen?

**K7 – Entdecken mit und ohne Begleitung.** Alfieri et al. 2011 ([10.1037/a0021017](https://doi.org/10.1037/a0021017), VT, MA):

| Vergleich | Effekt (d) |
|---|---|
| Entdecken ohne Begleitung vs. explizite Instruktion | −0,38 |
| Angereichertes Entdecken gesamt | +0,30 |
| – geführtes Entdecken | +0,50 |
| – vom Kind erfragte Erklärungen | +0,36 |
| – Kind die Lösung nur selbst erzeugen lassen | −0,15 |

- Kinder (bis 12 Jahre) profitieren weniger als Erwachsene.
- **Folge:** Eine Gegenfrage ohne Stütze entspricht dem „selbst erzeugen lassen" und ist bei Kindern unwirksam.

**K8 – Productive Failure.**
- Sinha & Kapur 2021 ([10.3102/00346543211019105](https://doi.org/10.3102/00346543211019105), VT, MA): Erst Problemlösen, dann Instruktion wirkt insgesamt mit g = 0,36.
- **Aber für Klasse 2 bis 5: g = −0,09**, hier ist Instruktion zuerst leicht besser. Für 4- bis 6-Jährige gibt es keine Daten.
- Einzelstudien widersprechen sich:
  - DeCaro & Rittle-Johnson 2012 ([10.1016/j.jecp.2012.06.009](https://doi.org/10.1016/j.jecp.2012.06.009), A, Klasse 2–4): Erst erkunden, dann Instruktion war besser.
  - Fyfe et al. 2014 ([10.1111/bjep.12035](https://doi.org/10.1111/bjep.12035), A, Klasse 2–3): Erst Instruktion war besser.

**K9 – Vorwissen entscheidet.**
- Fyfe & Rittle-Johnson 2016 ([10.1037/edu0000053](https://doi.org/10.1037/edu0000053), A, RCT, Grundschule): Feedback hilft Kindern ohne Strategiewissen und schadet Kindern, die schon eine Strategie kennen.
- Expertise-Reversal-Effekt (Kalyuga et al. 2003, [10.1207/s15326985ep3801_4](https://doi.org/10.1207/s15326985ep3801_4)): Was Anfängern hilft, kann Fortgeschrittenen schaden.
- Lösungsbeispiele schrittweise ausblenden (Renkl & Atkinson 2003, [10.1207/s15326985ep3801_3](https://doi.org/10.1207/s15326985ep3801_3)).
- Beide Rev, von älteren Lernenden übertragen.

**K10 – Selbsterklären.**
- Siegler 1995 ([10.1006/cogp.1995.1006](https://doi.org/10.1006/cogp.1995.1006), A, Exp, **5-Jährige**): Feedback plus „Erklär mal, warum ich das gesagt habe" brachte deutlich mehr als nur Feedback.
- Rittle-Johnson & Loehr 2017 ([10.3758/s13423-016-1079-5](https://doi.org/10.3758/s13423-016-1079-5), A): Die eigene Lösung zu erklären, kann das Lernen unter Umständen mindern.

### D. Fehler und Rückmeldung

**K11 – Effekte von Feedback.**
- Kluger & DeNisi 1996 ([10.1037/0033-2909.119.2.254](https://doi.org/10.1037/0033-2909.119.2.254), MA): d = 0,41, aber über ein Drittel der Feedback-Interventionen verschlechterte die Leistung. Je mehr das Feedback auf die Person zielt, desto schwächer.
- Hattie & Timperley 2007 ([10.3102/003465430298487](https://doi.org/10.3102/003465430298487), VT): Hinweise („cues") 1,10, Lob 0,14.
- van der Kleij et al. 2015 ([10.3102/0034654314564881](https://doi.org/10.3102/0034654314564881), A, MA), computerbasiertes Feedback:
  - elaboriertes Feedback (mit Erklärung): 0,49
  - richtige Lösung nennen: 0,32
  - nur „richtig/falsch": 0,05
  - In Primar- und Sekundarschule kleinere Effekte.

**K12 – Aus Fehlern lernen.**
- Metcalfe 2017 ([10.1146/annurev-psych-010416-044022](https://doi.org/10.1146/annurev-psych-010416-044022), A, Rev, vor allem Erwachsene): Fehler mit anschließendem korrigierendem Feedback fördern das Lernen. Die Begründung gehört dazu.
- Attali 2015 ([10.1016/j.compedu.2015.08.011](https://doi.org/10.1016/j.compedu.2015.08.011)): Mehrere Versuche mit Hinweis wirkten besser als mehrere Versuche mit Lösung. [Stichprobe unverifiziert, vermutlich Erwachsene]

**K13 – Wie man lobt und kritisiert.**
- Kamins & Dweck 1999 ([10.1037/0012-1649.35.3.835](https://doi.org/10.1037/0012-1649.35.3.835), A, Exp, **5–6 Jahre**): Lob oder Kritik an der Person („Du bist …") führte zu mehr hilflosen Reaktionen als Lob oder Kritik am Vorgehen.
- Cimpian et al. 2007 ([10.1111/j.1467-9280.2007.01896.x](https://doi.org/10.1111/j.1467-9280.2007.01896.x), VT, Exp, **4-Jährige**, N = 24): Schon „Du bist ein guter Maler" statt „Du hast gut gemalt" führte nach Fehlern zu signifikant mehr Hilflosigkeit.

**K14 – Zählfehler.**
- Frye et al. 1989 ([10.2307/1130790](https://doi.org/10.2307/1130790), A, **4-Jährige**): Kinder erkennen Verstöße gegen die Eins-zu-eins-Zuordnung und gegen die feste Zahlwortfolge nur begrenzt. Ihre Mengenangabe ist oft einfach das letzte Zählwort.
- Gelman & Meck 1983 ([10.1016/0010-0277(83)90014-8](https://doi.org/10.1016/0010-0277(83)90014-8)) berichten eine bessere Fehlererkennung. [Inhalt unverifiziert] Das ist ein Widerspruch zu Frye et al.

### E. „Weiß nicht", Frust und Wartezeit

**K15 – Was hinter „Weiß nicht" steckt.**
- Schon 3- bis 5-Jährige können Unsicherheit wahrnehmen:
  - Sie unterscheiden sichere von unsicheren Antworten (Lyons & Ghetti 2011, [10.1111/j.1467-8624.2011.01649.x](https://doi.org/10.1111/j.1467-8624.2011.01649.x)).
  - Wo sie unsicher sind, suchen sie häufiger Hilfe (Coughlin et al. 2015, [10.1111/desc.12271](https://doi.org/10.1111/desc.12271)).
  - Beides Exp, A.
- Fragetyp, 5- bis 9-Jährige (Waterman et al. 2000, [10.1348/026151000165652](https://doi.org/10.1348/026151000165652); 2001, [10.1002/acp.741](https://doi.org/10.1002/acp.741); 2004, [10.1348/0261510041552710](https://doi.org/10.1348/0261510041552710)):
  - Bei offenen W-Fragen sagen sie ehrlich „weiß nicht".
  - Bei Ja/Nein-Fragen **raten** sie.
- Waterman & Blades 2011 ([10.1037/a0026150](https://doi.org/10.1037/a0026150), 6- und 8-Jährige): Die ausdrückliche Erlaubnis, „weiß ich nicht" zu sagen, erhöht angemessene Weiß-nicht-Antworten, ohne dass die richtigen Antworten weniger werden.
- Hutchby 2002 ([10.1177/14614456020040020201](https://doi.org/10.1177/14614456020040020201), Qual, 6-Jähriger in der Beratung): „I don't know" dient auch dazu, sich einem Gespräch zu verweigern.
- **Folge:** „Weiß nicht" kann echtes Nicht-Wissen, eine Bitte um Hilfe oder Rückzug bedeuten.

**K16 – Frust.**
- Konfusion, die aufgelöst wird, ist lernförderlich. Anhaltende Konfusion kippt in Frust und Langeweile, und Langeweile schadet mehr als Frust (D'Mello & Graesser 2012, [10.1016/j.learninstruc.2011.10.001](https://doi.org/10.1016/j.learninstruc.2011.10.001); Baker et al. 2010, [10.1016/j.ijhcs.2009.12.003](https://doi.org/10.1016/j.ijhcs.2009.12.003)). [Inhalte nicht im Volltext geprüft; Studierende]
- „Wheel-spinning" (Beck & Gong 2013, [10.1007/978-3-642-39112-5_44](https://doi.org/10.1007/978-3-642-39112-5_44)): Wer einen Skill nicht schnell meistert, meistert ihn oft nie. [Schwelle von ca. 10 Versuchen unverifiziert]
- **Für 4- bis 7-Jährige habe ich keine validierten Frust-Schwellen gefunden.**

**K17 – Wartezeit.**
- Rowe 1986 ([10.1177/002248718603700110](https://doi.org/10.1177/002248718603700110)): Lehrkräfte warten typischerweise unter einer Sekunde auf eine Antwort.
- Tobin 1987 ([10.3102/00346543057001069](https://doi.org/10.3102/00346543057001069), Rev, Grundschule bis Oberstufe): Ab mindestens 3 Sekunden ändert sich der Unterrichtsdiskurs, und höhere kognitive Leistungen nehmen zu.
- Ingram & Elliott 2016 ([10.1080/0305764X.2015.1009365](https://doi.org/10.1080/0305764X.2015.1009365)): Länger ist nicht automatisch besser.
- Casillas et al. 2016 ([10.1017/S0305000915000689](https://doi.org/10.1017/S0305000915000689)): Kinder antworten langsamer als Erwachsene, komplexe Antworten noch langsamer.
- Kennedy et al. 2017 ([10.1145/2909824.3020229](https://doi.org/10.1145/2909824.3020229)): Spracherkennung für Kinderstimmen ist fehleranfällig.
- **Studien zur Wartezeit in Sprachagenten für 4- bis 7-Jährige habe ich nicht gefunden.**

**K18 – Fragen statt Erklären.**
- Yu et al. 2018 ([10.1111/desc.12696](https://doi.org/10.1111/desc.12696), 4–6 Jahre, N = 180): Pädagogisches Fragen durch eine kundige Person vermittelt Wissen **und** fördert eigenes Erkunden.
- Bonawitz et al. 2011 ([10.1016/j.cognition.2010.10.001](https://doi.org/10.1016/j.cognition.2010.10.001)): Direkte Instruktion schränkt das Erkunden ein.
- Xu et al. 2022 ([10.1111/cdev.13708](https://doi.org/10.1111/cdev.13708), RCT, 3–6 Jahre): Ein Sprachagent mit dialogischen Fragen erreicht beim Geschichtsverständnis denselben Gewinn wie ein Mensch.

---

## 2. Regel-Kandidaten für den Teaching Planner

**Hilfestufe h pro Aufgabe** (abgeleitet aus K1, K4, K5; „ca. drei Hinweise, dann Lösung"):
- **h0 – Raum geben:** warten, die Frage kürzer wiederholen, ermutigen. Kein Inhalt.
- **h1 – Aufmerksamkeit lenken:** Teilrichtiges konkret benennen, auf das relevante Merkmal lenken, zweiter Versuch.
- **h2 – Konkrete Strategie oder Teilschritt:** Finger oder Äpfel, Lückensatz, Auswahl zwischen zwei Möglichkeiten.
- **h3 – Lösung (bottom-out):** vormachen, ein Satz Begründung, das Kind sagt den letzten Schritt selbst.

**Die Regeln:**

- **R1 Kontingente Erhöhung:** WENN die Antwort falsch ist ODER das Kind „weiß nicht"/„versteh nicht" sagt ODER zum zweiten Mal schweigt, DANN h = min(h+1, 3). Es wird keine Stufe übersprungen (Ausnahme: R6).
  *Begründung:* K1, K4, K5.

- **R2 Lösungssperre:** WENN h < 3, DANN darf die LLM-Antwort das Zielergebnis nicht enthalten. Ein deterministischer Post-Check sucht das Ergebnis als Ziffer und als Zahlwort (z. B. „5"/„fünf"). Bei einem Treffer wird neu generiert oder ein Template verwendet.
  *Begründung:* K6. Das ist der Hebel für das beobachtete Problem.

- **R3 Lösung als Lösungsbeispiel:** WENN h = 3, DANN:
  1. Lösung nennen
  2. ein Begründungssatz
  3. das Kind vervollständigt („Drei und zwei sind …?")
  4. eine ähnliche Aufgabe mit Start bei h1

  *Begründung:* K1 (Hilfe auch ohne Bitte), K5, K10.

- **R4 Fading:** WENN die Antwort richtig ist, DANN startet die nächste ähnliche Aufgabe bei max(0, h_vorher − 1). Als „Selbstlösung" zählt nur eine Lösung auf h0.
  *Begründung:* K1, K3.

- **R5 Schwierigkeit:** Die reine Zahl der Kontakte löst nichts aus.
  - WENN 3 Selbstlösungen in Folge im Skill, DANN schwieriger.
  - WENN 2 Lösungs-Stufen (h3) in Folge, DANN leichter bzw. zum Vorläufer-Skill.
  - WENN nach 6 Aufgaben im Skill keine Selbstlösung, DANN den Skill pausieren.

  *Begründung:* K1, K16. Die Zahlen sind Startwerte und müssen kalibriert werden.

- **R6 Frust-Ausstieg:** WENN ein starkes Frustsignal vorliegt (Selbstabwertung wie „ich bin doof", „ich will nicht mehr", Weinen oder hohe negative Emotion laut Triage), DANN:
  1. gemeinsam lösen („Wir machen das zusammen")
  2. Lob für das Vorgehen
  3. eine Wahl anbieten: leichtere Aufgabe oder eine Geschichte

  Bloßes „weiß nicht" oder „zu schwer" fällt unter R1.
  *Begründung:* K16. Die Evidenz ist schwach, es handelt sich um Expertenkonsens.

- **R7 „Weiß nicht" unterscheiden:**
  - WENN das Kind bei einer neuen Aufgabe ohne jeden Versuch „weiß nicht" sagt, DANN h1 plus Rateerlaubnis.
  - WENN es bei 3 Aufgaben in Folge „weiß nicht" sagt, DANN Aktivität wechseln. Das ist dann ein Engagement-Problem, kein Wissensproblem.

  *Begründung:* K15.

- **R8 Offene Prüffragen:** WENN Verständnis geprüft wird, DANN eine W-Frage oder eine Handlungsaufforderung, nie „Verstanden?". Auswahlfragen nur als Stütze auf h2.
  *Begründung:* K15.

- **R9 Begrenzte Fehlerdiagnose:** Höchstens 2–3 Fehlermuster, sonst die normale Leiter.
  - WENN bei einer Zählaufgabe die Antwort um eins neben dem Ergebnis liegt, DANN als h1 zum langsamen Zählen mit Zeigen oder Fingern anleiten (Eins-zu-eins-Zuordnung).
  - WENN die Antwort dem Ergebnis der Gegenrechnung entspricht, DANN als h1 fragen: „Kommen welche dazu oder gehen welche weg?"

  *Begründung:* K14, K5 (Shute).

- **R10 Erkennungsfehler sind keine Denkfehler:** WENN die STT-Konfidenz niedrig ist ODER sich keine Antwort extrahieren lässt, DANN einmal nachfragen und **nicht** als Fehlversuch zählen.
  *Begründung:* K17.

- **R11 Wartezeit:**
  - Nach einer Frage bleibt das Antwortfenster mindestens 8 Sekunden offen.
  - Bei Stille: h0.
  - Bei der zweiten Stille: R1.
  - Die Pause, nach der das System den Redebeitrag des Kindes als beendet wertet, großzügig wählen, weil Kinder mitten im Satz Denkpausen machen.

  *Begründung:* K17, K2. Die Werte sind hochgerechnet und müssen per A/B-Test bestimmt werden.

- **R12 Bitte um die Lösung:** WENN das Kind „Sag's mir" sagt und kein Frustsignal vorliegt, DANN eine Stufe höher. Erst bei der zweiten Bitte h3.
  *Begründung:* K2, K5, K15.

- **R13 Sprache der Rückmeldung:**
  - Richtig: Lob für das konkrete Vorgehen, nicht für die Person.
  - Falsch: erst das Richtige konkret benennen, dann zeigen, wo der Fehler liegt. Nie Kritik an der Person, kein „Nein, falsch".

  *Begründung:* K11, K13.

- **R14 Startstufe nach Vorwissen, nicht nach Alter:** WENN Erstkontakt, DANN die Aufgabe stellen und auf h0 bleiben. Bei 4- bis 5-Jährigen die Aufgabe selbst bildhaft einkleiden, aber vorab keinen Hinweis geben. Das Alter dient nur als Rückfallwert.
  *Begründung:* K9, K7.

- **R15 Selbsterklären sparsam:** Nach h3 oder nach einer richtigen Antwort höchstens eine Warum-Frage, und zwar zur **korrekten** Lösung, nicht zur eigenen falschen.
  *Begründung:* K10.

---

## 3. Formulierungsbeispiele (für die Sprachausgabe)

**Aufgabe:** „Du hast drei Äpfel. Mama gibt dir zwei dazu. Wie viele hast du jetzt?"

**Kind schweigt (h0)**
- ✗ „Die Antwort ist fünf."
- ✓ „Lass dir ruhig Zeit. Drei Äpfel, und zwei kommen dazu. Wie viele sind es?"

**Kind: „Vier." (h1)**
- ✗ „Fast richtig! Es sind fünf. Super!"
- ✓ „Die drei Äpfel am Anfang hast du dir gut gemerkt. Jetzt kommen zwei dazu, nicht nur einer. Zähl nochmal ganz langsam."

**Kind: „Vier." (h2)**
- ✓ „Nimm deine Finger. Zeig mir drei. Jetzt klapp noch zwei auf. Zähl alle Finger, einen nach dem anderen."

**Kind: „Weiß nicht." (h3)**
- ✗ „Kein Problem, es sind fünf. Nächste Aufgabe!"
- ✓ „Ich zeig's dir. Drei Finger. Dann noch zwei: vier, fünf. Es sind fünf Äpfel. Sag du mal: Drei und zwei sind …?"

**Kind antwortet richtig**
- ✗ „Wow, du bist ein Mathe-Genie!"
- ✓ „Fünf, genau! Du hast die zwei dazugezählt. Jetzt eine kniffligere."

**Kind sagt sofort „Weiß nicht"**
- ✗ „Kein Problem, es sind fünf!"
- ✓ „Das ist okay. Raten ist erlaubt. Was glaubst du?"

**Frust („Ich bin zu doof.")**
- ✗ „Du bist nicht doof, du bist super schlau!"
- ✓ „Die war echt schwierig. Wir machen sie zusammen: drei, dann vier, fünf. Du hast toll mitgezählt. Willst du eine leichtere oder lieber eine Geschichte?"

**Prüffrage**
- ✗ „Hast du das verstanden?"
- ✓ „Und wenn noch ein Apfel dazukommt, wie viele sind es dann?"

---

## 4. Wo das aktuelle Regelwerk der Evidenz widerspricht

1. **„Falsche Antwort → sofort sanft auflösen"**
   - Das ist faktisch die Strategie „Vormachen". Sie nimmt den zweiten Versuch (K12), die diagnostische Information (K4) und die Eigenständigkeit (K1, K3).
   - Bei LLMs schadet das nachweislich dem Lernen (K6).
   - Fairerweise: Smit et al. (K2) fanden bei Dreijährigen keinen Nachteil des Vormachens, und Kinder mit wenig Vorwissen profitieren von der Lösung (K9).
   - **Konsequenz:** Die Leiter kurz halten, aber nicht direkt zur Lösung springen.

2. **„Frustbremse" per Regex**
   - Sie wirft Unsicherheit, Bitte um Hilfe („weiß nicht", „versteh nicht") und echten Frust in einen Topf (K15).
   - Auch „≥2 Fehlversuche → Lösung" überspringt die Zwischenstufen. Wood & Wood setzen etwa drei Hinweise an.

3. **Regel 2 „≥3 Kontakte → schwieriger"**
   - Kontakt ist nicht Beherrschung. Das widerspricht dem Fading-Prinzip und riskiert Wheel-spinning und Frust (K16).
   - Auch „Selbstlösung" ist bisher nicht als „ohne Hilfe" definiert.

4. **Regel 4, Startstrategie nach Alter**
   - Eine sokratische Gegenfrage ohne Stütze entspricht dem „selbst erzeugen lassen" (d = −0,15, K7).
   - Ein bildhafter Hinweis vor dem ersten Versuch widerspricht „erst versuchen lassen" (Shute) und „mit wenig Kontrolle beginnen" (Wood).
   - Das Vorwissen entscheidet mehr als das Alter (K9).

5. **Unspezifisches „ermutigen/loben"**
   - Ohne Vorgaben neigt das LLM zu Personenlob, das bei 4- bis 6-Jährigen nachweislich schadet (K13).

6. **Was ganz fehlt:**
   - Umgang mit Wartezeit und Schweigen
   - Abgrenzung von Spracherkennungsfehlern gegen echte Fehlversuche
   - Fading über mehrere Aufgaben
   - Selbsterklären nach der Lösung
   - eine deterministische Lösungssperre (R2)

---

## 5. Offene Fragen und Unsicherheiten

- **Die Grundlage ist dünner als gedacht.** Der Kernbefund zur Kontingenz hat sich in einer präregistrierten Replikation nicht bestätigt (K2). Die Graduated-Prompt-Protokolle sind vor allem mit 6- bis 9-Jährigen und für figurales Schließen validiert. Für 4- bis 5-Jährige und reine Sprachhilfe ohne Material gibt es kaum Daten. Die Hilfestufen 3–5 von Wood sind körperlich und fallen bei der Box weg.
- **Optimale Zahl der Stufen:** Ich habe kein RCT gefunden, das 2, 3 und 4 Stufen bei 4- bis 7-Jährigen vergleicht. Drei Stufen plus Lösung ist ein Konsenswert.
- **Instruktion zuerst oder Problemlösen zuerst:** Für Klasse 2 bis 4 ist das widersprüchlich (K8). Für das Vorschulalter fehlen Daten.
- **Frust und „weiß nicht" erkennen:** Für deutschsprachige 4- bis 7-Jährige gibt es keine validierten Signale oder Schwellen. Eine Triage nur aus Text verpasst die Prosodie.
- **Wartezeiten in Sprachagenten für Kinder:** Ich habe keine Studie gefunden. Die Werte in R11 sind Startparameter.
- **„Fast richtig":** Die Wirkung dieser Formulierung ist nicht direkt untersucht. Die Empfehlung, Teilrichtiges zu benennen und den Fehlerort zu zeigen, ist aus Shute und Touw abgeleitet.
- **Für den späteren Contextual Bandit:** Die Belohnung darf **nicht** die sofortige Richtigkeit sein. Sonst lernt der Bandit, Lösungen zu verraten (Bastani: Üben besser, Lernen schlechter). Besser ist der spätere Erfolg ohne Hilfe bei einer ähnlichen Aufgabe.
- **Widerspruch Gelman & Meck vs. Frye:** Ob Vorschulkinder Zählfehler erkennen, ist umstritten. Das betrifft die Frage, ob Aufforderungen wie „Finde den Fehler" schon bei 4-Jährigen funktionieren.
