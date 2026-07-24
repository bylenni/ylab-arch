/**
 * Push-to-Talk-Recorder: Mikrofon → 16 kHz Mono-WAV (Base64) für whisper.cpp.
 * Bewusst ohne MediaRecorder/Opus — Whisper will PCM-WAV, so sparen wir ffmpeg im Backend.
 */
export class PttRecorder {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private chunks: Float32Array[] = []
  private inputRate = 48000

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    })
    this.ctx = new AudioContext()
    this.inputRate = this.ctx.sampleRate
    this.chunks = []
    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (ev) => {
      this.chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)))
    }
    this.source.connect(this.processor)
    this.processor.connect(this.ctx.destination)
  }

  /** Stoppt die Aufnahme und liefert Base64-WAV (16 kHz, mono, 16 bit). */
  async stop(): Promise<{ base64: string; seconds: number }> {
    this.processor?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    await this.ctx?.close()

    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const pcm = new Float32Array(total)
    let offset = 0
    for (const chunk of this.chunks) {
      pcm.set(chunk, offset)
      offset += chunk.length
    }
    this.chunks = []

    const targetRate = 16000
    const ratio = this.inputRate / targetRate
    const outLength = Math.floor(pcm.length / ratio)
    const down = new Float32Array(outLength)
    for (let i = 0; i < outLength; i += 1) {
      // simples Mitteln über das Quellfenster — reicht für Sprache völlig
      const start = Math.floor(i * ratio)
      const end = Math.min(Math.floor((i + 1) * ratio), pcm.length)
      let sum = 0
      for (let j = start; j < end; j += 1) sum += pcm[j]
      down[i] = end > start ? sum / (end - start) : 0
    }

    return { base64: encodeWav16(down, targetRate), seconds: outLength / targetRate }
  }
}

function encodeWav16(samples: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (pos: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(pos + i, text.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(binary)
}
