/**
 * Test für die Turn-Abbruch-Garantie: stop() muss den laufenden fetch abbrechen und
 * dafür sorgen, dass Ereignisse eines bereits verworfenen Turns (egal ob der Reader
 * sofort endet oder nicht) weder in die Queue noch in einen Zustandswechsel münden.
 * Echtes Mikrofon/Web-Audio ist hier nicht verfügbar — daher minimale Fakes für die
 * Browser-APIs, und ein bewusster Zugriff auf private Interna (`as any`) für die
 * Turn-Auslösung, weil turnSenden() sonst nur über echtes Mikrofon-Audio erreichbar wäre.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { S2SSession, type S2SEreignis, type SessionZustand } from './s2sSession'

class FakeNode {
  connect() {}
  disconnect() {}
}
class FakeScriptProcessor extends FakeNode {
  onaudioprocess: ((ev: unknown) => void) | null = null
}
class FakeBufferSource extends FakeNode {
  buffer: unknown
  onended: (() => void) | null = null
  start() {}
  stop() {
    this.onended?.()
  }
}
class FakeAudioContext {
  sampleRate = 16000
  destination = {}
  createAnalyser() {
    return new FakeNode() as unknown as AnalyserNode
  }
  createMediaStreamSource() {
    return new FakeNode() as unknown as MediaStreamAudioSourceNode
  }
  createScriptProcessor() {
    return new FakeScriptProcessor() as unknown as ScriptProcessorNode
  }
  createBufferSource() {
    return new FakeBufferSource() as unknown as AudioBufferSourceNode
  }
  decodeAudioData() {
    return Promise.resolve({} as AudioBuffer)
  }
  close() {
    return Promise.resolve()
  }
}

const fakeStream = { getTracks: () => [{ stop: () => {} }] } as unknown as MediaStream

describe('S2SSession — stop() während eines laufenden Turns', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve(fakeStream) } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('bricht den fetch ab und verwirft danach eintreffende Ereignisse des alten Turns', async () => {
    let ersterSignal: AbortSignal | undefined
    let zeileSchicken: ((zeile: string) => void) | undefined
    const ereignisse: S2SEreignis[] = []
    const zustaende: SessionZustand[] = []

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      ersterSignal = init?.signal ?? undefined
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          zeileSchicken = (zeile: string) => controller.enqueue(new TextEncoder().encode(zeile + '\n'))
        },
      })
      return Promise.resolve({ body: stream } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)

    const session = new S2SSession({
      payload: () => ({}),
      onEreignis: (e) => ereignisse.push(e),
      onZustand: (z) => zustaende.push(z),
      onFehler: () => {},
    })
    await session.start()

    // Genug "laute" Samples anhäufen, damit turnSenden() nicht wegen Kürze abbricht —
    // wir greifen bewusst auf das private Feld zu, um den Turn ohne echtes Mikrofon auszulösen.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(session as any).bloecke = [Float32Array.from({ length: 8000 }, () => 0.5)]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const turnPromise = (session as any).turnSenden() as Promise<void>

    // (a) Der fetch trägt ein Abort-Signal, das im Ruhezustand noch nicht ausgelöst ist.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(ersterSignal?.aborted).toBe(false)

    session.stop()

    // (a) stop() hat den Request abgebrochen.
    expect(ersterSignal?.aborted).toBe(true)

    // Eine Zeile, die "zu spät" aus dem alten (bereits verworfenen) Stream eintrifft —
    // simuliert den Fall, dass der Abbruch den Reader nicht sofort beendet.
    zeileSchicken?.(JSON.stringify({ type: 'audio', wavBase64: 'zzz', index: 0, kind: 'answer' }))

    await turnPromise

    // (b) Das nachtropfende Ereignis wurde wegen des Turn-Tokens verworfen.
    expect(ereignisse).toHaveLength(0)
    // (c) Kein onZustand-Aufruf aus dem alten Turn erreicht die (bereits gestoppte) Session —
    // der letzte Zustand ist der von stop() gesetzte 'aus', turnSenden() hat ihn nicht überschrieben.
    expect(zustaende.at(-1)).toBe('aus')
  })
})
