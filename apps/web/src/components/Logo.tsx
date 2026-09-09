import { useId } from 'react'

import { cx } from '@/components/ui'

/**
 * Identidade visual do Synergy.
 *
 * O símbolo é uma moldura hexagonal (linguagem de HUD) com duas circunferências
 * que se sobrepõem — rosa primário à esquerda, ciano secundário à direita — e a
 * interseção preenchida: sinergia como duas partes que, juntas, produzem algo
 * que nenhuma tinha sozinha.
 *
 * A composição é simétrica no eixo horizontal de propósito: o desenho anterior
 * usava três nós ligados em triângulo e a silhueta vertical resultante era
 * ambígua.
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

      {/* As duas partes */}
      <circle cx="12.8" cy="16" r="5.5" fill="none" stroke="#ff2d78" strokeWidth="1.6" />
      <circle cx="19.2" cy="16" r="5.5" fill="none" stroke="#00fbfb" strokeWidth="1.6" />

      {/* A interseção: o que só existe quando as duas se somam */}
      <path
        d="M16,11.527 A5.5,5.5 0 0 1 16,20.473 A5.5,5.5 0 0 1 16,11.527 Z"
        fill={`url(#${gradientId})`}
      />
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
