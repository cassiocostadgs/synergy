import { MOTIVATOR_INFO } from '@/features/motivators/motivators'
import type { MotivatorScore } from '@/features/radar/api/radarApi'

/**
 * Gráfico de radar dos motivadores do time, em SVG puro.
 *
 * O eixo vai de 0 a 10 porque o score já é uma média de pontos nessa escala
 * (contagem de Borda), então a área do polígono é comparável entre times de
 * tamanhos diferentes.
 */

/*
 * Geometria do desenho.
 *
 * A área é mais larga que alta de propósito: os rótulos ficam fora dos eixos, e
 * os eixos quase horizontais empurram o texto para as bordas. Com um viewBox
 * quadrado, rótulos como "Curiosidade" saíam da área visível.
 *   Largura mínima = 2 × (RAIO + DISTANCIA_ROTULO + largura do maior rótulo)
 *
 * TAMANHO_ROTULO é grande em unidades do viewBox porque texto em SVG escala com
 * o container: como o gráfico é renderizado compacto, uma fonte "normal" aqui
 * chegaria ilegível na tela.
 */
const LARGURA = 460
const ALTURA = 300
const CENTRO_X = LARGURA / 2
const CENTRO_Y = ALTURA / 2
const RAIO = 100
const DISTANCIA_ROTULO = 20
const TAMANHO_ROTULO = 16
const ESCALA_MAXIMA = 10
const ANEIS = [0.25, 0.5, 0.75, 1]

function ponto(indice: number, total: number, distancia: number) {
  // Começa no topo (-90°) e caminha no sentido horário.
  const angulo = ((indice / total) * 360 - 90) * (Math.PI / 180)
  return {
    x: CENTRO_X + Math.cos(angulo) * distancia,
    y: CENTRO_Y + Math.sin(angulo) * distancia,
  }
}

export function GraficoRadar({ scores }: { scores: MotivatorScore[] }) {
  const total = scores.length
  if (total === 0) return null

  const vertices = scores.map((item, indice) =>
    ponto(indice, total, (Math.max(0, item.score) / ESCALA_MAXIMA) * RAIO),
  )
  const area = vertices.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="w-full"
      role="img"
      aria-label="Gráfico de radar dos motivadores do time"
    >
      <defs>
        <linearGradient id="radar-area" x1="0" y1="0" x2={LARGURA} y2={ALTURA}>
          <stop offset="0%" stopColor="#ff2d78" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#00fbfb" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* Anéis de referência */}
      {ANEIS.map((fracao) => (
        <polygon
          key={fracao}
          points={scores
            .map((_, indice) => {
              const p = ponto(indice, total, RAIO * fracao)
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
            })
            .join(' ')}
          fill="none"
          stroke="#24312f"
          strokeWidth="1"
        />
      ))}

      {/* Eixos e rótulos */}
      {scores.map((item, indice) => {
        const fim = ponto(indice, total, RAIO)
        const rotulo = ponto(indice, total, RAIO + DISTANCIA_ROTULO)
        const nome = MOTIVATOR_INFO[item.motivator].nome
        // Ancora o texto conforme o lado, para não invadir o gráfico.
        const ancora =
          rotulo.x > CENTRO_X + 6 ? 'start' : rotulo.x < CENTRO_X - 6 ? 'end' : 'middle'

        return (
          <g key={item.motivator}>
            <line
              x1={CENTRO_X}
              y1={CENTRO_Y}
              x2={fim.x}
              y2={fim.y}
              stroke="#24312f"
              strokeWidth="1"
            />
            <text
              x={rotulo.x}
              y={rotulo.y}
              textAnchor={ancora}
              dominantBaseline="middle"
              fontSize={TAMANHO_ROTULO}
              fontWeight={indice < 3 ? 700 : 500}
              fill={indice < 3 ? '#ff2d78' : '#c2d5d2'}
            >
              {nome}
            </text>
          </g>
        )
      })}

      {/* Área do time */}
      <polygon
        points={area}
        fill="url(#radar-area)"
        stroke="#ff2d78"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Vértices */}
      {vertices.map((v, indice) => (
        <circle
          key={scores[indice].motivator}
          cx={v.x}
          cy={v.y}
          r="4"
          fill={indice < 3 ? '#ff2d78' : '#00fbfb'}
        />
      ))}
    </svg>
  )
}
