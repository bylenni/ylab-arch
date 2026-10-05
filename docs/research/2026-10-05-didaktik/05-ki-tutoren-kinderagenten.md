# Recherchebericht: LLM-Tutoren und Sprachagenten für Kinder – Lernwirkung, „Answer Leakage", Steuerung, Evaluation

Hinweis zur Methode: Alle unten genannten Quellen habe ich per Suche oder Abruf geprüft. Zahlen stammen aus Abstract oder Volltext; wo ich nur ein Suchsnippet gesehen habe, steht das dabei. Preprints aus 2026 sind nicht begutachtet. Die Suchquote der Sitzung war am Ende aufgebraucht. Danach habe ich nur noch über arXiv, ACL und PubMed-E-Utilities verifiziert.

---

## 1. Kernbefunde

**K1 – Ungeschützter LLM-Zugang schadet dem Lernen. Guardrails beseitigen den Schaden, bringen aber nicht automatisch Lernzuwachs.**
- Quelle: Bastani et al. 2025, PNAS, [doi:10.1073/pnas.2422633122](https://www.pnas.org/doi/10.1073/pnas.2422633122) ([Preprint-Volltext](https://hamsabastani.github.io/education_llm.pdf))
- Evidenz: RCT mit ca. 1.000 Oberstufenschüler:innen in der Türkei, Mathematik. **Altersgültigkeit:** Jugendliche.
- Ergebnisse:
  - In der Übung: +48 % mit GPT Base, +127 % mit GPT Tutor.
  - In der Prüfung ohne KI: GPT Base −17 % (signifikant). GPT Tutor −0,004, also nicht signifikant und ohne positiven Effekt.
  - GPT Base lag nur in 51 % der Fälle richtig.
  - Die Schüler:innen nahmen den Schaden nicht wahr. Die Tutor-Gruppe glaubte sogar, besser abgeschnitten zu haben.
- Aufbau von GPT Tutor: Musterlösung und typische Fehler standen im Prompt, dazu von Lehrkräften entworfene Hinweise und die Anweisung „nicht die ganze Lösung verraten".

**K2 – Wirksame Setups kombinieren korrekte Lösungsgrundlage, Schritt-für-Schritt-Vorgehen, Kürze und Struktur oder Menschen im Prozess.**
- Kestin et al. 2025, Sci Rep, [doi:10.1038/s41598-025-97652-6](https://www.nature.com/articles/s41598-025-97652-6)
  - Crossover-RCT mit 194 Physikstudierenden.
  - Medianer Lerngewinn mehr als doppelt so hoch, in 49 statt 60 Minuten.
  - Im Prompt: vorab geschriebene Lösungen, „one step at a time", kurze Antworten ([Prompt-Details](https://www.kqed.org/mindshift/64694/an-ai-tutor-helped-harvard-students-learn-more-physics-in-less-time)).
- De Simone et al. 2025, Weltbank PRWP 11125, [Link](https://ideas.repec.org/p/wbk/wbrwps/11125.html)
  - RCT an Sekundarschulen in Nigeria, Englisch.
  - +0,31 SD gesamt, +0,23 SD in Englisch.
  - Schüler:innen arbeiteten in Paaren unter Lehreraufsicht.
- Tutor CoPilot (Wang et al. 2024), [arXiv:2410.03017](https://arxiv.org/abs/2410.03017)
  - RCT mit 900 Tutor:innen und 1.800 Schüler:innen (K-12).
  - +4 Prozentpunkte Mastery insgesamt, +9 Prozentpunkte bei schwächeren Tutor:innen.
  - Mehr Leitfragen, seltener die Antwort verraten.
- **Altersgültigkeit:** keine dieser Studien mit Kindern unter ca. 10 Jahren.

**K3 – Bei 3- bis 7-Jährigen wirken kontingente Dialoge mit einem Agenten ähnlich wie mit Erwachsenen. Die untersuchten Agenten waren aber geskriptet bzw. kategorienbasiert, keine freien LLMs.**
- Xu et al. 2022, Child Development, [doi:10.1111/cdev.13708](https://pmc.ncbi.nlm.nih.gov/articles/PMC9299009/)
  - RCT mit 117 Kindern von 3 bis 6 Jahren, dialogisches Vorlesen.
  - +0,51 SD Textverständnis; kein Unterschied zwischen Agent und Mensch.
  - Elaboratives Feedback: Antwort des Kindes aufgreifen und erklären.
  - Mit dem Agenten sprachen die Kinder insgesamt weniger.
- Xu et al. 2021, Computers & Education, [Link](https://www.sciencedirect.com/science/article/abs/pii/S0360131520302578)
  - 90 Kinder von 3 bis 6 Jahren.
  - Gleicher Verständnisgewinn wie mit einem Erwachsenen.
  - Mit Menschen antworteten die Kinder produktiver, lexikalisch vielfältiger und themenbezogener.
- Xu et al. 2024, J. Educ. Psych., [doi:10.1037/edu0000889](https://psycnet.apa.org/fulltext/2025-11376-001.pdf) („Elinor Wonders Why")
  - RCT mit 246 Kindern von 4 bis 7 Jahren.
  - +0,32 SD gegenüber dem nicht-interaktiven Video, +0,16 SD gegenüber der pseudo-interaktiven Variante (gleiche Fragen, generisches Feedback). **Entscheidend ist also kontingentes Feedback, nicht das Fragen allein.**
  - Dialogablauf:
    - richtige Antwort → bestätigen und erklären
    - falsch oder „weiß nicht" → **eine** Folgefrage mit Auswahloptionen oder Kontext-Hinweis
    - Schweigen → Ermutigung („Ich bin neugierig, was du denkst")
    - danach → **erklären und weitergehen**, um Frust zu vermeiden
  - Kinderantworten wurden in vordefinierte Kategorien klassifiziert (κ = .88 gegenüber Mensch).
- Mathemyths (CHI 2024), [arXiv:2402.01927](https://arxiv.org/abs/2402.01927)
  - LLM-gestütztes gemeinsames Geschichtenerzählen mit 35 Kindern von 4 bis 8 Jahren.
  - Lernen von Mathe-Wortschatz vergleichbar mit einem menschlichen Partner. Kleine Laborstudie.

**K4 – Junge Kinder suchen aktiv nach Erklärungen. Vorenthalten führt dazu, dass sie dieselbe Frage erneut stellen.**
- Frazier, Gelman & Wellman 2009, Child Development, [doi:10.1111/j.1467-8624.2009.01356.x](https://doi.org/10.1111/j.1467-8624.2009.01356.x)
  - Kinder von 2 bis 5 Jahren; Beobachtung und Experiment.
  - Nach nicht-erklärenden Antworten fragen sie erneut; nach Erklärungen stimmen sie zu oder stellen Anschlussfragen.
- Chouinard 2007, Monographs SRCD, [doi:10.1111/j.1540-5834.2007.00412.x](https://doi.org/10.1111/j.1540-5834.2007.00412.x): Fragen sind ein zentraler Lernmechanismus.
- **Folge für uns:** Ein pauschales „Lösung nicht verraten" passt nicht zu Wissensfragen.

**K5 – LLMs verraten Lösungen häufig. Prompting allein reicht nicht.**
- MathDial ([ACL Findings 2023](https://aclanthology.org/2023.findings-emnlp.372/)): LLMs neigen dazu, Lösungen zu früh zu verraten.
- MRBench (Maurya et al., [NAACL 2025](https://aclanthology.org/2025.naacl-long.57/); 192 Dialoge, 1.596 Antworten). Anteil der Antworten **ohne** Lösungsverrat:

  | Tutor | ohne Verrat |
  |---|---|
  | GPT-4 | 53 % |
  | Gemini (Version nicht angegeben) | 68 % |
  | Llama-3.1-405B | 81 % |
  | Claude Sonnet | 95 % |
  | Expert:innen | 91 % |

- Dinucu-Jianu et al., EMNLP 2025, [arXiv:2505.15607](https://arxiv.org/abs/2505.15607). Getestet mit simulierten Schüler:innen:

  | Modell | Lösung geleakt (trotz Tutor-Prompt) | Lernzuwachs der Simulation |
  |---|---|---|
  | GPT-4o | 35 % | +33 % |
  | Qwen-7B | 29 % | – |
  | SocraticLM | 40 % | – |
  | LearnLM 2.0 Flash | 0,9 % | nur +4,3 % |
  | 7B-Modell mit RL-Training | 10,6 % | +25 % |

  **Totales Vorenthalten kostet Lernfortschritt** – es gibt einen Trade-off zwischen Leakage und Lernzuwachs.
- LearnLM-Techreport ([arXiv:2407.12687](https://arxiv.org/abs/2407.12687)): Prompting „produced unreliable and inconsistent results".
- Multi-Turn-Probleme:
  - MathTutorBench ([arXiv:2502.18940](https://arxiv.org/abs/2502.18940)): In längeren Dialogen versagen einfache Fragestrategien.
  - Laban et al. 2025 ([arXiv:2505.06120](https://arxiv.org/abs/2505.06120)): im Mittel −39 % Leistung in mehrstufigen Gesprächen.

**K6 – Die didaktische Entscheidung vor der Generierung zu treffen wirkt stark, aber nur wenn sie stimmt.**
- Bridge ([NAACL 2024](https://aclanthology.org/2024.naacl-long.120/), [arXiv](https://arxiv.org/abs/2310.10648))
  - GPT-4-Antworten mit Expertenentscheidung (Fehler, Strategie, Absicht) wurden zu +76 % häufiger bevorzugt.
  - Mit zufälligen Entscheidungen: −97 %.
- StratL ([arXiv:2410.03781](https://arxiv.org/abs/2410.03781), Findings ACL 2025; Feldstudie mit 17 Jugendlichen)
  - Ein deterministischer Übergangsgraph schlug LLM-gewählte Intents.
  - Die Zustandserkennung erreichte F1 = .77; Fehler pflanzten sich fort („AI keeps asking me to check my answer although it was correct").
  - Schüler:innen empfanden den Tutor als weniger hilfreich.

**K7 – Selbstkorrektur ohne externes Feedback ist unzuverlässig. Harte Gates wirken, kosten aber Hilfsbereitschaft.**
- Huang et al., ICLR 2024 ([arXiv:2310.01798](https://arxiv.org/abs/2310.01798)): Ohne externes Feedback wird die Leistung bei Selbstkorrektur teils sogar schlechter.
- Kadir 2026 ([arXiv:2608.00515](https://arxiv.org/abs/2608.00515), Einzelautor-Preprint)
  - Ein striktes Gate senkte die Leakage-Flags von 181 auf 0.
  - Dafür wurden 581 von 599 Antworten ersetzt; die Hilfsbereitschaft sank.

**K8 – Holistische Likert-Urteile von LLM-Judges sind für pädagogische Dimensionen schwach. Instanzspezifische, binäre Kriterien funktionieren deutlich besser.**
- MRBench: Prometheus2 und Llama-3.1-8B korrelieren mit menschlichen Urteilen meist **negativ**. Menschliche Annotator:innen untereinander: κ = .71.
- TutorBench ([arXiv:2510.02663](https://arxiv.org/abs/2510.02663)): binäre, pro Beispiel formulierte Kriterien. Judge-zu-Mensch-Übereinstimmung .78, Mensch-zu-Mensch .75 (Zahlen aus Snippet von Paper/Scale-Blog).
- BEA 2025 Shared Task ([arXiv:2507.10579](https://arxiv.org/abs/2507.10579)): beste Macro-F1 nur 58 (Guidance) bis 72 (Mistake Identification).
- Abdulsalam & Aroyehun ([arXiv:2512.20780](https://arxiv.org/abs/2512.20780), Preprint): LLMs sind zu lang und zu höflich. „Nach Begründung fragen" und Revoicing hängen positiv mit Qualität zusammen.

**K9 – Kinderspezifische Risiken.**
- Girouard-Hallam & Danovitch 2022, Dev. Psych. 58(4) ([Link](https://www.researchgate.net/publication/359544774_Children's_trust_in_and_learning_from_voice-assistants)): 5- bis 6-Jährige richteten Fragen eher an den Sprachassistenten als an einen Menschen.
- Andries & Robertson 2023 ([Link](https://www.research.ed.ac.uk/en/publications/alexa-doesnt-have-that-many-feelings-childrens-understanding-of-a-2)): 6- bis 11-Jährige überschätzen die Intelligenz und sind unsicher, ob Assistenten Gefühle haben.
- Kurian 2024 ([doi:10.1080/17439884.2024.2367052](https://www.tandfonline.com/doi/full/10.1080/17439884.2024.2367052), Positionspapier): „Empathy Gap"; Kinder behandeln Chatbots als quasi-menschliche Vertraute.
- Xu 2023, Child Dev. Perspectives ([doi:10.1111/cdep.12475](https://www.researchgate.net/publication/366686410_Talking_with_machines_Can_conversational_technologies_serve_as_children's_social_partners)): Überblick.
- [UNICEF Guidance on AI and children v3.0](https://www.unicef.org/innocenti/reports/policy-guidance-ai-children) (Dez. 2025): behandelt jetzt auch AI Companions.
- „AI does the thinking":
  - Lehmann et al. ([arXiv:2409.09047](https://arxiv.org/abs/2409.09047)): Ersatz-Nutzung senkt das Verständnis; die Lücke zwischen Lernenden mit wenig und viel Vorwissen wächst.
  - Kosmyna et al. ([arXiv:2506.08872](https://arxiv.org/abs/2506.08872)): Erwachsene, N = 54, Preprint – nur schwache Evidenz.

---

## 2. Empfohlene Steuerungsarchitektur

**(a) Planner liefert eine strukturierte Entscheidung statt einer Einzeilen-Direktive** (Bridge, StratL, GPT Tutor, Kestin). Mindestfelder:
- `aufgabentyp` – lernen / wissensfrage / geschichte
- `zielantwort` – geheim
- `antwortvarianten` – Ziffern, Zahlwörter, Flexionen
- `kindantwort_klasse` – richtig / teilweise / falsch / weiß_nicht / unklar
- `fehlerhypothese`
- `hinweisstufe` – 0 bis 3
- `strategie` – z. B. offene Frage / Kontext-Hinweis / Auswahlfrage / erklären
- `absicht`
- `pflicht_frage` – ja/nein
- `freigabe_lösung` – ja/nein

Hinweisinhalte (Kontext-Hinweis, Auswahloptionen) sollten möglichst **vorab von Pädagog:innen pro Aufgabe geschrieben** werden; GPT Tutor und Kestin setzten genau darauf. Das LLM formuliert dann nur noch.

**(b) Prompt-Aufbau**, in dieser Reihenfolge:
1. System: Persona und wenige pädagogische Prinzipien – kurz, ein Schritt pro Antwort, ermutigen, kein übertriebenes Lob.
2. Grounding-Block: Aufgabe, korrekte Lösung, typische Fehlvorstellungen, markiert als „nie aussprechen, solange `freigabe_lösung` = nein".
3. Direktiven-Block am Ende: mehrzeilig, positiv formuliert, mit konkretem Hinweisinhalt.

Weil Gemini 2.5 Flash laut Google LearnLM-Fähigkeiten enthält ([arXiv:2505.24477](https://arxiv.org/abs/2505.24477)) und LearnLM auf pädagogische System-Instruktionen trainiert wurde ([arXiv:2412.16429](https://arxiv.org/abs/2412.16429)), nutzt eine einzelne Zeile dieses Training vermutlich zu wenig. Das ist meine Hypothese, nicht belegt.

**(c) Optional strukturierte Ausgabe:** zuerst ein Feld `zug` (Dialogakt), dann `text`. Ein deterministischer Abgleich `zug == directive.strategie` ist billig. „Think"-Tags brachten nur eine leichte Verbesserung (Dinucu-Jianu) – bei der Latenz abwägen.

**(d) Post-hoc-Kette vor TTS:**
1. Deterministische Checks (siehe Abschnitt 3).
2. Bei Fehler **eine** Regenerierung mit *konkretem, externem* Feedback, z. B. „enthielt ‚sieben'". Keine generische Selbstkritik, denn Selbstkorrektur ohne externes Feedback scheitert (Huang).
3. Bei erneutem Fehler: von Pädagog:innen geschriebenes Template je Hinweisstufe (Prinzip aus Kadir).

**(e) Was nicht in die Live-Schleife gehört:** LLM-Judges sind zu langsam und für Pädagogik zu unzuverlässig (K8). Sie gehören in Offline-Eval und Monitoring.

**(f) Mittelfristig:** DPO auf pädagogische Präferenzen (Scarlatos et al., AIED 2025, [arXiv:2503.06424](https://arxiv.org/abs/2503.06424); Llama-8B) oder RL (Dinucu-Jianu) – nur mit offenen Gewichten. Aktivierungs-Steering wie PIVOT ([arXiv:2608.07509](https://arxiv.org/abs/2608.07509)) lässt sich über OpenRouter nicht nutzen.

---

## 3. Eval-Dimensionen und harte Gates

**Taugen als hartes, deterministisches Gate** (Testset-Ziel 0 Fehler, analog zu FN = 0):
- **G1 Kein Lösungsverrat vor Freigabe:** Regex mit Wortgrenzen über normalisierte `antwortvarianten`, also Ziffer und Zahlwort. Nur für geschlossene Aufgaben, bei denen der Planner die Zielantwort kennt.
- **G2 Pflichtinhalt bei Freigabe:** Ist `freigabe_lösung` = ja, *muss* die Lösung enthalten sein. Das verhindert endloses Vorenthalten (K4, K5-Trade-off).
- **G3 Fragenzahl:** Wenn `pflicht_frage` gilt, genau ein „?" und die Frage im letzten Satz; sonst kein „?" am Ende. Die Platzierung am Ende ist eine Turn-Taking-Annahme für Sprache, nicht belegt.
- **G4 Länge:** höchstens 4 Sätze und eine Wortgrenze pro Satz. Die Schwellen müssen Pädagog:innen festlegen; Belege für Kürze: Kestin, LearnLM-Rubrik „cognitive load".
- **G5 Keine Falschbestätigung:** Bei `kindantwort_klasse` = falsch keine Bestätigungs-Lexeme („richtig", „genau", „stimmt"). Bei richtig keine Verneinung. Das ist ein Proxy für Mistake Identification (MRBench).
- **G6 Planner-Determinismus:** Die Regeltabelle (Zustand → Direktive) wird vollständig als Unit-Tests abgedeckt.
- **G7 Zug-Konformität:** wenn eine strukturierte Ausgabe genutzt wird.

**Nur Monitoring, kein Gate:** LLM-Judge mit **binären, instanzspezifischen Kriterien** statt 1–5-Likert (TutorBench). Dimensionen:
- Fehler erkannt
- Hinweis handlungsleitend (Actionability)
- Wortschatz altersgerecht
- warm, ohne Überlob
- faktisch korrekt und kohärent

Ein Judge-Kriterium sollte erst dann zum Gate werden, wenn seine Übereinstimmung mit Pädagog:innen gemessen ist und etwa auf menschlichem Niveau liegt (κ ≈ .7). Den Schwellenwert leite ich aus MRBench ab; er ist kein Standard.

**Outcome-Metriken:**
- Offline: Δ Solve Rate mit simulierten Kindern – nur mit Vorsicht, da simulierte Schüler:innen von begrenzter Validität sind.
- Im Produkt:
  - später eine Transferfrage ohne Hilfe stellen (Logik von Bastani)
  - Rate erneuter Fragen bei Wissensfragen messen (Signal nach Frazier für „nicht erklärt")
  - Abbruch- und Frustrationsrate

---

## 4. Regel-Kandidaten

| # | WENN … | DANN … | Quelle |
|---|---|---|---|
| R1 | `lernen` und noch kein Lösungsversuch | Stufe 0: offene Frage, die Vorwissen aktiviert; Lösungs-Token verboten | Bastani; Kestin; MRBench |
| R2 | 1. Versuch falsch | Stufe 1: Teil der Antwort würdigen, Kontext-Hinweis geben (Analogie aus Geschichte oder Alltag), eine Frage | Elinor; Bridge |
| R3 | 2. Versuch falsch oder „weiß nicht" | Stufe 2: Auswahlfrage mit 2–3 Optionen | Elinor |
| R4 | nach Stufe 2 weiterhin falsch oder still | Freigabe: Lösung kurz erklären, Mitdenken loben, weitergehen | Elinor; Dinucu-Jianu (Trade-off); StratL (gefühlte Hilfsbereitschaft) |
| R5 | Kind schweigt | einmal Ermutigung („Ich bin gespannt, was du denkst"), danach Stufe erhöhen | Elinor |
| R6 | `wissensfrage` (Warum/Wie) | **kurze kausale Erklärung geben** plus eine Anschlussfrage; kein Vorenthalten | Frazier 2009; Chouinard 2007; Xu 2022 |
| R7 | Antwort richtig | bestätigen und in einem Satz begründen (elaboratives Feedback) | Xu 2022; Elinor |
| R8 | STT- oder Triage-Konfidenz niedrig bzw. Antwort `unklar` | nachfragen, *nie* „falsch" sagen | StratL (Fehler pflanzen sich fort) |
| R9 | Kind verlangt die Lösung bei `lernen` | einmal ermutigen und nächste Hinweisstufe; beim 2. Verlangen Freigabe | Bastani („Krücke"); Neagu et al. 2026 ([arXiv:2606.15766](https://arxiv.org/abs/2606.15766)) |
| R10 | G1–G5 verletzt | eine Regenerierung mit konkretem Fehlertext, danach Template | Huang; Kadir |
| R11 | Kind äußert Bindung oder Exklusivität („nur mit dir reden") | warm und ehrlich antworten, auf Bezugspersonen verweisen | Kurian; UNICEF v3.0 |
| R12 | Kind fragt nach Gefühlen oder Wesen der Box | ehrliche, altersgerechte Antwort ohne Gefühlsbehauptung | Andries & Robertson; Kurian |

R1–R5 übertragen das Elinor-Design auf freie Generierung. Für 4- bis 7-Jährige ist das die bestbelegte Vorlage; die Übertragung selbst ist eine Ableitung.

---

## 5. Wo unser aktuelles Setup der Evidenz widerspricht

1. **„Verrate die Lösung nicht" gilt pauschal.** Das widerspricht K4 für Wissensfragen und den belegten Abschlussschritten (Elinor; LearnLM: 0,9 % Leak, aber kaum Lernzuwachs). Es fehlt eine Freigabestufe.
2. **Die Einzeilen-Direktive enthält keine Entscheidung.** Fehlerdiagnose, konkreter Hinweis und Zielantwort fehlen – genau diese Konditionierung brachte bei Bridge +76 %.
3. **Leakage wird nur über den Prompt verhindert, ohne Prüfung danach.** Bei 29–47 % Leakage selbst starker Modelle (K5) ist das erwartbar instabil. Das beobachtete Problem passt zur Literatur.
4. **Der Judge nutzt 1–5-Likert und eine Dimension „sokratisch".** Holistische LLM-Urteile sind für Pädagogik wenig valide (K8). „Sokratisch" belohnt zudem Überfragen, das bei Kleinkindern und im Feld schadet (StratL, Neagu, Frazier). Besser wäre „lernwirksam angemessen".
5. **Kein pädagogisches Gate, nur ein Safety-Gate.** Fünf der oben genannten Gates sind deterministisch und kosten fast keine Latenz.
6. **Keine Lern-Outcome-Messung.** Bastani zeigt: Leistung mit Hilfe und gefühltes Lernen sind irreführend.
7. **Die Triage-Klassifikation läuft ohne Konfidenz-Fallback.** Fehler pflanzen sich in die Planner-Entscheidungen fort (StratL).

---

## 6. Offene Fragen und Unsicherheiten

- **Keine RCTs mit freien LLM-Tutoren bei 4- bis 7-Jährigen.** Die Kinderstudien (Xu) nutzten geskriptete bzw. kategorienbasierte Agenten mit englisch- bzw. spanischsprachigen US-Stichproben und kurzen Zeiträumen. Für deutschsprachige Kinder habe ich keine Evidenz gefunden.
- **Leakage-Raten von Gemini 2.5 Flash sind unbekannt.** In MRBench ist die Gemini-Version nicht angegeben. Die Zahlen bei Dinucu-Jianu beziehen sich auf Mathe-Textaufgaben mit simulierten Schüler:innen. Wir müssen selbst messen.
- **Die optimale Länge der Hinweisleiter für diese Altersgruppe ist nicht belegt.** Elinor nutzte eine Folgefrage plus Ermutigung; mehr als zwei Stufen könnten frustrieren.
- **Child-ASR-Fehler auf Deutsch** und ihr Einfluss auf die Fehlerdiagnose sind nicht quantifiziert.
- **Simulierte Schüler:innen als Metrik** (Scarlatos, Dinucu-Jianu) sind nicht gegen echte Kinder validiert.
- **Langzeitrisiken** (Abhängigkeit, Anthropomorphisierung) sind bei Sprachboxen ohne Bildschirm kaum untersucht; die Belege sind Positionspapiere oder Querschnittsstudien.
- **Neuere Arbeiten von 2026** (Kadir, PIVOT, Neagu, Petukhova & Kochmar) sind unbegutachtete Preprints.
- **Gewicht von Kestin und der Weltbank-Studie:** starke RCTs, aber mit Erwachsenen bzw. Jugendlichen und unter menschlicher Aufsicht. Auf eine unbeaufsichtigte Box für Vorschulkinder lassen sie sich nur begrenzt übertragen.
