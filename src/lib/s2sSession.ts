/**
 * Speech-to-Speech-Session im Browser: Mikrofon → VAD → /api/s2s → Audio-Queue.
 * Der Audio-Puffer ist zugleich der Sicherheitspuffer (Broadcast-Delay): bei einem
 * Abbruch wird alles verworfen, was noch nicht gespielt wurde.
 */
import { createEnergyVad } from './energyVad'

export type SessionZustand = 'aus' | 'hoert_zu' | 'denkt' | 'spricht'

export interface S2SEreignis {
  type: 'stage' | 'transcript' | 'text' | 'audio' | 'abort' | 'done'
  key?: string
  status?: 'aktiv' | 'fertig' | 'fehler'
  ms?: number
  detail?: string
  text?: string
  chunk?: string
  index?: number
  wavBase64?: string
  kind?: 'opener' | 'answer' | 'script' | 'pivot'
  grund?: string
  totalMs?: number
  decision?: string
}

interface SessionOptionen {
  /** Payload-Zusatz für /api/s2s (ageBand, models, systemPrompt, blockPatterns, sessionId). */
  payload: () => Record<string, unknown>
  onEreignis: (ereignis: S2SEreignis) => void
  onZustand: (zustand: SessionZustand) => void
  onFehler: (meldung: string) => void
}

const wavAusFloat = (samples: Float32Array, rate: number): string => {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const schreibe = (pos: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(pos + i, text.charCodeAt(i))
  }
  schreibe(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  schreibe(8, 'WAVE')
  schreibe(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  schreibe(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i += 1) {
    const c = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, c < 0 ? c * 0x8000 : c * 0x7fff, true)
  }
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

export class S2SSession {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private micAnalyser: AnalyserNode | null = null
  private outAnalyser: AnalyserNode | null = null
  private vad = createEnergyVad()
  /** Gesammelte Mikrofon-Blöcke des laufenden Turns — einziges Aufnahme-Feld. */
  private bloecke: Float32Array[] = []
  private laeuft = false
  private spieltGerade = false
  /** Ein Turn (Anfrage bis Antwortende) läuft — Mikrofon pausiert währenddessen ganz,
   *  damit ein Hintergrundgeräusch während "denkt" keinen zweiten Turn lostritt. */
  private turnAktiv = false
  private queue: string[] = []
  private opt: SessionOptionen

  constructor(opt: SessionOptionen) {
    this.opt = opt
  }

  /** Analyser für die Globe-Animation: Mikrofon beim Zuhören, Ausgabe beim Sprechen. */
  getAnalyser(zustand: SessionZustand): AnalyserNode | null {
    return zustand === 'spricht' ? this.outAnalyser : this.micAnalyser
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
    } catch {
      this.opt.onFehler('Kein Mikrofon-Zugriff — bitte im Browser erlauben.')
      return
    }
    this.ctx = new AudioContext()
    this.micAnalyser = this.ctx.createAnalyser()
    this.outAnalyser = this.ctx.createAnalyser()
    this.outAnalyser.connect(this.ctx.destination)
    const quelle = this.ctx.createMediaStreamSource(this.stream)
    quelle.connect(this.micAnalyser)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (ev) => {
      // während der Ausgabe und während ein Turn läuft (Anfrage/Antwort unterwegs) nicht mithören
      if (!this.laeuft || this.spieltGerade || this.turnAktiv) return
      const block = new Float32Array(ev.inputBuffer.getChannelData(0))
      this.bloecke.push(block)
      const zustand = this.vad.push(block, this.ctx!.sampleRate)
      if (zustand === 'ende') void this.turnSenden()
    }
    quelle.connect(this.processor)
    this.processor.connect(this.ctx.destination)
    this.laeuft = true
    this.opt.onZustand('hoert_zu')
  }

  stop(): void {
    this.laeuft = false
    this.queue = []
    this.spieltGerade = false
    this.turnAktiv = false
    this.processor?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.ctx = null
    this.bloecke = []
    this.vad.reset()
    this.opt.onZustand('aus')
  }

  /** Nimmt das Aufgenommene, schickt es an /api/s2s und verarbeitet den Ereignis-Stream. */
  private async turnSenden(): Promise<void> {
    const bloecke = this.bloecke
    this.bloecke = []
    const gesamt = bloecke.reduce((n, c) => n + c.length, 0)
    if (gesamt < 4000) return // zu kurz: Rascheln, kein Satz
    const pcm = new Float32Array(gesamt)
    let offset = 0
    for (const block of bloecke) {
      pcm.set(block, offset)
      offset += block.length
    }
    const rate = this.ctx?.sampleRate ?? 48000
    const ziel = 16000
    const faktor = rate / ziel
    const laenge = Math.floor(pcm.length / faktor)
    const down = new Float32Array(laenge)
    for (let i = 0; i < laenge; i += 1) {
      const von = Math.floor(i * faktor)
      const bis = Math.min(Math.floor((i + 1) * faktor), pcm.length)
      let summe = 0
      for (let j = von; j < bis; j += 1) summe += pcm[j]
      down[i] = bis > von ? summe / (bis - von) : 0
    }

    this.turnAktiv = true
    this.opt.onZustand('denkt')
    try {
      const res = await fetch('/api/s2s', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...this.opt.payload(), audio: wavAusFloat(down, ziel) }),
      })
      if (!res.body) {
        this.opt.onFehler('Kein Stream vom Server erhalten.')
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let puffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        puffer += decoder.decode(value, { stream: true })
        let grenze
        while ((grenze = puffer.indexOf('\n')) !== -1) {
          const zeile = puffer.slice(0, grenze).trim()
          puffer = puffer.slice(grenze + 1)
          if (!zeile) continue
          const ereignis: S2SEreignis = JSON.parse(zeile)
          this.opt.onEreignis(ereignis)
          if (ereignis.type === 'audio' && ereignis.wavBase64) {
            this.queue.push(ereignis.wavBase64)
            void this.queueAbspielen()
          }
          if (ereignis.type === 'abort') this.queue = [] // Puffer verwerfen — der Pivot danach bleibt unberührt,
          // weil er als eigenes 'audio'-Ereignis erst NACH dieser Zeile eintrifft und neu gepusht wird.
        }
      }
    } catch {
      // Netzwerk-/Stream-Fehler: nicht in "denkt" hängen bleiben, sondern der UI Bescheid geben
      this.queue = []
      this.opt.onFehler('Verbindung zum Server unterbrochen.')
    } finally {
      this.turnAktiv = false
      if (this.laeuft && !this.spieltGerade) this.opt.onZustand('hoert_zu')
    }
  }

  /** Spielt die Warteschlange nacheinander ab und meldet die Zustände. */
  private async queueAbspielen(): Promise<void> {
    if (this.spieltGerade || !this.ctx) return
    this.spieltGerade = true
    this.opt.onZustand('spricht')
    while (this.queue.length > 0) {
      const wav = this.queue.shift()!
      const bytes = Uint8Array.from(atob(wav), (c) => c.charCodeAt(0))
      try {
        const puffer = await this.ctx.decodeAudioData(bytes.buffer)
        await new Promise<void>((fertig) => {
          const quelle = this.ctx!.createBufferSource()
          quelle.buffer = puffer
          quelle.connect(this.outAnalyser!)
          quelle.onended = () => fertig()
          quelle.start()
        })
      } catch {
        // defektes Audio überspringen statt die Session zu killen
      }
    }
    this.spieltGerade = false
    this.vad.reset()
    if (this.laeuft) this.opt.onZustand('hoert_zu')
  }
}
