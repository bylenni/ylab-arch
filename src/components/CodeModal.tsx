import { useEffect, useState } from 'react'

interface CodePayload {
  label: string
  code: string
}

/** Öffnet das Code-Modal von überall per Event — entkoppelt vom React-Flow-Knoten. */
export function openCodeModal(label: string, code: string) {
  window.dispatchEvent(new CustomEvent<CodePayload>('arch:open-code', { detail: { label, code } }))
}

export function CodeModal() {
  const [payload, setPayload] = useState<CodePayload | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onOpen = (ev: Event) => {
      setPayload((ev as CustomEvent<CodePayload>).detail)
      setCopied(false)
    }
    window.addEventListener('arch:open-code', onOpen)
    return () => window.removeEventListener('arch:open-code', onOpen)
  }, [])

  useEffect(() => {
    if (!payload) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setPayload(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [payload])

  if (!payload) return null

  const copy = () => {
    navigator.clipboard?.writeText(payload.code).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={() => setPayload(null)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">&lt;/&gt;</span>
            <h2 className="text-sm font-bold">{payload.label}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-ring hover:text-foreground"
            >
              {copied ? '✓ kopiert' : '⧉ kopieren'}
            </button>
            <button
              type="button"
              onClick={() => setPayload(null)}
              aria-label="Schließen"
              className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-ring hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto bg-background p-4 font-mono text-[0.78rem] leading-relaxed text-foreground">
          <code>{payload.code}</code>
        </pre>
      </div>
    </div>
  )
}
