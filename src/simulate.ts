import type { ArchNode, ArchEdge } from './types'

export interface SimStep {
  nodeId: string
  label: string
  detail: string
  latencyMs: number
  cumulativeMs: number
  status: 'ok' | 'warn' | 'risk'
}

export interface SimResult {
  steps: SimStep[]
  pathNodeIds: string[]
  pathEdgeIds: string[]
  totalMs: number
  decision: 'normal' | 'sensibel' | 'unklar'
  answer: string
  blocked: boolean
  warnings: string[]
}

type Intent = 'geschichte' | 'lernen' | 'frage' | 'smalltalk'

const splitList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)

const matchWords = (text: string, words: string[]): string[] =>
  words.filter((w) => text.includes(w))

function detectIntent(text: string): Intent {
  if (/geschicht|erzähl|märchen|abenteuer/.test(text)) return 'geschichte'
  if (/plus|minus|mal |rechnen|zahl|buchstabe|englisch|heißt|übersetz/.test(text)) return 'lernen'
  if (/warum|wieso|weshalb|wie |was |wer |wo |woher/.test(text)) return 'frage'
  return 'smalltalk'
}

function mockAnswer(intent: Intent): string {
  switch (intent) {
    case 'geschichte':
      return 'Es war einmal ein kleiner Drache, der unbedingt fliegen lernen wollte … (Geschichte startet, Kapitel-Modus aktiv — „Erzähl weiter!" setzt fort)'
    case 'lernen':
      return 'Gute Frage! Lass uns das zusammen herausfinden: Wenn du 3 Finger an einer Hand hast und noch 4 dazu nimmst — magst du mal zählen? (sokratisch, Hinweis statt Lösung)'
    case 'frage':
      return 'Spannende Frage! Das Sonnenlicht hat ganz viele Farben, und die blaue Farbe wird am Himmel überall herumgekitzelt — deshalb sehen wir Blau. Was glaubst du, welche Farbe der Himmel am Abend hat? (Antwort + eine Gegenfrage, keine Sokratik-Schleife)'
    default:
      return 'Hihi, das freut mich! Was wollen wir zwei denn jetzt machen — eine Geschichte, ein Rätsel oder hast du eine Frage?'
  }
}

const SCRIPTED_ANSWER =
  'Oh, das klingt, als wäre dir das gerade wichtig. Das kenne ich — magst du darüber mit Mama, Papa oder jemandem sprechen, dem du vertraust? Ich bleibe auch gern noch bei dir. (kuratierter Baustein, kein freies Generieren)'

const CLARIFY_ANSWER = 'Hm, das habe ich nicht ganz verstanden. Magst du das noch einmal sagen?'

const FALLBACK_ANSWER =
  'Weißt du was? Das ist eine Frage für einen Erwachsenen. Frag da am besten Mama oder Papa — die wissen das! Wollen wir stattdessen eine Geschichte hören? (kuratierte Ersatzantwort, fail-closed)'

