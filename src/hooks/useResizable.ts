import { useCallback, useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Breite eines rechts angedockten Panels, per Drag am linken Rand veränderbar.
 * Persistiert in localStorage.
 */
export function useResizable(storageKey: string, defaultWidth: number, min: number, max: number) {
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(storageKey))
    return stored >= min && stored <= max ? stored : defaultWidth
  })

  useEffect(() => {
    localStorage.setItem(storageKey, String(Math.round(width)))
  }, [storageKey, width])

  const startResize = useCallback(
    (ev: ReactPointerEvent) => {
      ev.preventDefault()
      const startX = ev.clientX
      const startWidth = width
      const onMove = (moveEv: PointerEvent) => {
        // Panel sitzt rechts → Ziehen nach links macht es breiter
        setWidth(Math.min(max, Math.max(min, startWidth + (startX - moveEv.clientX))))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [width, min, max],
  )

  return [width, startResize] as const
}
