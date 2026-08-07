/**
 * Speech-to-Speech-Session im Browser: Mikrofon → VAD → /api/s2s → Audio-Queue.
 * Der Audio-Puffer ist zugleich der Sicherheitspuffer (Broadcast-Delay): bei einem
 * Abbruch wird alles verworfen, was noch nicht gespielt wurde.
 */
import { createEnergyVad } from './energyVad'

export type SessionZustand = 'aus' | 'hoert_zu' | 'denkt' | 'spricht'

/** Timeout für einen Turn-Request: hängt Piper/der Server, darf das Kind nicht ohne
 *  Erwachsenen im "denkt"-Zustand feststecken. */
const S2S_TIMEOUT_MS = 45000
/** Vorlauf-Ringpuffer: so viel Audio VOR der VAD-Erkennung "spricht" bleibt erhalten,
 *  damit ein leiser Wortanfang nicht abgeschnitten wird. */
const RINGPUFFER_MS = 300
/** Harte Obergrenze für eine Aufnahme — ein Dauerton (oder ein VAD, der nie "ende"
 *  meldet) darf die Session nicht blockieren. */
const MAX_AUFNAHME_MS = 30000

export interface S2SEreignis {
  type: 'stage' | 'transcript' | 'text' | 'audio' | 'abort' | 'done'
  key?: string
  status?: 'aktiv' | 'fertig' | 'fehler'
  ms?: number
  detail?: string
  /** Modell, mit dem diese Stufe tatsächlich lief (nur triage/main/safety/guard). */
  model?: string
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
  /** Meldet die client-lokale VAD-Stufe fürs Diagramm — die Sprecherkennung läuft
   *  im Browser, der Server weiß nichts davon. 'aktiv' bei erkannter Sprache,
   *  'fertig' sobald der Turn abgeschickt wird. */
  onVadZustand?: (status: 'aktiv' | 'fertig') => void
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
  private bloeckeSamples = 0
  /** Kurzer Vorlauf-Ringpuffer: läuft permanent mit, solange KEIN Turn aufgenommen
   *  wird (VAD meldet "still"). Sobald Sprache erkannt wird, wandert er komplett in
   *  `bloecke` — ohne ihn würde der erste, oft leise Wortanfang fehlen. Solange kein
   *  Turn läuft, wächst NUR er, nicht `bloecke` — das begrenzt Heap-Verbrauch bei
   *  Stille und verhindert, dass der gesendete WAV Vorlaufstille enthält, auf der
   *  Whisper sonst halluziniert. */
  private ringpuffer: Float32Array[] = []
  private ringpufferSamples = 0
  private laeuft = false
  private spieltGerade = false
  /** Ein Turn (Anfrage bis Antwortende) läuft — Mikrofon pausiert währenddessen ganz,
   *  damit ein Hintergrundgeräusch während "denkt" keinen zweiten Turn lostritt. */
  private turnAktiv = false
  private queue: string[] = []
  /** Laufende Nummer pro Turn — zweite Verteidigungslinie neben dem AbortController:
   *  Ereignisse, deren Token nicht mehr aktuell ist, werden ignoriert (Turn verworfen). */
  private turnToken = 0
  private abortController: AbortController | null = null
  /** Aktuell spielende Quelle, damit stop() sie explizit stoppen kann (statt auf
   *  'onended' nach ctx.close() zu hoffen, das dort nicht zuverlässig feuert). */
  private spielQuelle: AudioBufferSourceNode | null = null
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
      const rate = this.ctx!.sampleRate
      const zustand = this.vad.push(block, rate)

      if (zustand === 'still') {
        // Kein Turn läuft: nur den kurzen Vorlauf aktualisieren, NICHT aufnehmen —
        // sonst wächst der Puffer unbegrenzt mit jeder Minute Stille.
        this.ringpufferPush(block, rate)
        return
      }

      if (this.bloecke.length === 0) {
        // Sprachbeginn: den Vorlauf aus dem Ringpuffer übernehmen, damit der Wortanfang
        // nicht fehlt, und ihn danach leeren.
        this.opt.onVadZustand?.('aktiv')
        for (const alt of this.ringpuffer) {
          this.bloecke.push(alt)
          this.bloeckeSamples += alt.length
        }
        this.ringpuffer = []
        this.ringpufferSamples = 0
      }
      this.bloecke.push(block)
      this.bloeckeSamples += block.length

