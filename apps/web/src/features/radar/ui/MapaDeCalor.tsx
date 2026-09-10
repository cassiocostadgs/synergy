import { Icon, cx } from '@/components/ui'
import {
  MOTIVATOR_INFO,
  MOTIVATOR_SIGLA,
  faixaDaPosicao,
  type FaixaDePrioridade,
  type Motivator,
} from '@/features/motivators/motivators'
import type { MotivatorScore, RadarMember } from '@/features/radar/api/radarApi'
import { TEAM_ROLE_LABEL } from '@/types'

/**
 * Mapa de calor individual: uma linha por pessoa do time, uma coluna por
 * motivador, e a colocação que cada pessoa deu (1 a 10) na célula.
 *
 * As colunas seguem a ordem de força no time, não a ordem canônica: assim as
 * células verdes tendem a se agrupar à esquerda e quem discorda do time salta
 * aos olhos.
 */

/** Cores das faixas. Fundo saturado com texto escuro, para o número se ler. */
const FAIXA_ESTILO: Record<FaixaDePrioridade, string> = {
  alta: 'bg-success text-surface font-bold',
  media: 'bg-warning/85 text-surface',
  baixa: 'bg-danger/80 text-surface',
}

const FAIXA_LEGENDA: Array<{ faixa: FaixaDePrioridade; rotulo: string }> = [
  { faixa: 'alta', rotulo: 'Alta prioridade (1–3)' },
  { faixa: 'media', rotulo: 'Média (4–7)' },
  { faixa: 'baixa', rotulo: 'Baixa (8–10)' },
]

export function MapaDeCalor({
  membros,
  scores,
}: {
  membros: RadarMember[]
  scores: MotivatorScore[]
}) {
  const colunas: Motivator[] = scores.map((item) => item.motivator)

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-content">
          Mapa de calor individual
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {FAIXA_LEGENDA.map(({ faixa, rotulo }) => (
            <span key={faixa} className="flex items-center gap-1.5 text-[11px] text-content-muted">
              <span className={cx('size-2.5 rounded-sm', FAIXA_ESTILO[faixa])} />
              {rotulo}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-center text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface-container px-2 py-1.5 text-left text-[11px] font-semibold tracking-wide text-content-muted uppercase">
                Colaborador
              </th>
              {colunas.map((motivador, indice) => (
                <th
                  key={motivador}
                  // O nome completo fica no title: a sigla sozinha é opaca.
                  title={`${MOTIVATOR_INFO[motivador].nome} — ${indice + 1}º no time`}
                  className={cx(
                    'px-1.5 py-1.5 text-[11px] font-bold',
                    indice < 3 ? 'text-primary' : 'text-content-muted',
                  )}
                >
                  {MOTIVATOR_SIGLA[motivador]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {membros.map((membro) => (
              <tr key={membro.userId}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface-container px-2 py-1 text-left font-medium"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-content">{membro.name}</span>
                    <span className="text-[10px] whitespace-nowrap text-content-muted">
                      ({TEAM_ROLE_LABEL[membro.teamRole]})
                    </span>
                    {membro.needsReview ? (
                      <span
                        title={`Revisão vencida — respondido há ${membro.daysSinceAnswer} dias`}
                        className="flex items-center"
                      >
                        <Icon name="event_repeat" className="text-[14px] text-warning" />
                        <span className="sr-only">revisão vencida</span>
                      </span>
                    ) : null}
                  </span>
                </th>

                {colunas.map((motivador) => {
                  const posicao = membro.positions?.[motivador]

                  if (!posicao) {
                    return (
                      <td
                        key={motivador}
                        className="rounded-sm border border-dashed border-outline text-content-muted/50"
                      >
                        –
                      </td>
                    )
                  }

                  return (
                    <td
                      key={motivador}
                      title={`${membro.name} · ${MOTIVATOR_INFO[motivador].nome}: ${posicao}º`}
                      className={cx(
                        'rounded-sm px-1.5 py-1 tabular-nums',
                        FAIXA_ESTILO[faixaDaPosicao(posicao)],
                      )}
                    >
                      {posicao}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2.5 text-[11px] text-content-muted">
        Colunas ordenadas pela força no time. Linha tracejada indica quem ainda não respondeu; o
        ícone ao lado do nome marca revisão vencida.
      </p>
    </div>
  )
}
