import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

/** Schlanke shadcn-artige Basiskomponenten auf den Theme-Tokens. */

const cn = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ')

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'destructive'

const buttonVariants: Record<ButtonVariant, string> = {
  default:
    'border border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground',
  primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  destructive:
    'border border-destructive/40 bg-background text-destructive shadow-xs hover:bg-destructive/10',
}

export function Button({
  variant = 'default',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  )
}

const fieldBase =
  'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs transition-colors ' +
  'placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, 'h-8', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, 'resize-y', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, 'h-8 cursor-pointer bg-background', className)} {...props} />
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('font-mono text-[0.66rem] uppercase tracking-widest text-muted-foreground', className)}
      {...props}
    />
  )
}
