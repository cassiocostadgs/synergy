import { useId } from 'react'

import { cx } from '@/components/ui'

/**
 * Identidade visual do Synergy.
 *
 * O símbolo é uma moldura hexagonal (linguagem de HUD) com três nós ligados em
 * triângulo — a ideia de sinergia: partes distintas conectadas formando um todo.
 * O nó de cima usa o rosa primário e os de baixo o ciano secundário, sobre um
 * traço em gradiente entre as duas cores do tema.
 */

type LogoSize = 'sm' | 'md' | 'lg'

const MARK_SIZE: Record<LogoSize, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-16',
}

const WORDMARK_SIZE: Record<LogoSize, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
}

/** Só o símbolo, sem o nome. Útil onde o espaço é curto. */
export function LogoMark({ size = 'md', className }: { size?: LogoSize; className?: string }) {
  // useId evita colisão de id do gradiente quando há mais de uma logo no DOM.
  const gradientId = useId()

  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Synergy"
      className={cx(
        MARK_SIZE[size],
        'shrink-0 drop-shadow-[0_0_7px_rgba(255,45,120,0.45)]',
        className,
      )}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff2d78" />
          <stop offset="100%" stopColor="#00fbfb" />
        </linearGradient>
      </defs>

      {/* Moldura hexagonal */}
      <polygon
        points="16,2.5 27.69,9.25 27.69,22.75 16,29.5 4.31,22.75 4.31,9.25"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />

      {/* Ligações entre os nós */}
      <path
        d="M16 9 L22.06 19.5 L9.94 19.5 Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity="0.5"
      />

      {/* Nós */}
      <circle cx="16" cy="9" r="2.7" fill="#ff2d78" />
      <circle cx="22.06" cy="19.5" r="2.7" fill="#00fbfb" />
      <circle cx="9.94" cy="19.5" r="2.7" fill="#00fbfb" />
    </svg>
  )
}

/** Símbolo + nome. `orientation="vertical"` empilha, usado na tela de login. */
export function Logo({
  size = 'md',
  orientation = 'horizontal',
  className,
}: {
  size?: LogoSize
  orientation?: 'horizontal' | 'vertical'
  className?: string
}) {
  const isVertical = orientation === 'vertical'

  return (
    <span
      className={cx(
        'flex items-center',
        isVertical ? 'flex-col gap-3' : 'gap-2.5',
        className,
      )}
    >
      <LogoMark size={size} />
      <span
        className={cx(
          'font-display leading-none font-bold text-content',
          WORDMARK_SIZE[size],
          // Orbitron já é larga; o tracking extra dá ar de letreiro sem apertar.
          'tracking-[0.14em] uppercase',
        )}
      >
        Synergy
      </span>
    </span>
  )
}
