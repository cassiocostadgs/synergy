import { useCallback, useEffect, useState } from 'react'

import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Icon,
  KpiCard,
  PageHeader,
  Select,
  Spinner,
  cx,
} from '@/components/ui'
import { MOTIVATOR_INFO } from '@/features/motivators/motivators'
import { radarApi, type TeamMotivators } from '@/features/radar/api/radarApi'
import { GraficoRadar } from '@/features/radar/ui/GraficoRadar'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useResource } from '@/hooks/useResource'
import type { Team } from '@/types'

/**
 * Radar: visão agregada dos Moving Motivators de um time (PRD seção 3.2.5).
 *
 * Mostra o placar do time, não o ranking de cada pessoa. Motivação individual é
 * dado sensível, e o valor da visão para o gestor está no conjunto — quem
 * respondeu, o que move o time e quem está com a revisão vencida.
 *
 * Acesso restrito a Admin e Gestor; a API ainda exige que o Gestor seja gestor
 * daquele time específico.
 */
export function RadarPage() {
  const { teams, loading: carregandoTimes, error: erroTimes } = useTeams()
  const [teamId, setTeamId] = useState('')

  const ativos = teams.filter((team) => team.status === 'ACTIVE')

  // Seleciona o primeiro time assim que a lista chega.
  useEffect(() => {
    if (!teamId && ativos.length > 0) setTeamId(ativos[0].id)
  }, [teamId, ativos])

  const buscar = useCallback(() => radarApi.team(teamId), [teamId])
  const { data, loading, error } = useResource<TeamMotivators>(buscar, teamId !== '')

  return (
    <>
      <PageHeader
        title="Radar"
        subtitle="O que move o time, a partir das respostas de Moving Motivators"
        actions={
          ativos.length > 1 ? (
            <div className="min-w-52">
              <Select
                label="Time"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {ativos.map((team: Team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : undefined
        }
      />

      {erroTimes ? <ErrorBanner message={erroTimes} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {(carregandoTimes || loading) && !data ? <Spinner label="Montando o radar…" /> : null}

      {!carregandoTimes && ativos.length === 0 ? (
        <Card>
          <EmptyState
            icon="groups"
            title="Nenhum time ativo"
            description="O Radar mostra os motivadores agregados de um time. Crie um time e peça ao pessoal para responder a dinâmica no perfil."
          />
        </Card>
      ) : null}

      {data ? <ConteudoDoRadar data={data} /> : null}
    </>
  )
}

function ConteudoDoRadar({ data }: { data: TeamMotivators }) {
  const semRespostas = data.membersAnswered === 0
  const cobertura =
    data.membersTotal > 0 ? Math.round((data.membersAnswered / data.membersTotal) * 100) : 0
  const naoResponderam = data.pending.filter((membro) => !membro.answered)
  const revisaoVencida = data.pending.filter((membro) => membro.answered)

  if (semRespostas) {
    return (
      <Card>
        <EmptyState
          icon="radar"
          title="Ninguém do time respondeu ainda"
          description={`O radar aparece quando ao menos uma pessoa do ${data.team.name} preencher os motivadores no próprio perfil.`}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Responderam"
          value={`${data.membersAnswered}/${data.membersTotal}`}
          hint={`${cobertura}% do time`}
          icon="how_to_reg"
        />
        <KpiCard
          label="Move mais o time"
          value={MOTIVATOR_INFO[data.scores[0].motivator].nome}
          hint={`${data.scores[0].topCount} de ${data.membersAnswered} colocaram no top 3`}
          accent="secondary"
          icon="trending_up"
        />
        <KpiCard
          label="Revisões vencidas"
          value={revisaoVencida.length}
          hint={`recomendado revisar a cada ${data.reviewPeriodDays} dias`}
          icon="event_repeat"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
        <Card className="flex justify-center p-5">
          <GraficoComLegenda data={data} />
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-outline text-[13px] tracking-[0.14em] text-content-muted uppercase">
                  <th className="px-5 py-3 font-semibold">#</th>
                  <th className="px-5 py-3 font-semibold">Motivador</th>
                  <th className="px-5 py-3 font-semibold">Força</th>
                  <th className="px-5 py-3 text-right font-semibold">No top 3</th>
                </tr>
              </thead>
              <tbody>
                {data.scores.map((item, indice) => {
                  const info = MOTIVATOR_INFO[item.motivator]
                  const noTopo = indice < 3

                  return (
                    <tr
                      key={item.motivator}
                      className="border-b border-outline/60 transition-colors last:border-0 hover:bg-surface-container-high"
                    >
                      <td className="px-5 py-3">
                        <span
                          className={cx(
                            'flex size-6 items-center justify-center rounded-full text-[12px] font-bold',
                            noTopo
                              ? 'bg-primary text-white shadow-glow-primary'
                              : 'bg-surface-container-high text-content-muted',
                          )}
                        >
                          {indice + 1}º
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-content">{info.nome}</p>
                        <p className="text-xs text-content-muted">{info.desc}</p>
                      </td>
                      <td className="px-5 py-3">
                        {/* Barra proporcional ao score, que já vem na escala 0–10. */}
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-container-high">
                            <div
                              className={cx(
                                'h-full rounded-full',
                                noTopo ? 'bg-primary' : 'bg-secondary/70',
                              )}
                              style={{ width: `${(item.score / 10) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-content-muted">
                            {item.score.toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-content-muted">
                        {item.topCount}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {data.pending.length > 0 ? (
        <Card className="p-5">
          <h2 className="font-display mb-3 text-lg font-bold text-content">
            Precisam de atenção
          </h2>
          <div className="flex flex-wrap gap-2">
            {naoResponderam.map((membro) => (
              <span
                key={membro.userId}
                className="flex items-center gap-1.5 rounded-full border border-outline bg-surface-dim px-3 py-1 text-sm text-content-muted"
              >
                <Icon name="pending" className="text-[16px]" />
                {membro.name}
                <Badge tone="neutral">nunca respondeu</Badge>
              </span>
            ))}
            {revisaoVencida.map((membro) => (
              <span
                key={membro.userId}
                className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-sm text-warning"
              >
                <Icon name="event_repeat" className="text-[16px]" />
                {membro.name}
                <Badge tone="warning">há {membro.daysSinceAnswer} dias</Badge>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-content-muted">
            Cada pessoa responde no próprio perfil — os rankings individuais não são exibidos
            aqui.
          </p>
        </Card>
      ) : null}
    </div>
  )
}

function GraficoComLegenda({ data }: { data: TeamMotivators }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <GraficoRadar scores={data.scores} />
      <p className="max-w-[24rem] text-center text-xs text-content-muted">
        Cada eixo é um motivador; quanto mais longe do centro, mais o time é movido por ele. A
        escala vai de 1 a 10 e resulta da média das colocações de {data.membersAnswered}{' '}
        {data.membersAnswered === 1 ? 'pessoa' : 'pessoas'}.
      </p>
    </div>
  )
}
