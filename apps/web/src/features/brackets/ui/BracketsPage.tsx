import { useMemo, useState, type FormEvent } from 'react'

import { Button, Card, ErrorBanner, Icon, Input, PageHeader } from '@/components/ui'
import {
  MAX_CARACTERES,
  MAX_PARTICIPANTES,
  MIN_PARTICIPANTES,
  campeao,
  derivarRodadas,
  embaralhar,
  montarSlots,
  partidasPendentes,
  tamanhoDaChave,
  validar,
} from '@/features/brackets/bracket'
import { Chave } from '@/features/brackets/ui/Chave'

const MAX_TEMA = 60

const EXEMPLO = [
  'Matrix',
  'Cidade de Deus',
  'Interestelar',
  'O Poderoso Chefão',
  'Clube da Luta',
  'Bacurau',
].join('\n')

/**
 * Brackets: dado um tema e até 16 opções, monta um chaveamento de eliminação
 * simples em que cada confronto é decidido com um clique, até sobrar o campeão.
 *
 * Utilitário sem persistência, como o Sorteio de Temas: a chave vive nesta tela
 * e se perde ao recarregar a página.
 */
export function BracketsPage() {
  const [tema, setTema] = useState('')
  const [texto, setTexto] = useState(EXEMPLO)
  const [embaralharAntes, setEmbaralharAntes] = useState(true)

  // slots === null significa que ainda estamos na tela de configuração.
  const [slots, setSlots] = useState<(string | null)[] | null>(null)
  const [temaEmJogo, setTemaEmJogo] = useState('')
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [erroAoCriar, setErroAoCriar] = useState<string | null>(null)

  const { participantes, erro } = useMemo(() => validar(texto), [texto])

  const rodadas = useMemo(
    () => (slots ? derivarRodadas(slots, escolhas) : []),
    [slots, escolhas],
  )
  const vencedor = campeao(rodadas)
  const pendentes = partidasPendentes(rodadas)

  function handleCriar(event: FormEvent) {
    event.preventDefault()
    if (erro) {
      setErroAoCriar(erro)
      return
    }
    if (tema.trim() === '') {
      setErroAoCriar('Informe o tema da disputa.')
      return
    }

    setErroAoCriar(null)
    setTemaEmJogo(tema.trim())
    setEscolhas({})
    setSlots(montarSlots(embaralharAntes ? embaralhar(participantes) : participantes))
  }

  function handleEscolher(partidaId: string, participante: string) {
    setEscolhas((atual) => ({ ...atual, [partidaId]: participante }))
  }

  if (slots) {
    return (
      <>
        <PageHeader
          title={temaEmJogo}
          subtitle={
            vencedor
              ? 'Disputa encerrada'
              : `${pendentes} ${pendentes === 1 ? 'confronto' : 'confrontos'} a decidir — clique no vencedor de cada um`
          }
          actions={
            <>
              <Button variant="ghost" icon="restart_alt" onClick={() => setEscolhas({})}>
                Recomeçar
              </Button>
              <Button variant="ghost" icon="tune" onClick={() => setSlots(null)}>
                Nova chave
              </Button>
            </>
          }
        />

        {/* aria-live: quem usa leitor de tela recebe o campeão sem ver a chave. */}
        <div aria-live="polite">
          {vencedor ? (
            <Card className="mb-6 border-primary/50 bg-primary-soft p-5 text-center shadow-glow-primary">
              <p className="text-[13px] font-semibold tracking-[0.18em] text-content-muted uppercase">
                Campeão
              </p>
              <p className="font-display mt-1 flex items-center justify-center gap-2 text-2xl font-bold text-primary">
                <Icon name="emoji_events" className="text-[26px]" />
                {vencedor}
              </p>
            </Card>
          ) : null}
        </div>

        <Card className="p-4 sm:p-6">
          <Chave rodadas={rodadas} onEscolher={handleEscolher} />
        </Card>
      </>
    )
  }

  const tamanho = participantes.length >= MIN_PARTICIPANTES ? tamanhoDaChave(participantes.length) : 0
  const byes = tamanho - participantes.length

  return (
    <>
      <PageHeader
        title="Brackets"
        subtitle="Informe um tema e as opções: o sistema monta o chaveamento e você decide cada confronto com um clique."
      />

      <Card className="max-w-2xl p-6 sm:p-8">
        <form onSubmit={handleCriar} className="space-y-5">
          <Input
            label="Tema da disputa"
            required
            maxLength={MAX_TEMA}
            value={tema}
            onChange={(event) => setTema(event.target.value)}
            placeholder="Melhor filme de todos os tempos"
          />

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-content-muted uppercase">
              Opções — uma por linha
            </span>
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full resize-y rounded-lg border border-outline bg-surface-dim px-3 py-2 text-sm text-content transition-shadow focus:border-primary focus:shadow-glow-primary focus:outline-none"
              placeholder={'Matrix\nCidade de Deus\nInterestelar'}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
            <span>
              De {MIN_PARTICIPANTES} a {MAX_PARTICIPANTES} opções · até {MAX_CARACTERES} caracteres
              cada
            </span>
            <span className="rounded-full border border-outline bg-surface-container-high px-2.5 py-0.5 font-semibold">
              {participantes.length}{' '}
              {participantes.length === 1 ? 'opção' : 'opções'}
            </span>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-content-muted">
            <input
              type="checkbox"
              checked={embaralharAntes}
              onChange={(event) => setEmbaralharAntes(event.target.checked)}
              className="size-4 accent-primary"
            />
            Embaralhar os confrontos da primeira rodada
          </label>

          {/*
            Explica o bye antes de acontecer: com um número que não é potência
            de 2, alguém necessariamente passa direto.
          */}
          {!erro && tamanho > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-outline bg-surface-dim px-3 py-2 text-xs text-content-muted">
              <Icon name="account_tree" className="text-[16px]" />
              <span>
                Chave de {tamanho} posições
                {byes > 0 ? (
                  <>
                    {' '}
                    — {byes} {byes === 1 ? 'opção passa' : 'opções passam'} direto na primeira
                    rodada, por não haver adversário
                  </>
                ) : (
                  ' — todas as opções se enfrentam desde a primeira rodada'
                )}
                . Serão {participantes.length - 1} confrontos até o campeão.
              </span>
            </p>
          ) : null}

          {erro ? <ErrorBanner message={erro} /> : null}
          {!erro && erroAoCriar ? <ErrorBanner message={erroAoCriar} /> : null}

          <div className="flex justify-end">
            <Button type="submit" icon="account_tree">
              Criar chaveamento
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
