import { useCallback, useEffect, useState } from 'react'

import {
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
import { radarApi, type MotivatorScore, type TeamMotivators } from '@/features/radar/api/radarApi'
import { GraficoRadar } from '@/features/radar/ui/GraficoRadar'
import { MapaDeCalor } from '@/features/radar/ui/MapaDeCalor'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useResource } from '@/hooks/useResource'
import type { Team } from '@/types'

/** Quantas posições ganham cartão de destaque ao lado do gráfico. */
const DESTAQUES = 3

/**
 * Radar: visão agregada dos Moving Motivators de um time (PRD seção 3.2.4).
 *
 * Traz o placar do time (gráfico e destaques) e o mapa de calor com o ranking
 * individual de cada membro.
 *
 * Motivadores são dado pessoal sensível, e é o controle de acesso que sustenta
 * essa exposição: apenas Admin e Gestor, e a API ainda exige que o Gestor seja
 * gestor daquele time específico. Colaborador não acessa.
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
        subtitle="O que move os colaboradores do time, a partir das respostas de Moving Motivators"
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
  const cobertura =
    data.membersTotal > 0 ? Math.round((data.membersAnswered / data.membersTotal) * 100) : 0
  const naoResponderam = data.pending.filter((membro) => !membro.answered)
  const revisaoVencida = data.pending.filter((membro) => membro.answered)

  // Time recém-criado só tem o Gestor Principal, que fica fora do Radar.
  if (data.membersTotal === 0) {
    return (
      <Card>
        <EmptyState
          icon="person_add"
          title="Este time ainda não tem colaboradores"
          description={`O Radar retrata os colaboradores do time — quem exerce papel de gestão fica fora. Adicione pessoas ao ${data.team.name} pelo painel de membros.`}
        />
      </Card>
    )
  }

  if (data.membersAnswered === 0) {
    return (
      <Card>
        <EmptyState
          icon="radar"
          title="Nenhum colaborador respondeu ainda"
          description={`O radar aparece quando ao menos um colaborador do ${data.team.name} preencher os motivadores no próprio perfil.`}
        />
      </Card>
    )
  }

  const destaques = data.scores.slice(0, DESTAQUES)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          compact
          label="Responderam"
          value={`${data.membersAnswered}/${data.membersTotal}`}
          hint={`${cobertura}% dos colaboradores`}
          icon="how_to_reg"
        />
        <KpiCard
          compact
          label="Move mais o time"
          value={MOTIVATOR_INFO[data.scores[0].motivator].nome}
          hint={`${data.scores[0].topCount} de ${data.membersAnswered} colocaram no top 3`}
          accent="secondary"
          icon="trending_up"
        />
        <KpiCard
          compact
          label="Revisões vencidas"
          value={revisaoVencida.length}
          hint={`revisar a cada ${data.reviewPeriodDays} dias`}
          icon="event_repeat"
        />
      </div>

      {/*
        Duas colunas de metade cada: gráfico com os destaques à esquerda, mapa
        de calor à direita. Empilhar os dois faria a página rolar.
      */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <GraficoRadar scores={data.scores} />

          <div className="mt-3 grid grid-cols-3 gap-2">
            {destaques.map((item, indice) => (
              <CartaoDeDestaque
                key={item.motivator}
                item={item}
                posicao={indice + 1}
                respondentes={data.membersAnswered}
              />
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <MapaDeCalor membros={data.members} scores={data.scores} />
        </Card>
      </div>

      {/* Faixa fina em vez de cartão com título: economiza altura. */}
      {data.pending.length > 0 ? (
        <Card className="flex flex-wrap items-center gap-2 p-3.5">
          <span className="text-[11px] font-semibold tracking-[0.16em] text-content-muted uppercase">
            Atenção
          </span>
          {naoResponderam.map((membro) => (
            <span
              key={membro.userId}
              className="flex items-center gap-1.5 rounded-full border border-outline bg-surface-dim px-2.5 py-0.5 text-xs text-content-muted"
            >
              <Icon name="pending" className="text-[14px]" />
              {membro.name} · nunca respondeu
            </span>
          ))}
          {revisaoVencida.map((membro) => (
            <span
              key={membro.userId}
              className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs text-warning"
            >
              <Icon name="event_repeat" className="text-[14px]" />
              {membro.name} · há {membro.daysSinceAnswer} dias
            </span>
          ))}
        </Card>
      ) : null}
    </div>
  )
}

/**
 * Destaque compacto de um dos três primeiros motivadores.
 *
 * Fica logo abaixo do gráfico, em três colunas estreitas — daí a ausência da
 * descrição do motivador, que está na tabela ao lado.
 */
function CartaoDeDestaque({
  item,
  posicao,
  respondentes,
}: {
  item: MotivatorScore
  posicao: number
  respondentes: number
}) {
  const info = MOTIVATOR_INFO[item.motivator]
  const primeiro = posicao === 1

  return (
    <div
      className={cx(
        'rounded-lg border px-2.5 py-2',
        primeiro
          ? 'border-primary/50 bg-primary-soft'
          : 'border-outline bg-surface-dim',
      )}
      title={`${info.nome}: ${info.desc}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cx(
            'flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
            primeiro ? 'bg-primary text-white' : 'bg-surface-container-high text-content-muted',
          )}
        >
          {posicao}
        </span>
        <p className="truncate text-xs font-semibold text-content">{info.nome}</p>
      </div>

      <p
        className={cx(
          'font-display mt-1 text-xl leading-none font-bold',
          primeiro ? 'text-primary' : 'text-secondary',
        )}
      >
        {item.score.toFixed(1)}
      </p>
      <p className="mt-0.5 text-[10px] text-content-muted">
        {item.topCount}/{respondentes} no top 3
      </p>
    </div>
  )
}