export function simulate(nodes: ArchNode[], edges: ArchEdge[], utterance: string, ageBand: '4-5' | '6-7' = '4-5'): SimResult {
  const text = utterance.toLowerCase()
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = (id: string) => edges.filter((edge) => edge.source === id)

  const warnings: string[] = []
  const steps: SimStep[] = []
  const pathNodeIds: string[] = []
  const pathEdgeIds: string[] = []

  const start = nodes.find(
    (node) => node.data.kind === 'input' || !edges.some((edge) => edge.target === node.id && byId.get(edge.source)?.data.kind !== 'ops'),
  )
  if (!start) {
    return {
      steps, pathNodeIds, pathEdgeIds, totalMs: 0, decision: 'normal',
      answer: '', blocked: false,
      warnings: ['Kein Startknoten gefunden — lege eine Komponente vom Typ „Gerät" an.'],
    }
  }

  let decision: SimResult['decision'] = 'normal'
  let answer = ''
  let blocked = false
  let cumulative = 0
  let current: ArchNode | undefined = start
  let guard = 0

  const pickEdge = (from: ArchNode, wanted?: string): ArchEdge | undefined => {
    const candidates = outgoing(from.id).filter((edge) => byId.get(edge.target)?.data.kind !== 'ops')
    if (candidates.length === 0) return undefined
    if (wanted) {
      const match = candidates.find((edge) => String(edge.label ?? '').toLowerCase() === wanted)
      if (match) return match
      warnings.push(`„${from.data.label}": keine Kante mit Bedingung „${wanted}" — nehme erste Kante (fail-open!).`)
    }
    if (candidates.length > 1 && !wanted) {
      const unconditional = candidates.find((edge) => !edge.label)
      if (unconditional) return unconditional
      warnings.push(`„${from.data.label}": mehrere Kanten ohne passende Bedingung — nehme die erste.`)
    }
    return candidates[0]
  }

  while (current && guard < 30) {
    guard += 1
    const data = current.data
    cumulative += data.latencyMs
    pathNodeIds.push(current.id)

    let detail = data.description ? '' : ''
    let status: SimStep['status'] = 'ok'
    let wanted: string | undefined

    switch (data.kind) {
      case 'input': {
        detail = `Button gedrückt · Earcon sofort (< 200 ms wahrgenommen) · „${utterance}"`
        break
      }
      case 'stt': {
        detail = 'Transkript erzeugt (Kinder-STT: Fehlerrate einkalkulieren — Konfidenz fließt in Triage).'
        break
      }
      case 'triage': {
        const riskHits = matchWords(text, splitList(data.config.riskWords))
        const emotionHits = matchWords(text, splitList(data.config.emotionWords))
        const minWords = Number(data.config.clarifyMinWords ?? '2')
        const tooShort = utterance.trim().split(/\s+/).filter(Boolean).length < minWords
        const intent = detectIntent(text)
        if (riskHits.length > 0 || emotionHits.length > 0) {
          decision = 'sensibel'
          status = 'risk'
          const hits = [...riskHits, ...emotionHits]
          detail = `Intent: ${intent} · Risiko/Emotion erkannt (${hits.join(', ')}) → sensibel`
        } else if (tooShort) {
          decision = 'unklar'
          status = 'warn'
          detail = `Nur ${utterance.trim().split(/\s+/).filter(Boolean).length} Wort(e) → niedrige Konfidenz → Rückfrage`
        } else {
          decision = 'normal'
          detail = `Intent: ${intent} · kein Risiko-Signal · Konfidenz ok → normal`
        }
        break
      }
      case 'router': {
        wanted = decision
        detail = `Deterministische Entscheidung: „${decision}"`
        status = decision === 'sensibel' ? 'risk' : decision === 'unklar' ? 'warn' : 'ok'
        break
      }
      case 'content': {
        // Teaching-Planner-Knoten: Strategie-Vorschau mit denselben Regeln wie server/teachingPlanner.mjs
        if (data.label.toLowerCase().includes('planner')) {
          const intent = detectIntent(text)
          if (intent === 'lernen') {
            const frust = /kann ich nicht|zu schwer|keine ahnung|weiß nicht|schaff ich nicht/.test(text)
            const strategie = frust
              ? 'loesung_mit_ermutigung (Frustbremse)'
              : ageBand === '4-5'
                ? 'gestuetzter_hinweis (Erstkontakt, 4–5)'
                : 'sokratische_gegenfrage (Erstkontakt, 6–7)'
            detail = `Lernfrage → Strategie: ${strategie}. Heuristik ohne Lernstand — echte Historie nur im Live-Modus.`
          } else {
            detail = `Keine Lernfrage (Intent: ${intent}) → Planner reicht unverändert durch.`
          }
        } else {
          detail = 'Passende kuratierte Bausteine als Prompt-Kontext ausgewählt.'
        }
        break
      }
      case 'prompt': {
        const length = (data.config.prompt ?? '').length
        detail = length > 0
          ? `System-Prompt zusammengesetzt (${length} Zeichen, Altersband eingesetzt).`
          : 'Kein Prompt konfiguriert — Konfigurationsfeld „prompt" am Knoten füllen.'
        if (length === 0) status = 'warn'
        break
      }
      case 'llm': {
        answer = mockAnswer(detectIntent(text))
        detail = `Antwortentwurf: „${answer.slice(0, 90)}…"`
        break
      }
      case 'safety': {
        const patterns = splitList(data.config.blockPatterns)
        const hits = matchWords(answer.toLowerCase(), patterns)
        if (hits.length > 0 && !blocked) {
          blocked = true
          wanted = 'blockiert'
          status = 'risk'
          detail = `Pattern-Treffer (${hits.join(', ')}) → blockiert, Ersatzantwort`
        } else {
          wanted = 'ok'
          detail = blocked ? 'Bereits blockiert — Ersatzpfad aktiv.' : 'Keine Treffer · Segment freigegeben.'
        }
        break
      }
      case 'script': {
        answer = decision === 'sensibel' && !blocked ? SCRIPTED_ANSWER : FALLBACK_ANSWER
        status = 'warn'
        detail = 'Kuratierte Antwort statt freier Generierung.'
        break
      }
      case 'clarify': {
        answer = CLARIFY_ANSWER
        status = 'warn'
        detail = 'Rückfrage statt Rateversuch.'
        break
      }
      case 'tts': {
        detail = 'Erstes freigegebenes Segment wird synthetisiert.'
        break
      }
      case 'output': {
        detail = `Gesamt bis erstes Antwort-Audio: ${cumulative} ms`
        status = cumulative > 2500 ? 'risk' : cumulative > 1500 ? 'warn' : 'ok'
        break
      }
      default: {
        detail = data.description
      }
    }

    steps.push({
      nodeId: current.id,
      label: data.label,
      detail,
      latencyMs: data.latencyMs,
      cumulativeMs: cumulative,
      status,
    })

    if (data.kind === 'output') break
    const edge = pickEdge(current, wanted)
    if (!edge) {
      warnings.push(`„${data.label}" hat keine ausgehende Kante — Pfad endet hier.`)
      break
    }
    pathEdgeIds.push(edge.id)
    current = byId.get(edge.target)
  }

  if (guard >= 30) warnings.push('Abbruch nach 30 Schritten — Zyklus im Graphen?')

  return { steps, pathNodeIds, pathEdgeIds, totalMs: cumulative, decision, answer, blocked, warnings }
}
