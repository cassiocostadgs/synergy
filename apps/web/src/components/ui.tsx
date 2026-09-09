/**
 * Componentes genéricos do Design System "Neon Tokyo" (DESIGN-SYSTEM.md seção 4).
 * Ficam aqui os blocos reutilizáveis por qualquer feature.
 */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Ícone do Material Symbols (usado na navegação e nas ações). */
export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cx('material-symbols-outlined', className)}>
      {name}
    </span>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:brightness-110 shadow-glow-primary border border-primary/60',
  secondary:
    'bg-secondary-soft text-secondary border border-secondary/40 hover:bg-secondary/20 hover:shadow-glow-secondary',
  ghost:
    'bg-transparent text-content-muted border border-outline hover:text-content hover:border-outline-strong',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: string
}

export function Button({
  variant = 'primary',
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
        'transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary',
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {icon ? <Icon name={icon} className="text-[18px]" /> : null}
      {children}
    </button>
  )
}

/** Card com vidro fosco e borda sutil (DESIGN-SYSTEM.md seção 4.1). */
export function Card({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-outline bg-surface-container/70 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Cartão de métrica (KPI Card) — rótulo em caixa alta + valor em destaque. */
export function KpiCard({
  label,
  value,
  hint,
  accent = 'primary',
  icon,
}: {
  label: string
  value: string | number
  hint?: string
  accent?: 'primary' | 'secondary'
  icon?: string
}) {
  const isPrimary = accent === 'primary'
  return (
    <Card
      className={cx(
        'p-5 transition-shadow',
        isPrimary ? 'hover:shadow-glow-primary' : 'hover:shadow-glow-secondary',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold tracking-[0.18em] text-content-muted uppercase">
          {label}
        </p>
        {icon ? (
          <Icon
            name={icon}
            className={cx('text-[20px]', isPrimary ? 'text-primary' : 'text-secondary')}
          />
        ) : null}
      </div>
      <p
        className={cx(
          'font-display mt-3 text-4xl font-bold tracking-tight',
          isPrimary ? 'text-primary' : 'text-secondary',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-content-muted">{hint}</p> : null}
    </Card>
  )
}

type BadgeTone = 'primary' | 'secondary' | 'neutral' | 'success' | 'warning'

const BADGE_TONES: Record<BadgeTone, string> = {
  primary: 'bg-primary-soft text-primary border-primary/40',
  secondary: 'bg-secondary-soft text-secondary border-secondary/40',
  neutral: 'bg-surface-container-high text-content-muted border-outline',
  success: 'bg-success/10 text-success border-success/40',
  warning: 'bg-warning/10 text-warning border-warning/40',
}

export function Badge({
  tone = 'neutral',
  children,
}: PropsWithChildren<{ tone?: BadgeTone }>) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] font-semibold tracking-wide uppercase',
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

/** Crachá circular com as iniciais (DESIGN-SYSTEM.md seção 4.4). */
export function Avatar({ name, tone = 'primary' }: { name: string; tone?: 'primary' | 'secondary' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span
      className={cx(
        'flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
        tone === 'primary'
          ? 'border-primary/40 bg-primary-soft text-primary'
          : 'border-secondary/40 bg-secondary-soft text-secondary',
      )}
    >
      {initials || '?'}
    </span>
  )
}

export function Input({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-content-muted uppercase">
        {label}
      </span>
      <input
        {...props}
        className={cx(
          'w-full rounded-lg border border-outline bg-surface-dim px-3 py-2 text-sm text-content',
          'placeholder:text-content-muted/60 focus:border-primary focus:outline-none',
          'focus:shadow-glow-primary transition-shadow',
          className,
        )}
      />
      {hint ? <span className="mt-1 block text-xs text-content-muted">{hint}</span> : null}
    </label>
  )
}

export function Select({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-content-muted uppercase">
        {label}
      </span>
      <select
        {...props}
        className={cx(
          'w-full rounded-lg border border-outline bg-surface-dim px-3 py-2 text-sm text-content',
          'focus:border-primary focus:outline-none',
          className,
        )}
      >
        {children}
      </select>
    </label>
  )
}

/** Faixa de erro usada nos formulários e telas de listagem. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      <Icon name="error" className="text-[18px]" />
      <span>{message}</span>
    </div>
  )
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-content-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      {label}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Icon name={icon} className="text-[40px] text-content-muted/60" />
      <div>
        <p className="font-semibold text-content">{title}</p>
        <p className="mt-1 max-w-md text-sm text-content-muted">{description}</p>
      </div>
      {action}
    </div>
  )
}

/** Cabeçalho de página com título, subtítulo e ações à direita. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-content">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-content-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}

/** Diálogo modal simples, usado nos formulários de time e de membro. */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 shadow-glow-primary">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-content">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-content-muted transition-colors hover:text-content"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </Card>
    </div>
  )
}