      const aufnahmeMs = (this.bloeckeSamples / rate) * 1000
      if (zustand === 'ende' || aufnahmeMs >= MAX_AUFNAHME_MS) {
        this.opt.onVadZustand?.('fertig')
        // VAD zurücksetzen: wird z.B. bei Timeout/Server-Fehler sofort nötig,
        // bevor die async turnSenden()-Antwort kommt — andernfalls bleibt VAD
        // auf "spricht", und der nächste Stille-Block löst einen Phantom-Turn aus.
        this.vad.reset()
        void this.turnSenden()
      }
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
    // Token invalidieren, BEVOR der alte fetch abgebrochen wird — so werden auch
    // Ereignisse, die trotz Abbruch noch aus dem alten Stream nachtropfen, verworfen.
    this.turnToken += 1
    this.abortController?.abort()
    this.abortController = null
    try {
      this.spielQuelle?.stop()
    } catch {
      // schon beendet — kein Problem
    }
    this.spielQuelle = null
    this.processor?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.ctx = null
    this.bloecke = []
    this.bloeckeSamples = 0
    this.ringpuffer = []
    this.ringpufferSamples = 0
    this.vad.reset()
    this.opt.onZustand('aus')
  }

  /** Hält nur die letzten `RINGPUFFER_MS` Millisekunden vor — älteres fällt raus. */
  private ringpufferPush(block: Float32Array, rate: number): void {
    this.ringpuffer.push(block)
    this.ringpufferSamples += block.length
    const maxSamples = (RINGPUFFER_MS / 1000) * rate
    while (this.ringpufferSamples > maxSamples && this.ringpuffer.length > 0) {
      const alt = this.ringpuffer.shift()!
      this.ringpufferSamples -= alt.length
    }
  }

  /** Nimmt das Aufgenommene, schickt es an /api/s2s und verarbeitet den Ereignis-Stream. */
  private async turnSenden(): Promise<void> {
    const bloecke = this.bloecke
    this.bloecke = []
    this.bloeckeSamples = 0
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

    // Eigener Turn-Token + eigener AbortController: stop() (oder ein neuer Turn) kann
    // diesen Request gezielt beenden, ohne eine andere/neuere Session zu berühren.
    this.turnToken += 1
    const meinToken = this.turnToken
    const controller = new AbortController()
    this.abortController = controller
    this.turnAktiv = true
    this.opt.onZustand('denkt')
    // Hängt Piper/der Server, bliebe der Globe ohne dieses Timeout dauerhaft auf "denkt"
    // stehen und das Mikrofon gesperrt — das Kind käme ohne Erwachsenen nicht weiter.
    // Bricht über denselben Controller ab (nicht über ein zweites Signal), damit die
    // bestehende Abbruch-Semantik (Reader-Schleife, Token-Prüfung) unverändert greift.
    let zeitUeberschritten = false
    const timeoutId = setTimeout(() => {
      zeitUeberschritten = true
      controller.abort()
    }, S2S_TIMEOUT_MS)
    try {
      const res = await fetch('/api/s2s', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...this.opt.payload(), audio: wavAusFloat(down, ziel) }),
        signal: controller.signal,
      })
      if (meinToken !== this.turnToken) return // inzwischen verworfen (stop()/neuer Turn)
      if (!res.ok) {
        // Ein 4xx/5xx trägt i. d. R. einen JSON-Body mit `error` — den lesen statt ihn
        // stillschweigend als NDJSON fehlzuinterpretieren (dort landet er sonst als
        // Ereignis mit type: undefined und wird nie sichtbar).
        let meldung = `Server antwortete mit Fehler ${res.status}.`
        try {
          const fehlerBody = await res.json()
          if (typeof fehlerBody?.error === 'string' && fehlerBody.error.trim()) meldung = fehlerBody.error
        } catch {
          // kein (parsbarer) JSON-Body — Standardmeldung behalten
        }
        this.opt.onFehler(meldung)
        return
      }
      if (!res.body) {
        this.opt.onFehler('Kein Stream vom Server erhalten.')
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let puffer = ''
      for (;;) {
        if (meinToken !== this.turnToken) break // Turn wurde verworfen — Rest des Streams ignorieren
        const { done, value } = await reader.read()
        if (done) break
        puffer += decoder.decode(value, { stream: true })
        let grenze
        while ((grenze = puffer.indexOf('\n')) !== -1) {
          const zeile = puffer.slice(0, grenze).trim()
          puffer = puffer.slice(grenze + 1)
          if (!zeile) continue
          // Zweite Verteidigungslinie: selbst wenn der Abbruch den Reader nicht sofort
          // beendet, darf ein nachtropfendes Ereignis nicht mehr in Queue/Zustand landen.
          if (meinToken !== this.turnToken) continue
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
    } catch (err) {
      if (meinToken !== this.turnToken) return // bewusster Abbruch durch stop() — kein Fehlerfall
      const istAbbruch = err instanceof DOMException && err.name === 'AbortError'
      this.queue = []
      if (zeitUeberschritten) {
        this.opt.onFehler('Der Begleiter antwortet gerade nicht — bitte versuch es gleich noch einmal.')
      } else if (!istAbbruch) {
        this.opt.onFehler('Verbindung zum Server unterbrochen.')
      }
    } finally {
      clearTimeout(timeoutId)
      if (this.abortController === controller) this.abortController = null
      // Nur den eigenen (noch aktuellen) Turn abschließen — ein bereits verworfener
      // Turn darf weder turnAktiv noch onZustand der neuen Session verändern.
      if (meinToken === this.turnToken) {
        this.turnAktiv = false
        if (this.laeuft && !this.spieltGerade) this.opt.onZustand('hoert_zu')
      }
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
          quelle.onended = () => {
            if (this.spielQuelle === quelle) this.spielQuelle = null
            fertig()
          }
          this.spielQuelle = quelle
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
