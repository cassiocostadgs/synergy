import { cx } from '@/components/ui'

/**
 * Roleta de sorteio (apresentacional).
 *
 * Não decide o vencedor: recebe a rotação já calculada pela página. O vencedor é
 * sorteado ANTES da animação e a roda é girada até ele — o contrário (medir o
 * ângulo final para descobrir quem ganhou) acumula erro de ponto flutuante e
 * pode apontar um setor diferente do resultado anunciado.
 */

/** Paleta dos setores, com a cor de texto que mantém contraste em cada uma. */
const SETORES = [
  { fundo: '#ff2d78', texto: '#ffffff' },
  { fundo: '#00fbfb', texto: '#071010' },
  { fundo: '#7c4dff', texto: '#ffffff' },
  { fundo: '#29e6a4', texto: '#071010' },
  { fundo: '#ffb02e', texto: '#071010' },
  { fundo: '#ff4d5e', texto: '#ffffff' },
  { fundo: '#4dabff', texto: '#071010' },
  { fundo: '#b45cff', texto: '#ffffff' },
] as const

/** Acima disso os rótulos ficam ilegíveis e só as cores são mostradas. */
const MAX_ROTULOS = 16

const CENTRO = 50
const RAIO = 48

function coordenada(anguloGraus: number, raio: number) {
  const rad = ((anguloGraus - 90) * Math.PI) / 180
  return {
    x: CENTRO + raio * Math.cos(rad),
    y: CENTRO + raio * Math.sin(rad),
  }
}

function caminhoDoSetor(indice: number, total: number): string {
  const setor = 360 / total
  const inicio = coordenada(indice * setor, RAIO)
  const fim = coordenada((indice + 1) * setor, RAIO)
  const arcoGrande = setor > 180 ? 1 : 0

  return [
    `M${CENTRO},${CENTRO}`,
    `L${inicio.x.toFixed(3)},${inicio.y.toFixed(3)}`,
    `A${RAIO},${RAIO} 0 ${arcoGrande} 1 ${fim.x.toFixed(3)},${fim.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

export function Roleta({
  temas,
  rotacao,
  duracaoMs,
  girando,
  onFimDoGiro,
  className,
}: {
  temas: string[]
  rotacao: number
  duracaoMs: number
  girando: boolean
  onFimDoGiro: () => void
  className?: string
}) {
  const total = temas.length
  const setor = total > 0 ? 360 / total : 360
  const mostrarRotulos = total <= MAX_ROTULOS
  // Rótulo longo em muitos setores precisa de fonte menor para não vazar.
  const tamanhoFonte = total <= 6 ? 4.2 : total <= 10 ? 3.6 : 3

  // O teto de largura existe para a roda não virar um disco de tela cheia em
  // monitor largo; abaixo dele ela acompanha a coluna onde está.
  return (
    <div className={cx('relative aspect-square w-full max-w-[34rem]', className)}>
      <svg
        viewBox="0 0 100 100"
        className="size-full drop-shadow-[0_0_18px_rgba(255,45,120,0.25)]"
        style={{
          transform: `rotate(${rotacao}deg)`,
          transition: duracaoMs > 0 ? `transform ${duracaoMs}ms cubic-bezier(0.16, 1, 0.3, 1)` : undefined,
        }}
        onTransitionEnd={onFimDoGiro}
        aria-hidden
      >
        {total === 0 ? (
          // Lista vazia: apenas o contorno, para a roda não desaparecer da tela.
          <circle
            cx={CENTRO}
            cy={CENTRO}
            r={RAIO}
            fill="none"
            stroke="#24312f"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : total === 1 ? (
          <circle cx={CENTRO} cy={CENTRO} r={RAIO} fill={SETORES[0].fundo} />
        ) : (
          temas.map((tema, indice) => (
            <path
              key={`${tema}-${indice}`}
              d={caminhoDoSetor(indice, total)}
              fill={SETORES[indice % SETORES.length].fundo}
              stroke="#071010"
              strokeWidth="0.4"
            />
          ))
        )}

        {mostrarRotulos
          ? temas.map((tema, indice) => {
              const meio = indice * setor + setor / 2
              // Na metade esquerda da roda o texto radial sairia de cabeça para
              // baixo, então ele é virado 180° em torno da própria posição.
              const inverter = meio > 90 && meio < 270
              const transform = [
                `rotate(${meio - 90} ${CENTRO} ${CENTRO})`,
                inverter ? `rotate(180 74 ${CENTRO})` : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <text
                  key={`rotulo-${tema}-${indice}`}
                  x={74}
                  y={CENTRO}
                  transform={transform}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={tamanhoFonte}
                  fontWeight={600}
                  fill={SETORES[indice % SETORES.length].texto}
                >
                  {tema}
                </text>
              )
            })
          : null}
      </svg>

      {/* Cubo central */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-outline-strong bg-surface-dim" />

      {/* Ponteiro fixo no topo: é ele que define o setor vencedor */}
      <svg
        viewBox="0 0 20 16"
        className={cx(
          'absolute -top-1 left-1/2 w-6 -translate-x-1/2 transition-transform',
          girando ? 'scale-110' : 'scale-100',
        )}
        aria-hidden
      >
        <polygon points="10,16 0,0 20,0" fill="#ff2d78" stroke="#071010" strokeWidth="1.2" />
      </svg>
    </div>
  )
}
