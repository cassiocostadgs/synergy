import { Icon, cx } from '@/components/ui'
import { nomeDaRodada, type Partida } from '@/features/brackets/bracket'

/**
 * Desenho do chaveamento: uma coluna por rodada, uma partida por par de lados.
 *
 * Componente apresentacional — não decide nada, só reporta o clique. A chave é
 * derivada em `bracket.ts`.
 */
export function Chave({
  rodadas,
  onEscolher,
}: {
  rodadas: Partida[][]
  onEscolher: (partidaId: string, participante: string) => void
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-h-[26rem] gap-4 sm:gap-6">
        {rodadas.map((partidas, indice) => (
          <div key={indice} className="flex min-w-[13rem] flex-1 flex-col">
            <p className="mb-3 text-center text-[13px] font-semibold tracking-[0.16em] text-content-muted uppercase">
              {nomeDaRodada(partidas.length)}
            </p>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {partidas.map((partida) => (
                <CartaoDePartida key={partida.id} partida={partida} onEscolher={onEscolher} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CartaoDePartida({
  partida,
  onEscolher,
}: {
  partida: Partida
  onEscolher: (partidaId: string, participante: string) => void
}) {
  if (partida.bye) {
    const quemPassa = partida.a ?? partida.b
    return (
      <div className="rounded-xl border border-dashed border-outline bg-surface-dim/60 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-content">{quemPassa}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-content-muted">
          <Icon name="fast_forward" className="text-[14px]" />
          Passa direto
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-outline bg-surface-container">
      <LadoDaPartida partida={partida} lado={partida.a} onEscolher={onEscolher} />
      <div className="h-px bg-outline" />
      <LadoDaPartida partida={partida} lado={partida.b} onEscolher={onEscolher} />
    </div>
  )
}

function LadoDaPartida({
  partida,
  lado,
  onEscolher,
}: {
  partida: Partida
  lado: string | null
  onEscolher: (partidaId: string, participante: string) => void
}) {
  // Rodada seguinte com a partida anterior ainda em aberto.
  if (lado === null) {
    return (
      <div className="px-3 py-2.5 text-sm text-content-muted/70 italic">Aguardando…</div>
    )
  }

  const venceu = partida.vencedor === lado
  const decidida = partida.vencedor !== null

  return (
    <button
      type="button"
      onClick={() => onEscolher(partida.id, lado)}
      disabled={!partida.pronta}
      aria-pressed={venceu}
      className={cx(
        'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
        'disabled:cursor-not-allowed',
        venceu
          ? 'bg-primary-soft font-semibold text-primary'
          : decidida
            ? 'text-content-muted hover:bg-surface-container-high'
            : 'text-content hover:bg-surface-container-high',
      )}
    >
      <span className="flex-1 truncate">{lado}</span>
      {venceu ? <Icon name="check" className="text-[16px] text-primary" /> : null}
    </button>
  )
}
