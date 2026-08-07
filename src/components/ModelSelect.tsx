import { useMemo } from 'react'
import { useOpenRouterModels, formatPrice } from '../hooks/useOpenRouterModels'
import { Input, Select } from './ui'

/** Dropdown über den OpenRouter-Katalog, gruppiert nach Anbieter, mit $-Preisen pro 1M Tokens.
 *  `disabled`/`title`/`className` sind optional und ohne Wirkung, wenn nicht übergeben — der
 *  Inspector (der sie nicht setzt) verhält sich dadurch unverändert; das Speech-Diagramm nutzt
 *  sie für ein kompaktes, während einer Session gesperrtes Dropdown. */
export function ModelSelect({
  id, value, onChange, disabled, title, className,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  title?: string
  className?: string
}) {
  const models = useOpenRouterModels()

  const groups = useMemo(() => {
    if (!models) return []
    const byProvider = new Map<string, typeof models>()
    for (const model of models) {
      const provider = model.id.startsWith('melious:')
        ? 'melious · EU'
        : model.id.includes('/')
          ? model.id.split('/')[0]
          : 'sonstige'
      const list = byProvider.get(provider) ?? []
      list.push(model)
      byProvider.set(provider, list)
    }
    return [...byProvider.entries()].sort(([a], [b]) => {
      // EU-Gruppe zuoberst, Rest alphabetisch
      if (a === 'melious · EU') return -1
      if (b === 'melious · EU') return 1
      return a.localeCompare(b)
    })
  }, [models])

  if (models === null) {
    return (
      <Input id={id} value={value} readOnly title={title ?? 'Modellkatalog wird geladen …'} disabled={disabled} className={className} />
    )
  }
  if (models.length === 0) {
    // Katalog nicht erreichbar (z. B. Backend aus) → Freitext bleibt möglich
    return (
      <Input
        id={id}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        disabled={disabled}
        title={title}
        className={className}
      />
    )
  }

  const known = models.some((model) => model.id === value)
  return (
    <Select id={id} value={value} onChange={(ev) => onChange(ev.target.value)} disabled={disabled} title={title} className={className}>
      {!known && value && <option value={value}>{value} (nicht im Katalog)</option>}
      {groups.map(([provider, list]) => (
        <optgroup key={provider} label={provider}>
          {list.map((model) => (
            <option key={model.id} value={model.id} title={`${model.name} · Kontext ${model.ctx.toLocaleString('de-DE')}`}>
              {model.id.startsWith('melious:')
                ? model.id.slice('melious:'.length)
                : model.id.includes('/')
                  ? model.id.split('/').slice(1).join('/')
                  : model.id} · ${formatPrice(model.in)}/${formatPrice(model.out)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}
