import { MOTIVATOR_INFO } from '@/features/motivators/motivators'
import type { MotivatorScore } from '@/features/radar/api/radarApi'

/**
 * Gráfico de radar dos motivadores do time, em SVG puro.
 *
 * O eixo vai de 0 a 10 porque o score já é uma média de pontos nessa escala
 * (contagem de Borda), então a área do polígono é comparável entre times de
 * tamanhos diferentes.
 */

const TAMANHO = 340
const CENTRO = TAMANHO / 2
const RAIO = 118
const ESCALA_MAXIMA = 10
const ANEIS = [0.25, 0.5, 0.75, 1]

function ponto(indice: number, total: number, distancia: number) {
  // Começa no topo (-90°) e caminha no sentido horário.
  const angulo = ((indice / total) * 360 - 90) * (Math.PI / 180)
  return {
    x: CENTRO + Math.cos(angulo) * distancia,
    y: CENTRO + Math.sin(angulo) * distancia,
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
      viewBox={`0 0 ${TAMANHO} ${TAMANHO}`}
      className="w-full max-w-[26rem]"
      role="img"
      aria-label="Gráfico de radar dos motivadores do time"
    >
      <defs>
        <linearGradient id="radar-area" x1="0" y1="0" x2={TAMANHO} y2={TAMANHO}>
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
        const rotulo = ponto(indice, total, RAIO + 26)
        const nome = MOTIVATOR_INFO[item.motivator].nome
        // Ancora o texto conforme o lado, para não invadir o gráfico.
        const ancora =
          rotulo.x > CENTRO + 6 ? 'start' : rotulo.x < CENTRO - 6 ? 'end' : 'middle'

        return (
          <g key={item.motivator}>
            <line
              x1={CENTRO}
              y1={CENTRO}
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
              fontSize="11"
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
          r="3.5"
          fill={indice < 3 ? '#ff2d78' : '#00fbfb'}
        />
      ))}
    </svg>
  )
}
