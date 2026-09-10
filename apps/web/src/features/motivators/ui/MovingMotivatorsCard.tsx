import { useCallback, useEffect, useState, type DragEvent } from 'react'

import { Button, Card, ErrorBanner, Icon, Spinner, cx } from '@/components/ui'
import { motivatorsApi } from '@/features/motivators/api/motivatorsApi'
import {
  DESTAQUE_TOPO,
  MOTIVATOR_INFO,
  mesmaOrdem,
  mover,
  type Motivator,
  type MotivatorRanking,
} from '@/features/motivators/motivators'
import { useResource } from '@/hooks/useResource'
import { ApiError } from '@/services/httpClient'

/**
 * Faixa de estado da resposta: quando foi feita, quanto falta para a próxima
 * revisão, ou o aviso de que já venceu.
 *
 * Todos os números vêm da API — o período de revisão não é recalculado aqui.
 */
function AvisoDeRevisao({ ranking }: { ranking: MotivatorRanking }) {
  const { answered, needsReview, daysSinceAnswer, daysUntilReview, reviewPeriodDays } = ranking

  if (!answered) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-secondary/40 bg-secondary-soft px-3 py-2 text-sm text-secondary">
        <Icon name="info" className="text-[18px]" />
        <span>
          Você ainda não respondeu esta dinâmica. Depois de responder, o recomendado é revisar a
          cada {reviewPeriodDays} dias.
        </span>
      </div>
    )
  }

  const dias = daysSinceAnswer ?? 0
  const rotuloDeQuando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`

  if (needsReview) {
    const atrasado = dias - reviewPeriodDays
    return (
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning">
        <Icon name="event_repeat" className="text-[18px]" />
        <span>
          <strong>Hora de revisar.</strong> Você respondeu {rotuloDeQuando} e o recomendado é
          refazer a cada {reviewPeriodDays} dias
          {atrasado > 0 ? ` (${atrasado} ${atrasado === 1 ? 'dia' : 'dias'} de atraso)` : ''}.
          Motivação muda com o tempo.
        </span>
      </div>
    )
  }

  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-outline bg-surface-dim px-3 py-2 text-xs text-content-muted">
      <Icon name="event_available" className="text-[16px]" />
      <span>
        Respondido {rotuloDeQuando}
        {daysUntilReview !== undefined
          ? ` · próxima revisão em ${daysUntilReview} ${daysUntilReview === 1 ? 'dia' : 'dias'}`
          : ''}
      </span>
    </div>
  )
}

/**
 * Moving Motivators (PRD seção 3.2.3): a pessoa ordena os 10 motivadores
 * conforme as próprias prioridades.
 *
 * A reordenação tem dois caminhos de propósito: arrastar e as setas. Só o
 * arraste deixaria a dinâmica inacessível para quem usa teclado ou leitor de
 * tela — e é o caminho que falha em tela sensível ao toque.
 */
export function MovingMotivatorsCard() {
  const buscar = useCallback(() => motivatorsApi.get(), [])
  const { data, loading, error, reload } = useResource<MotivatorRanking>(buscar)

  const [ordem, setOrdem] = useState<Motivator[]>([])
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  // Alinha a lista local com o que veio da API (e com o que foi salvo).
  useEffect(() => {
    if (data) setOrdem(data.order)
  }, [data])

  const alterado = data ? !mesmaOrdem(ordem, data.order) : false

  function reordenar(de: number, para: number) {
    setOrdem((atual) => mover(atual, de, para))
    setSalvo(false)
  }

  function handleDragStart(indice: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      setArrastando(indice)
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  function handleDrop(indice: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault()
      if (arrastando !== null && arrastando !== indice) {
        reordenar(arrastando, indice)
      }
      setArrastando(null)
    }
  }

  async function salvar() {
    setErroAoSalvar(null)
    setSalvando(true)
    try {
      await motivatorsApi.save(ordem)
      await reload()
      setSalvo(true)
    } catch (err) {
      setErroAoSalvar(err instanceof ApiError ? err.message : 'Não foi possível salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold text-content">O que te move no trabalho?</h2>
        <p className="mt-1 text-sm text-content-muted">
          Ordene seus motivadores pessoais conforme suas prioridades atuais. Arraste os itens ou
          use as setas.
        </p>
      </div>

      {data ? <AvisoDeRevisao ranking={data} /> : null}

      {loading && ordem.length === 0 ? <Spinner label="Carregando motivadores…" /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {ordem.length > 0 ? (
        <>
          <ul className="space-y-1.5">
            {ordem.map((motivador, indice) => {
              const info = MOTIVATOR_INFO[motivador]
              const noTopo = indice < DESTAQUE_TOPO

              return (
                <li
                  key={motivador}
                  draggable
                  onDragStart={handleDragStart(indice)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop(indice)}
                  onDragEnd={() => setArrastando(null)}
                  className={cx(
                    'flex cursor-grab items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    arrastando === indice
                      ? 'border-dashed border-primary opacity-50'
                      : 'border-outline bg-surface-dim hover:bg-surface-container-high',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cx(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                        noTopo
                          ? 'bg-primary text-white shadow-glow-primary'
                          : 'bg-surface-container-high text-content-muted',
                      )}
                    >
                      {indice + 1}º
                    </span>
                    {/* Uma linha por item mantém os 10 visíveis sem rolagem; o
                        title devolve a descrição inteira quando ela é cortada. */}
                    <p
                      title={`${info.nome}: ${info.desc}`}
                      className="truncate text-sm text-content-muted"
                    >
                      <strong className="text-content">{info.nome}:</strong> {info.desc}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => reordenar(indice, indice - 1)}
                      disabled={indice === 0}
                      aria-label={`Subir ${info.nome}`}
                      className="flex size-6 items-center justify-center rounded text-content-muted transition-colors hover:bg-surface-container-high hover:text-content disabled:opacity-20"
                    >
                      <Icon name="keyboard_arrow_up" className="text-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => reordenar(indice, indice + 1)}
                      disabled={indice === ordem.length - 1}
                      aria-label={`Descer ${info.nome}`}
                      className="flex size-6 items-center justify-center rounded text-content-muted transition-colors hover:bg-surface-container-high hover:text-content disabled:opacity-20"
                    >
                      <Icon name="keyboard_arrow_down" className="text-[18px]" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {erroAoSalvar ? (
            <div className="mt-4">
              <ErrorBanner message={erroAoSalvar} />
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <div aria-live="polite" className="mr-auto">
              {salvo && !alterado ? (
                <span className="flex items-center gap-1.5 text-sm text-success">
                  <Icon name="check_circle" className="text-[18px]" />
                  Perfil salvo.
                </span>
              ) : null}
            </div>

            {alterado ? (
              <Button variant="ghost" icon="undo" onClick={() => data && setOrdem(data.order)}>
                Desfazer
              </Button>
            ) : null}
            <Button icon="save" onClick={() => void salvar()} disabled={salvando || !alterado}>
              {salvando ? 'Salvando…' : 'Salvar perfil'}
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  )
}
