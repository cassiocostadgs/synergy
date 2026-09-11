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
import { useAuth } from '@/features/auth/hooks/useAuth'
import { MOTIVATOR_INFO } from '@/features/motivators/motivators'
import { radarApi, type MotivatorScore, type RadarBase } from '@/features/radar/api/radarApi'
import { GraficoRadar } from '@/features/radar/ui/GraficoRadar'
import { MapaDeCalor } from '@/features/radar/ui/MapaDeCalor'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useResource } from '@/hooks/useResource'
import { isTeamManager, type Team } from '@/types'

/** Quantas posições ganham cartão de destaque ao lado do gráfico. */
const DESTAQUES = 3

/**
 * Valor do seletor que representa "todos os meus times somados".
 *
 * Não é um id de time, e por isso precisa ser um valor que nenhum UUID assume.
 */
const TODOS_OS_TIMES = 'consolidado'

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
  const { me } = useAuth()
  const { teams, loading: carregandoTimes, error: erroTimes } = useTeams()
  const [teamId, setTeamId] = useState('')
  // '' significa "todos os colaboradores".
  const [colaboradorId, setColaboradorId] = useState('')

  const isAdmin = me?.user.role === 'ADMIN'

  /*
   * O seletor lista apenas os times cujo Radar o usuário realmente pode abrir.
   * Sem esse filtro, um Gestor que seja simples colaborador em outro time via
   * aquele time na lista e recebia 403 ao selecioná-lo — a listagem de times
   * traz todos os que a pessoa integra, não só os que ela gere.
   *
   * O Admin acessa qualquer time, inclusive os que não integra.
   */
  const ativos = teams.filter(
    (team) => team.status === 'ACTIVE' && (isAdmin || isTeamManager(team.myRole)),
  )

  // Seleciona o primeiro time assim que a lista chega.
  useEffect(() => {
    if (!teamId && ativos.length > 0) setTeamId(ativos[0].id)
  }, [teamId, ativos])

  const consolidado = teamId === TODOS_OS_TIMES

  const buscar = useCallback(
    () => (consolidado ? radarApi.consolidado() : radarApi.team(teamId)),
    [consolidado, teamId],
  )
  const { data, loading, error } = useResource<RadarBase>(buscar, teamId !== '')

  /*
   * Nome do escopo, para os textos da tela. Na visão consolidada não há "o
   * time": são vários, e dizer "adicione pessoas ao <time>" não faria sentido.
   */
  const escopo = consolidado
    ? `seus ${ativos.length} times`
    : (ativos.find((team) => team.id === teamId)?.name ?? 'time')

  const colaboradores = [...(data?.members ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  /*
   * A seleção é validada contra os membros do time atual em vez de zerada por
   * efeito ao trocar de time: se o escolhido não pertence a este time, o filtro
   * simplesmente não se aplica.
   */
  const selecionado = colaboradores.some((m) => m.userId === colaboradorId) ? colaboradorId : ''

  return (
    /*
      A tela inteira é uma coluna de altura de viewport, para não rolar. O que
      se desconta é o que fica FORA dela, e esse valor muda com o breakpoint:

        md  → 11rem: cabeçalho do app (4rem) + respiros do main (1rem em cima,
              6rem embaixo, reservados para a barra de navegação flutuante).
        lg  →  8rem: a barra flutuante dá lugar à lateral, e o respiro de baixo
              cai para 2.5rem.

      O título NÃO entra nesse cálculo de propósito: com os dois filtros ao
      lado, ele ocupa uma linha em telas largas e duas em telas estreitas, e
      subtrair um valor fixo erraria em uma das duas. Sendo item da coluna, a
      altura real dele é descontada sozinha.

      A altura é definida (`h`), não um mínimo: é o que dá ao flex espaço para
      distribuir, fazendo o gráfico encolher e o mapa de calor esticar. Com
      `min-h` não existe "sobra" a repartir — o conteúdo manda, o gráfico fica
      no tamanho natural e a página rola.

      `min-h-fit` é a válvula de escape: quando nem no piso de altura o gráfico
      couber, a coluna cresce além da tela e a página rola, em vez de o
      conteúdo vazar para fora dos cartões. Rolar é aceitável; layout quebrado,
      não.
    */
    <div className="md:flex md:h-[calc(100svh_-_11rem)] md:min-h-fit md:flex-col lg:h-[calc(100svh_-_8rem)]">
      <PageHeader
        title="Radar"
        // Curto de propósito: com os dois filtros ao lado, um subtítulo longo
        // quebra o cabeçalho em duas linhas a partir de 1280px e come 76px de
        // altura — justamente o que falta para o gráfico caber.
        subtitle="O que move os colaboradores, pelas respostas de Moving Motivators"
        // Aqui o subtítulo é explicação, não estado: pode sumir quando a altura
        // da janela é o recurso escasso.
        subtitleOptional
        actions={
          ativos.length > 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              {ativos.length > 1 ? (
                <div className="min-w-56">
                  <Select
                    label="Time"
                    value={teamId}
                    onChange={(event) => setTeamId(event.target.value)}
                  >
                    {/*
                      Primeiro da lista porque é a leitura mais ampla — quem
                      gere vários times costuma querer o conjunto antes do
                      recorte. A soma é feita no servidor.
                    */}
                    <option value={TODOS_OS_TIMES}>Todos os meus times ({ativos.length})</option>
                    {ativos.map((team: Team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {colaboradores.length > 0 ? (
                <div className="min-w-52">
                  <Select
                    label="Colaborador"
                    value={selecionado}
                    onChange={(event) => setColaboradorId(event.target.value)}
                  >
                    <option value="">Todos ({colaboradores.length})</option>
                    {colaboradores.map((membro) => (
                      <option key={membro.userId} value={membro.userId}>
                        {membro.name}
                        {membro.answered ? '' : ' — sem resposta'}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {erroTimes ? <ErrorBanner message={erroTimes} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {(carregandoTimes || loading) && !data ? <Spinner label="Montando o radar…" /> : null}

      {!carregandoTimes && ativos.length === 0 ? (
        <Card>
          {/*
            Distingue "não existe time" de "existem times, mas você não gere
            nenhum" — são situações diferentes e pedem ações diferentes.
          */}
          {teams.some((team) => team.status === 'ACTIVE') ? (
            <EmptyState
              icon="lock"
              title="Você não gere nenhum time ativo"
              description="O Radar é visível aos Gestores Principal e de Apoio do time. Você participa de time(s), mas como colaborador — nesse caso a visão do time fica com quem o gere."
            />
          ) : (
            <EmptyState
              icon="groups"
              title="Nenhum time ativo"
              description="O Radar mostra os motivadores dos colaboradores de um time. Crie um time e peça ao pessoal para responder a dinâmica no perfil."
            />
          )}
        </Card>
      ) : null}

      {data ? (
        <ConteudoDoRadar
          data={data}
          colaboradorId={selecionado}
          escopo={escopo}
          consolidado={consolidado}
          className="md:min-h-0 md:flex-1"
        />
      ) : null}
    </div>
  )
}

function ConteudoDoRadar({
  data,
  colaboradorId,
  escopo,
  consolidado,
  className,
}: {
  data: RadarBase
  colaboradorId: string
  /** Nome do time, ou "seus N times" na visão consolidada. */
  escopo: string
  consolidado: boolean
  className?: string
}) {
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
          title={consolidado ? 'Nenhum colaborador nos seus times' : 'Este time ainda não tem colaboradores'}
          description={`O Radar retrata os colaboradores — quem exerce papel de gestão fica fora. Adicione pessoas a ${escopo} pelo painel de membros.`}
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
          description={`O radar aparece quando ao menos um colaborador de ${escopo} preencher os motivadores no próprio perfil.`}
        />
      </Card>
    )
  }

  const destaques = data.scores.slice(0, DESTAQUES)

  const membrosFiltrados =
    colaboradorId === ''
      ? data.members
      : data.members.filter((m) => m.userId === colaboradorId)

  /*
   * Série individual sobreposta ao polígono do time.
   *
   * A conversão de colocação em força é a mesma da contagem de Borda do
   * backend: 1º lugar = 10 pontos. Com um respondente não há média a fazer,
   * então a conta cabe aqui sem duplicar a agregação do servidor.
   */
  const selecionadoNaLista = data.members.find((m) => m.userId === colaboradorId)
  const serieIndividual =
    selecionadoNaLista?.answered && selecionadoNaLista.positions
      ? {
          rotulo: selecionadoNaLista.name,
          forcas: data.scores.map((item) => {
            const posicao = selecionadoNaLista.positions?.[item.motivator]
            return posicao ? data.scores.length + 1 - posicao : 0
          }),
        }
      : undefined
  const selecionadoSemResposta =
    selecionadoNaLista && !selecionadoNaLista.answered ? selecionadoNaLista.name : null

  return (
    /*
      Coluna interna: os KPIs e a faixa de pendências ficam do tamanho que são,
      e o que sobra da altura vai para a linha do gráfico e da matriz. É o que
      dispensa adivinhar se a faixa de pendências existe — ela só aparece quando
      há alguém pendente.
    */
    <div className={cx('space-y-4 md:flex md:flex-col', className)}>
      {/*
        Em janela baixa os três cartões de KPI custam 113px — mais de um quarto
        da altura útil de um notebook 1280x800 com escala de 150%, onde a
        viewport tem ~440px. Abaixo desse limiar eles viram uma linha de texto
        com os mesmos três números: some o enfeite, não a informação.
      */}
      <p className="hidden shrink-0 flex-wrap items-center gap-x-3 text-xs text-content-muted [@media(max-height:760px)]:flex">
        <span>
          <strong className="text-content">
            {data.membersAnswered}/{data.membersTotal}
          </strong>{' '}
          responderam ({cobertura}%)
        </span>
        <span aria-hidden>·</span>
        <span>
          Move mais:{' '}
          <strong className="text-secondary">
            {MOTIVATOR_INFO[data.scores[0].motivator].nome}
          </strong>
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong className={revisaoVencida.length > 0 ? 'text-warning' : 'text-content'}>
            {revisaoVencida.length}
          </strong>{' '}
          {revisaoVencida.length === 1 ? 'revisão vencida' : 'revisões vencidas'}
        </span>
      </p>

      <div className="grid shrink-0 gap-3 sm:grid-cols-3 [@media(max-height:760px)]:hidden">
        <KpiCard
          compact
          label="Responderam"
          value={`${data.membersAnswered}/${data.membersTotal}`}
          hint={`${cobertura}% dos colaboradores`}
          icon="how_to_reg"
        />
        <KpiCard
          compact
          label={consolidado ? 'Move mais o conjunto' : 'Move mais o time'}
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
        de calor à direita.

        Esta linha fica com a altura que sobra da coluna: o gráfico se ajusta a
        ela e o mapa de calor rola por dentro, em vez de esticar a página.
      */}
      {/*
        `flex-1` sem `min-h-0`: a linha cresce com a sobra, mas não encolhe
        abaixo do que os cartões precisam. Com `min-h-0` ela cedia e os cartões
        passavam por cima da faixa de pendências numa janela baixa.
      */}
      <div className="grid gap-3 md:flex-1 md:grid-cols-2">
        {/*
          Sem `min-h-0` de propósito, ao contrário do cartão ao lado: o mapa de
          calor PODE encolher abaixo do conteúdo, porque rola por dentro; o
          gráfico não pode — autorizar isso era o que fazia o SVG vazar para
          fora do cartão numa janela baixa.
        */}
        <Card className="flex flex-col justify-center p-4">
          {/*
            O gráfico se ajusta ao espaço do cartão, não a uma conta de
            viewport: `flex-1` faz ele ocupar a sobra, e o piso de 10rem impede
            que o flex o esprema — sem o piso ele cedia espaço para os destaques
            e chegava a 75px de altura, praticamente sumindo.

            Medir por viewport era frágil porque o respiro inferior do `main`
            muda com o breakpoint (96px quando a barra flutuante existe, 40px
            quando a lateral aparece): a mesma conta errava em um dos dois.
          */}
          <div className="flex min-h-40 flex-1 items-center justify-center">
            <GraficoRadar
              scores={data.scores}
              individual={serieIndividual}
              className="max-h-full"
            />
          </div>

          {/* Legenda só faz sentido quando há duas séries no gráfico. */}
          {serieIndividual ? (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-content-muted">
                <span className="h-0.5 w-5 rounded bg-primary/60" />
                Time ({data.membersAnswered}{' '}
                {data.membersAnswered === 1 ? 'resposta' : 'respostas'})
              </span>
              <span className="flex items-center gap-1.5 text-secondary">
                <span className="h-0.5 w-5 rounded border-t-2 border-dashed border-secondary" />
                {serieIndividual.rotulo}
              </span>
            </div>
          ) : null}

          {selecionadoSemResposta ? (
            <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-content-muted">
              <Icon name="info" className="text-[14px]" />
              {selecionadoSemResposta} ainda não respondeu, então não há linha individual.
            </p>
          ) : null}

          {/*
            Os três destaques repetem o que o gráfico já mostra em rosa e o que
            a linha de KPIs diz em texto. Em janela baixa eles são os primeiros
            a sair: valem 72px que fazem falta ao gráfico e à matriz.
          */}
          <div className="mt-3 grid grid-cols-3 gap-2 [@media(max-height:760px)]:hidden">
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

        <Card className="flex min-h-0 flex-col overflow-hidden">
          {/*
            O filtro por nome recorta as linhas do mapa e acrescenta a série da
            pessoa ao gráfico. O que é do time — polígono, destaques e
            cobertura — não é recalculado sobre o subconjunto: isso daria a
            impressão de que o time é aquela pessoa, quando o filtro serve
            justamente para comparar uma pessoa com o time.
          */}
          <MapaDeCalor
            membros={membrosFiltrados}
            scores={data.scores}
            totalDeMembros={data.members.length}
            filtrado={colaboradorId !== ''}
            mostrarTime={consolidado}
          />
        </Card>
      </div>

      {/*
        Faixa fina em vez de cartão com título: economiza altura. O teto de
        altura com rolagem própria impede que uma lista grande de pendentes
        empurre o resto da tela para fora.
      */}
      {data.pending.length > 0 ? (
        <Card className="flex max-h-24 shrink-0 flex-wrap items-center gap-2 overflow-y-auto p-3.5">
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
