import { useMemo, useState } from 'react'

import { Button, Card, ErrorBanner, Icon, PageHeader } from '@/components/ui'
import { Roleta } from '@/features/sorteio/ui/Roleta'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/** Limites que mantêm a roda legível e os rótulos dentro do setor. */
const MAX_CARACTERES = 20
const MIN_TEMAS = 2
const MAX_TEMAS = 24

const VOLTAS = 5
const DURACAO_MS = 4200

const EXEMPLO = ['Retrospectiva', 'Débito técnico', 'Metas do trimestre', 'Saúde do time'].join(
  '\n',
)

interface Validacao {
  temas: string[]
  erro: string | null
}

/** Uma linha por tema, ignorando linhas vazias e espaços nas pontas. */
function validar(texto: string): Validacao {
  const temas = texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)

  if (temas.length < MIN_TEMAS) {
    return { temas, erro: `Informe ao menos ${MIN_TEMAS} temas, um por linha.` }
  }
  if (temas.length > MAX_TEMAS) {
    return { temas, erro: `Máximo de ${MAX_TEMAS} temas — a roda fica ilegível acima disso.` }
  }

  const longos = temas.filter((tema) => tema.length > MAX_CARACTERES)
  if (longos.length > 0) {
    return {
      temas,
      erro:
        `Cada tema precisa ter até ${MAX_CARACTERES} caracteres. ` +
        `Passou do limite: ${longos.map((tema) => `"${tema}" (${tema.length})`).join(', ')}.`,
    }
  }

  const duplicados = temas.filter((tema, indice) => temas.indexOf(tema) !== indice)
  if (duplicados.length > 0) {
    return { temas, erro: `Há temas repetidos: ${[...new Set(duplicados)].join(', ')}.` }
  }

  return { temas, erro: null }
}

/**
 * Roleta de sorteio de temas. Utilitário sem persistência: a lista vive só nesta
 * tela, nada é gravado no backend.
 */
