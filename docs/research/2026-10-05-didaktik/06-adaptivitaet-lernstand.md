# Recherchebericht: Adaptivität, Lernstand-Modell und Schwierigkeitssteuerung bei 4- bis 7-Jährigen

**Die Evidenz ist für unser Alter sehr ungleich verteilt.** Zu Spacing, Abrufübung und Erklär-Prompts gibt es kontrollierte Experimente mit 3- bis 7-Jährigen. Zu Mastery-Schwellen, optimaler Erfolgsquote und Bandits gibt es fast nur Übertragungen von älteren Lernenden. Alle Zahlen unten, die mit **[Setzung]** markiert sind, sind Startwerte, die wir an eigenen Daten kalibrieren müssen. Jede Quelle habe ich per Suche, Abruf, Crossref, OpenAlex oder PubMed geprüft.

---

## 1. Kernbefunde

### A. Lernstand und Mastery

- **A1. Ein einfaches Kriterium genügt, entscheidend ist die Schwelle.**
  - [Pelánek & Řihák 2017](https://doi.org/10.1145/3079628.3079667): Selbst unter idealen Annahmen ist Bayesian Knowledge Tracing (BKT) kaum besser als die Regel „N richtige in Folge".
  - Das optimale N lag je nach Parametern für Raten und Flüchtigkeitsfehler zwischen **2 und 8**.
  - Empfehlung der Autoren: einen exponentiell gleitenden Durchschnitt (EMA) nutzen und die Schwelle über Aufwand-Ertrags-Kurven aus eigenen Daten kalibrieren.
  - [Kelly et al. 2015](http://www.educationaldatamining.org/EDM2015/proceedings/poster630-631.pdf) zeigen, dass „N in Folge" für BKT-Varianten die optimale Policy ist.
  - Evidenz: Simulation und Logdaten. Alter: ältere Lernende, also übertragen.
- **A2. BKT und Vergessen.** [Corbett & Anderson 1995](https://doi.org/10.1007/BF01099821) modellieren Raten und Flüchtigkeitsfehler, im Standardmodell aber **kein Vergessen**. Untersucht wurden erwachsene Programmierlernende.
- **A3. Mastery Learning ist für 4- bis 7-Jährige nicht belegt, und die Befunde widersprechen sich.**
  - [Kulik et al. 1990](https://doi.org/10.3102/00346543060002265): Metaanalyse über 108 Studien, Effekt etwa 0,5 SD, stärker bei schwächeren Lernenden. Untersucht wurden nur College, High School und obere Grundschulklassen.
  - [Slavin 1987](https://doi.org/10.3102/00346543057002175): In Grund- und Sekundarschulen praktisch kein Effekt auf standardisierte Tests. Auf selbst erstellte Tests nur moderate und kaum dauerhafte Effekte.
- **A4. Wheel-Spinning.** [Beck & Gong 2013](https://doi.org/10.1007/978-3-642-39112-5_44): Mastery-Schleifen setzen voraus, dass das Kind den Skill mit der verfügbaren Hilfe meistern *kann*. Ein Teil der Lernenden scheitert trotz vieler Übung (in ASSISTments: mehr als 10 Aufgaben ohne 3 richtige in Folge). Evidenz: Logdaten, ältere Kinder.

### B. Schwierigkeit und Zone der nächsten Entwicklung

- **B1. Die 85-%-Regel ist reine Theorie.** [Wilson et al. 2019](https://doi.org/10.1038/s41467-019-12552-4) leiten eine optimale Fehlerrate von 15,87 % mathematisch her. Das gilt nur für binäre Klassifikation mit Gradientenabstieg und nur für die Lerngeschwindigkeit, nicht fürs Behalten. Die Autoren sagen selbst, dass die optimale Schwierigkeit in der Praxis empirisch bestimmt werden muss. Keine Daten mit Menschen oder Kindern.
- **B2. Etwa 80 % im Klassenzimmer, aber nur korrelativ.** [Rosenshine 2012](https://www.aft.org/sites/default/files/Rosenshine.pdf): In Mathe Klasse 4 erreichten die effektivsten Lehrkräfte 82 % richtige Antworten, die schwächsten 73 %. Daraus folgert er „etwa 80 %" als optimal. Alter 9–10.
- **B3. Leichter heißt engagierter, aber langsamer lernend.** [Lomas et al. 2013](https://doi.org/10.1145/2470654.2470668): Online-Experimente mit 10.000 und 70.000 Spielenden. Je leichter das Spiel, desto länger wurde gespielt. Die engagierendsten Bedingungen brachten das **langsamste Lernen**. Das ist die zentrale Falle für das Reward-Design.
- **B4. Kontingentes Tutoring.**
  - [Wood & Middleton 1975](https://doi.org/10.1111/j.2044-8295.1975.tb01454.x): 12 Mutter-Kind-Paare. Mütter, die ihre Hilfe an die vorige Reaktion des Kindes anpassten, hatten Kinder, die danach selbstständig erfolgreich waren. Das Alter steht nicht im Abstract [unverifiziert: Vorschulalter].
  - [Wood & Wood 1999](https://doi.org/10.1016/S0360-1315(99)00030-5) fassen die Regel zusammen: Bei Schwierigkeiten etwa 3 Hinweise mit steigender Deutlichkeit, dann die Lösung vormachen. Bei Erfolg die Hilfe zurücknehmen. Nach viel Hilfe beim nächsten Item unaufgefordert etwas Hilfe geben.
  - Evidenz: Beobachtung und quasi-experimentell.
- **B5. Entdecken braucht Stütze.**
  - [Alfieri et al. 2011](https://doi.org/10.1037/a0021017), Metaanalyse über 164 Studien: Ungestütztes Entdecken schneidet gegenüber expliziter Instruktion mit **d = −0,38** ab. Gestütztes Entdecken (Feedback, Lösungsbeispiele, Scaffolding, Erklär-Aufforderungen) erreicht **d = +0,30**. Alter gemischt.
  - [Bonawitz et al. 2011](https://doi.org/10.1016/j.cognition.2010.10.001): Direkte Instruktion schränkt die spontane Exploration von Vorschulkindern ein. Das ist der Zielkonflikt bei „Lösung geben".
- **B6. Mittlere Komplexität und Lernfortschritt.** Säuglinge wenden sich von zu einfachen und zu komplexen Reizen ab ([Kidd et al. 2012](https://doi.org/10.1371/journal.pone.0036399)). Sie steuern ihre Aufmerksamkeit nach Lernfortschritt ([Poli et al. 2020](https://doi.org/10.1126/sciadv.abb5053)). Das stützt die Logik „Lernfortschritt als Ziel" konzeptionell, ist aber nicht direkt für 4–7 belegt.
- **B7. Flow.** Für kleine Kinder gibt es nur Beobachtungsstudien ([Custodero 2005](https://doi.org/10.1080/14613800500169431), Musik; Inhalt nicht im Detail geprüft). Ein belastbares Verhältnis von Herausforderung zu Können gibt es für 4–7 nicht. Lomas et al. 2013 widersprechen der Annahme, dass Engagement bei mittlerer Schwierigkeit am höchsten ist.
- **B8. Desirable Difficulties gelten nur teilweise für junge Kinder.**
  - [Carneiro et al. 2018](https://doi.org/10.1016/j.jecp.2017.09.010): Erst raten, dann die Lösung hören, half Kindergarten- und Schulkindern, aber **nicht Vorschulkindern**. Die Autoren schließen: hilfreich für Kinder „älter als 5 Jahre".
  - [Soderstrom & Bjork 2015](https://doi.org/10.1177/1745691615569000), Review: Die Leistung während des Übens ist ein unzuverlässiger Indikator für dauerhaftes Lernen.

### C. Bandits in der Bildung

- **C1. ZPDES** ([Clement et al. 2015](https://jedm.educationaldatamining.org/index.php/JEDM/article/view/JEDM111)):
  - Stichprobe: 400 Kinder im Alter von 7–8 Jahren aus 11 Schulen, je 40 Minuten. Gruppen: Kontrolle, Expertensequenz, ZPDES und eine zweite Algorithmus-Variante (RiARiT).
  - Reward ist der Lernfortschritt: die Erfolgsquote der letzten d/2 Versuche verglichen mit den d/2 davor. Für gemeisterte und für unlösbare Aufgaben ist er daher 0.
  - Die Exploration ist auf eine von Expert:innen definierte Zone begrenzt (Voraussetzungsgraph).
  - Pro Aufgabe gibt es 3 Versuche mit zunehmenden Hinweisen, danach die Lösung.
  - Ergebnis: ZPDES-Kinder erreichten bei den meisten Aufgabentypen höhere Stufen. App gegen Kontrolle war im Prä-Post-Test signifikant. Ein Prä-Post-Vergleich *zwischen* den Algorithmen wird nicht berichtet; Doroudi et al. werten die Studie als „nicht signifikant".
- **C2.** [Clement et al. 2024](https://arxiv.org/abs/2402.01669), Preprint: randomisierte Studie mit 265 Kindern (7–8 Jahre). ZPDES war besser als ein handgestaltetes Curriculum, im Lernen und im Erleben. Wahlmöglichkeiten steigerten die Motivation nur innerhalb von ZPDES; im festen Curriculum senkten sie die Leistung.
- **C3.** [Doroudi et al. 2019](https://doi.org/10.1007/s40593-019-00187-x), Review zu Reinforcement Learning (RL):
  - 21 von 36 Studien fanden die RL-Policy signifikant besser als alle Vergleichs-Policies.
  - Am erfolgreichsten war RL, wenn es **durch Lerntheorie eingeschränkt** wurde.
  - Nur 3 von 15 Klassenzimmer-Studien waren signifikant.
  - 71 % der positiven Studien verglichen nur mit schwachen Baselines.
- **C4. Affekt als Reward.**
  - [Gordon et al. 2016](https://doi.org/10.1609/aaai.v30i1.9914): 34 Vorschulkinder, Reward aus Valenz und Engagement (Mimik). Die Policy steigerte die Valenz; einen Lernvorteil gegenüber der Kontrolle berichten die Autoren nicht.
  - [Park et al. 2019](https://doi.org/10.1609/aaai.v33i01.3301687): 67 Kinder (4–6 Jahre), 3 Monate. Eine Policy, die Engagement *und* Lernfortschritt kombinierte, verbesserte Wortlernen und Syntax.

### D. Wiederholung

- **D1. Spacing wirkt bei 3- bis 7-Jährigen.**
  - [Vlach & Sandhofer 2012](https://doi.org/10.1111/j.1467-8624.2012.01781.x): 36 Kinder (5–7 Jahre). Vier Lektionen an vier Tagen statt an einem Tag; Test nach einer Woche zeigte bessere Generalisierung.
  - [Vlach et al. 2008](https://doi.org/10.1016/j.cognition.2008.07.013): 3-Jährige.
  - [Vlach 2014](https://doi.org/10.1111/cdep.12079): Vergessen zwischen den Episoden fördert die Generalisierung.
  - [Seabrook et al. 2005](https://doi.org/10.1002/acp.1066): Im Klassenzimmer war verteiltes Phonics-Üben besser als geblocktes (Alter laut Sekundärquelle 5 Jahre [Detail unverifiziert]).
- **D2. Abrufübung.**
  - [Adesope et al. 2017](https://doi.org/10.3102/0034654316689306), Metaanalyse: **g = 0,51** gegenüber erneutem Lernen.
  - [Agarwal et al. 2021](https://doi.org/10.1007/s10648-021-09595-9): 50 Klassenzimmer-Experimente, 57 % mit mittleren oder großen Effekten.
  - Vorschulkinder: [Fritz et al. 2007](https://doi.org/10.1080/17470210600823595) – Abruf in wachsenden Abständen verdoppelte das Erinnern, **d = 1,9** gegenüber Elaboration. Eine Belohnung hatte *keinen* Effekt.
  - [Kliegl et al. 2018](https://doi.org/10.3389/fpsyg.2018.01446): Bei Vorschulkindern wirkt Abrufübung **nur mit Hinweis-Abruf** (gestützte Frage) in Übung und Test. Mit sofortigem Feedback ist der Effekt stark vergrößert.
- **D3. Interleaving.**
  - [Brunmair & Richter 2019](https://doi.org/10.1037/bul0000209): g = 0,42 insgesamt, Mathe 0,34. Bei **Wörtern war Blocken besser (g = −0,39)**. Interleaving wirkt vor allem bei ähnlichen, verwechselbaren Kategorien.
  - [Nemeth et al. 2019](https://doi.org/10.3389/fpsyg.2019.00086): 236 deutsche Drittklässler, Interleaving mit Vergleichs-Aufforderungen.
  - Für 4- bis 5-Jährige gibt es kaum Daten.

### E. Kognitive Rahmenbedingungen

- **E1. Arbeitsgedächtnis.**
  - Es wächst von 4 bis 15 Jahren linear ([Gathercole et al. 2004](https://doi.org/10.1037/0012-1649.40.2.177)).
  - 7-Jährige behalten aus Listen gesprochener Sätze etwa **2,5 Sätze**, Erwachsene etwa 3,5 ([Gilchrist et al. 2009](https://doi.org/10.1016/j.jecp.2009.05.006); [Cowan 2016](https://doi.org/10.1177/1745691615621279)). Mit dem Alter wächst die Zahl der Einheiten, nicht ihre Größe.
  - Visuelles Arbeitsgedächtnis: etwa 1,5 Objekte mit 5 Jahren, etwa 2,9 mit 7 Jahren ([Riggs et al. 2006](https://doi.org/10.1016/j.jecp.2006.03.009)).
- **E2. Gesprochene Information ist flüchtig.** [Leahy & Sweller 2011](https://doi.org/10.1002/acp.1787): Lange gesprochene Erklärungen schnitten bei Grundschulkindern schlechter ab als geschriebene. Mit kurzen Audio-Segmenten kehrte sich das um. Bei reiner Sprachausgabe ist alles flüchtig.
- **E3. Satzbau und Negation.**
  - [Dittmar et al. 2008](https://doi.org/10.1111/j.1467-8624.2008.01181.x): Deutsche 5-Jährige erkennen, wer was tut, über die Wortstellung, nicht über den Kasus. Erst 7-Jährige verhalten sich wie Erwachsene. Sätze mit vorangestelltem Objekt sind daher riskant.
  - Negation ist für 2- bis 5-Jährige aufwendig und kontextabhängig ([Nordmeyer & Frank 2014](https://doi.org/10.1016/j.jml.2014.08.002)).
- **E4. KI-Sprachagenten mit Kindern.**
  - [Xu et al. 2024](https://doi.org/10.1037/edu0000889): 275 Kinder (4–7 Jahre). Eine KI-Figur mit Fragen und angepasstem Feedback brachte besseres Lernen als nicht-interaktive und pseudo-interaktive Varianten.
  - Die Antworten der Kinder waren im Mittel **2,6–3 Wörter** lang, die Antwortrate lag bei etwa 80 %.
  - Eine feste Wartezeit von 10 Sekunden führte dazu, dass Kinder sich wiederholten.
  - [Xu et al. 2022](https://doi.org/10.1111/cdev.13708): Dialogisches Vorlesen mit einem Agenten wirkte so gut wie mit einem Menschen (3–6 Jahre).
  - [Rowe 1986](https://doi.org/10.1177/002248718603700110): Mindestens 3 Sekunden Wartezeit verbessern die Antworten (ältere Kinder).

### F. Altersbänder 4–5 und 6–7

- **F1. Der Übergang zwischen 5 und 7 Jahren.** [Sameroff & Haith 1996](https://eric.ed.gov/?id=ED407105) beschreiben ihn grundlegend. [Brod, McAuliffe & Ullman 2026](https://doi.org/10.1093/cdpers/aadag017) sehen als Kernmechanismus die metakognitive Kontrolle: Kinder setzen das Ergebnis ihrer Selbstbeobachtung zunehmend in Handeln um. [Roebers 2017](https://www.sciencedirect.com/science/article/abs/pii/S0273229716300132) zeigt, dass exekutive Funktionen und Metakognition sich parallel entwickeln. Evidenz: Reviews und Theorie.
- **F2. Erklär-Aufforderungen wirken schon mit 4–5 Jahren.**
  - [Rittle-Johnson et al. 2008](https://doi.org/10.1016/j.jecp.2007.10.002): 54 Kinder (4–5 Jahre). Wer *nach* dem Feedback die richtige Lösung erklärte, löste im Nachtest genauer. Wer sie der Mutter erklärte, übertrug am besten.
  - [Legare & Lombrozo 2014](https://doi.org/10.1016/j.jecp.2014.03.001): 3- bis 6-Jährige. Erklären fördert kausales Lernen; bei Jüngeren kann es das Gedächtnis für Nebensächliches schwächen.
- **F3. Dialogisches Vorlesen.** [Mol et al. 2008](https://doi.org/10.1080/10409280701838603): d = 0,59 für den aktiven Wortschatz, deutlich kleiner bei 4- bis 5-Jährigen.

---

## 2. Empfohlenes Lernstand-Modell

Gespeichert wird pro Kind und Skill nur Zähler und Tagesdatum, keine Transkripte.

| Feld | Zweck | Begründung |
|---|---|---|
| `kontakte` | Wie oft der Skill vorkam | – |
| `serieOhneHilfe` | Selbstlösungen ohne Hinweis in Folge; wird bei Fehler oder Hilfe auf 0 gesetzt | A1 |
| `hilfeStufe` (0–4) | Zuletzt benötigte Hilfetiefe, steuert das Zurücknehmen der Hilfe | B4 |
| `fehlversucheInFolge` | Bezogen auf die laufende Aufgabe | B4 |
| `tageMitSelbstlösung` | Erfolge an verschiedenen Tagen | D1, B8 |
| `letzteSelbstlösungTag` | Um Vergessen und Auffrischen abzubilden | A2, D1 |
| `status` | neu / übend / vorläufig gefestigt / gefestigt / auffrischen / blockiert | – |

Nur in der laufenden Sitzung (nicht gespeichert): Frustsignale und die Erfolgsquote der letzten 6 Aufgaben.

**Schwellen [Setzung, innerhalb der Spanne von A1]:**
- **Vorläufig gefestigt:** 3 Selbstlösungen ohne Hinweis in Folge bei offenem Antwortformat. Bei Ja/Nein- oder Zwei-Wahl-Fragen 5 in Folge, weil 0,5³ = 12,5 % Zufallstreffer möglich sind, bei 0,5⁵ nur noch etwa 3 %.
- **Gefestigt:** zusätzlich eine Selbstlösung ohne Hilfe an einem späteren Tag (mindestens 1 Tag Abstand).
- **Auffrischen:** Die letzte Selbstlösung liegt mehr als 14 Tage zurück. Der nächste Kontakt ist dann eine Abrufaufgabe. Bei einem Fehler zurück auf „übend", aber nicht auf „neu".
- **Blockiert (Wheel-Spinning):** mindestens 6 Kontakte über mindestens 2 Sitzungen ohne 2 Erfolge in Folge.
- **Optional später:** ein EMA mit α = 0,6 und Schwelle 0,85, gewichtet nach Hilfe (1 / 0,5 / 0,25 / 0 bei Lösung). Nach der Formel N ≥ log_α(1−T) entspricht das etwa 4 Erfolgen in Folge.

---

## 3. Regel-Kandidaten für den Teaching Planner

- **R1 – Hilfe-Leiter.** WENN ein Fehlversuch passiert, DANN `hilfeStufe` um 1 erhöhen.
  - 6–7 Jahre: offene Frage → Gegenfrage zum Teilaspekt → bildhafter Hinweis → Auswahl aus 2 → Lösung vormachen.
  - 4–5 Jahre: gestützte Frage oder bildhafter Hinweis → Auswahl aus 2 → Lösung vormachen.
  - Begründung: B4, Clement 2015 (3 Versuche, dann Lösung), Kliegl 2018.
- **R2 – Nach der Lösung aktiv werden lassen.** WENN die Lösung gegeben wurde, DANN das Kind nachsprechen oder kurz erklären lassen („Warum passt das?"). Danach eine gleich schwere Variante mit einer Hilfestufe weniger. Begründung: F2, Wood & Wood 1999.
- **R3 – Frust.** WENN ein Frustsignal kommt, DANN die Lösung freundlich vormachen und eine leichtere Folgeaufgabe stellen. WENN mindestens 2 Frustsignale pro Sitzung ohne echten Lösungsversuch kommen, DANN Aktivität wechseln oder Pause anbieten. Begründung: [Aleven et al. 2016](https://doi.org/10.1007/s40593-015-0089-1) – Hilfe nur abzurufen, um an die Lösung zu kommen, ist häufig und lernhemmend.
- **R4 – Hilfe zurücknehmen.** WENN das Kind die Aufgabe ohne Hilfe löst, DANN `hilfeStufe` auf 0 setzen. WENN es mit Hinweis löst, DANN gleiche Schwierigkeit als Variation, mit einer Stufe weniger Hilfe. Begründung: B4.
- **R5 – Schwierigkeit.** WENN der Skill vorläufig gefestigt ist, DANN Schwierigkeit steigern. Zusätzlich innerhalb der Sitzung (Startwerte):
  - Erfolgsquote ohne Hilfe über 90 % bei den letzten 6 Aufgaben → steigern.
  - Unter 60 % → senken.
  - Begründung: B1, B2, C1.
- **R6 – Erstkontakt.**
  - 4–5 Jahre: kurz vormachen, dann eine gestützte Frage mit sofortigem Feedback. Nicht offen raten lassen (B8, D2).
  - 6–7 Jahre: Eine Vermutungsfrage ist erlaubt, aber nur mit sofortigem Feedback (B8, B5).
- **R7 – Verteilt wiederholen.** WENN ein Skill vorläufig gefestigt ist und mindestens einen Tag zurückliegt, DANN in der nächsten Sitzung 1–2 gestützte Abrufaufgaben mit Feedback einstreuen. Abstände wachsend, etwa 1, dann 3, dann 7 Tage [Setzung]. Begründung: D1, D2.
- **R8 – Interleaving.** WENN zwei ähnliche Skills gefestigt sind, DANN gemischt üben mit einer Vergleichsfrage. Wortschatz dagegen geblockt üben. Begründung: D3.
- **R9 – Wheel-Spinning.** WENN der Status „blockiert" ist, DANN zu einem Vorläufer-Skill wechseln, den Skill einige Tage ruhen lassen und für das pädagogische Review markieren. Begründung: A4.
- **R10 – Harte Grenzen pro Turn** [Zahlen sind Setzung, abgeleitet aus E1 und E2]:

| | 4–5 Jahre | 6–7 Jahre |
|---|---|---|
| Sätze | höchstens 3 | höchstens 4 |
| Wörter pro Satz | etwa 8 | etwa 12 |
| Neue Informationen | 1 | 1 |
| Fragen | genau 1, am Ende | genau 1, am Ende |

  - Für alle Altersgruppen gilt: Subjekt-Verb-Objekt-Reihenfolge, kein Objekt am Satzanfang, kein Passiv, höchstens ein nachgestellter Nebensatz. Positiv formulieren, keine Verneinung in der Aufgabe (E3).
  - „A oder B?" zählt als eine Frage.
- **R11 – Wartezeit.** Mindestens 3 Sekunden warten, bevor nachgefragt wird. Nach spätestens etwa 6–8 Sekunden hörbar reagieren [Setzung]. Begründung: E4.
- **R12 – Lerneinheit.** Pro Sitzung höchstens 2 neue Skills mit je 3–6 Aufgaben, plus 1–2 Wiederholungen. Lieber mehrere kurze Sitzungen über die Tage verteilt [Setzung, gestützt auf D1].

---

## 4. Reward-Design für den späteren Contextual Bandit

1. **Primärer Reward ist verzögert:** eine Selbstlösung ohne Hilfe beim nächsten Kontakt an einem späteren Tag. Sie wird der Strategie des letzten Kontakts zugeschrieben (Bandit mit verzögertem Feedback). Die sofortige Selbstlösung ist nur ein Leistungs-Proxy (B3, B8).
2. **Sekundärer Reward:** Lernfortschritt nach Art von ZPDES, oder Erfolg minus erwartete Erfolgswahrscheinlichkeit. Beides macht es unattraktiv, nur leichte Aufgaben einzusammeln (C1).
3. **Erfolge nach Hilfe gewichten:** ohne Hilfe 1, nach einem Hinweis 0,5, nach zwei Hinweisen 0,25, nach Lösung 0. Sonst „kauft" der Bandit Erfolge durch große Hinweise.
4. **Nicht in den Reward:** Nutzungsdauer, Anzahl der Turns, Affekt (B3, C4). Diese Größen nur als Schutzgrenzen überwachen. Auch Abbrüche nicht als negativen Reward nehmen, sonst lernt der Bandit „leicht".
5. **Harte Schranken statt Reward-Tuning:** Der Bandit wählt nur aus pädagogisch zulässigen Strategien (C1, C3). Er hält ein Band der Erfolgsquote ein und eine Frust-Obergrenze. Ob Schranken robuster sind als Reward-Feinjustierung, zeigt bisher nur eine Simulation ([Olukola & Rahimi 2026](https://arxiv.org/abs/2604.04237), Preprint).
6. **Kontext grob einteilen:** Altersband, Skill-Typ, Status, `hilfeStufe`, Frust ja/nein, Tage seit dem letzten Erfolg. Wenig Exploration (ε ≤ 0,1), nur zwischen gleichwertigen Strategien.
7. **Gegen die Regel-Engine messen:** das jetzige Regelwerk als starke Baseline. Wahrscheinlichkeiten der gewählten Aktion loggen, damit wir offline auswerten können (C3).

---

## 5. Was am aktuellen Regelwerk der Evidenz widerspricht

- **a) „≥3 Kontakte → steigern" widerspricht Mastery und Zone der nächsten Entwicklung.** Kontakte ohne Erfolg dürfen nicht zu schwereren Aufgaben führen. Gerade Kinder, die nicht vorankommen, brauchen eine andere Strategie (A3, A4). Diese ODER-Bedingung sollte gestrichen werden.
- **b) „≥2 Fehlversuche → Lösung" springt direkt zur Lösung.** Die Evidenz spricht für eine gestufte Hilfe mit etwa 3 Hinweisen. Und nach der Lösung sollte das Kind aktiv verarbeiten, statt passiv zuzuhören (B4, F2).
- **c) „Frust → Lösung" lässt sich ausnutzen.** Ohne Obergrenze kann ein Kind sich so die Lösungen holen (Aleven 2016).
- **d) „Gefestigt nach 3 Selbstlösungen" ist als Zahl vertretbar, aber unvollständig.**
  - Die 3 müssen in Folge und ohne Hilfe sein.
  - Raten bei Auswahlfragen muss abgefangen werden.
  - Es braucht eine Prüfung an einem späteren Tag.
  - „Gefestigt" darf nicht für immer gelten, weil Kinder vergessen.
- **e) „Schon gesehen → Variation" ignoriert die Zeit.** Liegt der Kontakt in einer früheren Sitzung, sollte zuerst ein Abruf kommen (D2).
- **f) Die Altersregel ist nur teilweise gedeckt.**
  - Erklär-Aufforderungen wirken schon mit 4–5 Jahren, allerdings *nach* dem Feedback (F2).
  - Eine rein sokratische Frage beim Erstkontakt mit 6–7 Jahren ohne Vorwissen ist ungestütztes Entdecken (B5, d = −0,38).
  - Der Unterschied zwischen den Bändern sollte im **Zeitpunkt und Format** liegen, nicht darin, ob überhaupt gefragt wird.
- **g) Die sofortige Selbstlösung als Reward** lädt dazu ein, leichte Aufgaben zu sammeln (B3).
- **h) „2–4 Sätze" ist für 4-Jährige die Obergrenze**, nicht der Normalfall (E1).
- **i) Das Lebensalter allein ist ein schwacher Indikator.** Die Leistung sollte den Strategiewechsel mitsteuern dürfen.

---

## 6. Offene Fragen und Unsicherheiten

- **Erfolgsquote:** Keine direkte Evidenz für eine optimale Erfolgsquote bei 4–7 und reiner Sprachausgabe. 85 % ist Theorie, 80 % stammt aus korrelativen Daten aus Klasse 4.
- **Mastery-Schwelle:** Für Kinder in diesem Alter unbekannt. Wir müssen sie über Aufwand-Ertrags-Kurven aus eigenen Daten kalibrieren (Pelánek & Řihák).
- **Spracherkennung:** Fehler beim Erkennen von Kindersprache erzeugen falsche Fehlversuche und verfälschen so Lernstand und Reward. Vorschlag: Antworten mit niedriger Erkennungssicherheit als „unklar" werten, nicht als Fehler. Dafür habe ich keine Quelle; das ist meine Ableitung.
- **Frust-Erkennung:** Wie zuverlässig unsere Frust-Erkennung ist, ist ungeklärt.
- **ZPDES-Evidenz:** Nur 7–8 Jahre, nur Mathe mit Geld, und ein Algorithmenvergleich im Posttest fehlt.
- **Interleaving:** Für 4- bis 5-Jährige praktisch nicht untersucht.
- **Spacing-Abstände:** Die optimalen Abstände über mehrere Tage sind für Kinder unbekannt.
- **Satzgrenzen:** Die Wort- und Satzgrenzen sind aus Daten zu Kapazität und Flüchtigkeit extrapoliert, nicht direkt getestet.
- **Stichproben:** Vieles stammt aus US-, englischen oder portugiesischen Stichproben. Deutsch-spezifisch sind hier nur Dittmar et al. 2008 (Satzbau) und Nemeth et al. 2019 (Drittklässler).
- **Datenmenge für den Bandit:** Pro Kind gibt es zu wenige Datenpunkte. Ein populationsweiter Contextual Bandit braucht gepoolte Daten; das müssen wir datenschutzrechtlich prüfen.

Recherche-Hinweis: Das Suchkontingent der Sitzung war gegen Ende aufgebraucht. Die restlichen Zitate habe ich gezielt über Crossref, OpenAlex, PubMed und Semantic Scholar geprüft.
