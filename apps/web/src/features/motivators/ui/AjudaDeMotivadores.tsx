import { useState } from 'react'

import { Button, Dialog, Icon } from '@/components/ui'
import {
  MOTIVATOR_INFO,
  MOTIVATOR_SIGLA,
  type Motivator,
} from '@/features/motivators/motivators'

/**
 * Guia do que significa cada motivador.
 *
 * Vive em `features/motivators` e não no Radar porque descreve a prática, não a
 * tela: o perfil pode abrir o mesmo guia sem duplicar texto.
 *
 * A ordem é a canônica do Management 3.0, não a do placar do time — quem abre o
 * guia quer consultar uma lista estável, não uma que muda a cada resposta nova.
 */
const ORDEM_CANONICA: Motivator[] = [
  'CURIOSIDADE',
  'HONRA',
  'ACEITACAO',
  'MAESTRIA',
  'PODER',
  'LIBERDADE',
  'RELACOES',
  'ORDEM',
  'PROPOSITO',
  'STATUS',
]

export function AjudaDeMotivadores() {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        icon="help"
        onClick={() => setAberto(true)}
        // Rótulo acessível próprio: o botão só tem ícone, e "?" não diz nada a
        // quem usa leitor de tela.
        aria-label="O que significa cada motivador"
        title="O que significa cada motivador"
        className="px-2.5"
      />

      <Dialog open={aberto} title="Os 10 motivadores" onClose={() => setAberto(false)}>
        <p className="mb-4 text-sm text-content-muted">
          Cada pessoa ordena os dez do mais ao menos importante para ela, no próprio perfil. O
          radar mostra a <strong className="text-content">média do time</strong>: o 1º lugar de
          cada pessoa vale 10 pontos e o 10º vale 1.
        </p>

        {/* Rola por dentro: a lista tem dez itens e o diálogo precisa caber em
            janela baixa. */}
        <ul className="max-h-[55svh] space-y-2.5 overflow-y-auto pr-1">
          {ORDEM_CANONICA.map((motivador) => {
            const info = MOTIVATOR_INFO[motivador]
            return (
              <li key={motivador} className="flex items-start gap-2.5">
                {/* A sigla é o que aparece nas colunas do mapa de calor — é ela
                    que o guia precisa decodificar. */}
                <span className="mt-0.5 w-10 shrink-0 rounded border border-outline bg-surface-dim py-0.5 text-center text-[11px] font-bold text-content-muted">
                  {MOTIVATOR_SIGLA[motivador]}
                </span>
                <p className="text-sm text-content-muted">
                  <strong className="text-content">{info.nome}:</strong> {info.desc}
                </p>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 flex items-start gap-2 rounded-lg border border-outline bg-surface-dim px-3 py-2 text-xs text-content-muted">
          <Icon name="info" className="text-[16px]" />
          Não existe ranking certo ou errado: a leitura útil é comparar o que move cada pessoa
          com o que o time oferece hoje.
        </p>
      </Dialog>
    </>
  )
}