export function SorteioPage() {
  const [texto, setTexto] = useState(EXEMPLO)
  const [rotacao, setRotacao] = useState(0)
  const [girando, setGirando] = useState(false)
  const [sorteado, setSorteado] = useState<string | null>(null)
  const [erroDeGiro, setErroDeGiro] = useState<string | null>(null)

  const reduzirMovimento = usePrefersReducedMotion()
  const duracao = reduzirMovimento ? 0 : DURACAO_MS

  const { temas, erro } = useMemo(() => validar(texto), [texto])

  // Fora do giro a roda acompanha o campo em tempo real; durante o giro ela fica
  // congelada na lista que foi sorteada, para o resultado não divergir do que
  // está desenhado caso o texto seja editado no meio da animação.
  const [temasSorteados, setTemasSorteados] = useState<string[]>([])
  const temasNaRoda = girando ? temasSorteados : temas

  function handleGirar() {
    if (erro) {
      setErroDeGiro(erro)
      return
    }
    setErroDeGiro(null)
    setSorteado(null)
    setTemasSorteados(temas)

    // 1. Sorteia o vencedor.
    const vencedor = Math.floor(Math.random() * temas.length)

    // 2. Gira até ele: sempre para frente, parando com o centro do setor
    //    vencedor sob o ponteiro (topo da roda).
    const setor = 360 / temas.length
    const centroDoSetor = vencedor * setor + setor / 2
    setRotacao((atual) => {
      const restoAtual = ((atual % 360) + 360) % 360
      const alvo = ((-centroDoSetor % 360) + 360) % 360
      const delta = ((alvo - restoAtual) % 360 + 360) % 360
      return atual + 360 * VOLTAS + delta
    })

    if (duracao === 0) {
      // Sem animação (prefers-reduced-motion): não haverá transitionend.
      setSorteado(temas[vencedor])
      return
    }
    setGirando(true)
    setSorteado(temas[vencedor])
  }

  return (
    <>
      <PageHeader
        title="Sorteio de temas"
        subtitle="Gire a roda para escolher o tema da conversa. A lista não é salva — vale só para esta sessão."
      />

      {/*
        A roda fica na coluna elástica e o formulário numa faixa fixa: era o
        contrário, então toda largura extra da tela ia para o campo de texto —
        numa tela larga a roda continuava pequena ao lado de um textarea
        gigante. A roda é o que se olha; o campo se resolve em 18rem, e ganha
        um pouco mais só quando há folga (xl).

        Para a tela caber sem rolagem, cada cartão tem seu teto em `svh` em vez
        de a linha ter altura fixa: altura fixa esticaria os cartões e deixaria
        espaço morto em monitor alto, já que a roda para de crescer em 28rem.
        A referência dos cálculos é `13.5rem` — o que o app gasta acima e abaixo
        desta linha (cabeçalho 4rem, respiros do main 1.5rem + 2.5rem, título da
        página ~5rem).
      */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="flex flex-col items-center gap-5 p-6">
          {/*
            A roda é quadrada, então limitar a largura limita também a altura:
            28rem quando há folga, `100svh - 26rem` quando a altura é o que
            aperta (13.5rem de fora da linha + 12.5rem que o cartão gasta com
            padding, botão e área do resultado). O piso de 12rem evita que ela
            suma numa janela muito baixa; nesse caso a página volta a rolar, o
            que é melhor que uma roda ilegível.
          */}
          <Roleta
            className="max-w-[28rem] lg:max-w-[min(28rem,max(12rem,calc(100svh_-_26rem)))]"
            temas={temasNaRoda}
            rotacao={rotacao}
            duracaoMs={duracao}
            girando={girando}
            onFimDoGiro={() => setGirando(false)}
          />

          <Button
            icon="casino"
            onClick={handleGirar}
            disabled={girando}
            className="w-full max-w-xs"
          >
            {girando ? 'Girando…' : 'Girar a roda'}
          </Button>

          {/* aria-live: quem usa leitor de tela ouve o resultado sem ver a roda. */}
          <div aria-live="polite" className="min-h-16 w-full">
            {sorteado && !girando ? (
              <div className="rounded-xl border border-primary/50 bg-primary-soft px-4 py-3 text-center shadow-glow-primary">
                <p className="text-[13px] font-semibold tracking-[0.18em] text-content-muted uppercase">
                  Tema sorteado
                </p>
                <p className="font-display mt-1 text-xl font-bold text-primary">{sorteado}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-content-muted uppercase">
              Temas — um por linha
            </span>
            {/*
              `rows` é o tamanho natural; o teto em `svh` só entra em janela
              baixa, para o cartão dos temas não ser o que estoura a tela
              (13.5rem de fora da linha + 7.5rem do resto do cartão).
            */}
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              rows={12}
              spellCheck={false}
              className="w-full resize-y rounded-lg border border-outline bg-surface-dim px-3 py-2 text-sm text-content transition-shadow focus:border-primary focus:shadow-glow-primary focus:outline-none lg:max-h-[max(6rem,calc(100svh_-_21rem))]"
              placeholder={'Retrospectiva\nDébito técnico\nMetas do trimestre'}
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
            <span>
              Até {MAX_CARACTERES} caracteres por tema · de {MIN_TEMAS} a {MAX_TEMAS} temas
            </span>
            <span className="rounded-full border border-outline bg-surface-container-high px-2.5 py-0.5 font-semibold">
              {temas.length} {temas.length === 1 ? 'tema' : 'temas'}
            </span>
          </div>

          {erro ? (
            <div className="mt-4">
              <ErrorBanner message={erro} />
            </div>
          ) : null}
          {!erro && erroDeGiro ? (
            <div className="mt-4">
              <ErrorBanner message={erroDeGiro} />
            </div>
          ) : null}

          {reduzirMovimento ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-outline bg-surface-dim px-3 py-2 text-xs text-content-muted">
              <Icon name="info" className="text-[16px]" />
              Seu sistema pede movimento reduzido, então o resultado aparece sem a animação de
              giro.
            </p>
          ) : null}
        </Card>
      </div>
    </>
  )
}
