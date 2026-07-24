export type Route = 'sensibel' | 'rueckfrage' | 'blockiert' | 'normal'
export type Wertung = 'bestanden' | 'fn' | 'fp' | 'abweichung' | 'fehler'

export interface MetrikZeile {
  gesamt: number
  bestanden: number
  fn: number
  fp: number
  abweichung: number
  fehler: number
}

export interface Metriken extends MetrikZeile {
  fpRate: number
  proKlasse: Record<string, MetrikZeile>
  proAgeBand: Record<string, MetrikZeile>
  gateGruen: boolean
}

export function deriveIstRoute(result: { decision?: string; blocked?: boolean } | null | undefined): Route | null
export function bewerteFall(erwartet: Route, ist: Route | null | undefined): Wertung
export function aggregiereMetriken(
  items: Array<{ klasse: string; ageBand: string; erwartet: Route; wertung: Wertung }>,
): Metriken
