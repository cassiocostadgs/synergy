/**
 * Lógica do jogo Brackets: monta o chaveamento e deriva as rodadas.
 *
 * Não tem dependências nem React de propósito — é lógica pura, o que a torna
 * verificável isoladamente.
 *
 * Decisão central: o número de participantes raramente é potência de 2. Em vez
 * de restringir a 2/4/8/16, a chave cresce até a próxima potência de 2 e a
 * diferença vira **bye** (passagem direta) na primeira rodada, como em torneio
 * real. Com 5 participantes, por exemplo, a chave tem 8 posições e 3 byes.
 */

export const MIN_PARTICIPANTES = 2
export const MAX_PARTICIPANTES = 16
export const MAX_CARACTERES = 40

export interface Partida {
  id: string
  rodada: number
  /**
   * Lado A. `null` tem dois significados, conforme a rodada: na primeira, é
   * ausência de adversário (bye); nas seguintes, é a partida anterior ainda
   * indefinida.
   */
  a: string | null
  b: string | null
  /** Escolhido; em bye já vem decidido. `null` enquanto não houver escolha. */
  vencedor: string | null
  /** Um lado sem adversário na primeira rodada: o outro avança sem disputa. */
  bye: boolean
  /** Ambos os lados conhecidos — só então é clicável. */
  pronta: boolean
}

/** Menor potência de 2 capaz de acomodar todos os participantes. */
export function tamanhoDaChave(participantes: number): number {
  let tamanho = 1
  while (tamanho < participantes) tamanho *= 2
  return tamanho
}

/**
 * Distribui os participantes nas posições da primeira rodada.
 *
 * Os primeiros da lista recebem os byes. Como a ordem já pode vir embaralhada,
 * isso equivale a sortear quem passa direto.
 */
export function montarSlots(participantes: string[]): (string | null)[] {
  const tamanho = tamanhoDaChave(participantes.length)
  const byes = tamanho - participantes.length
  const slots: (string | null)[] = []

  let proximo = 0
  for (let partida = 0; partida < tamanho / 2; partida++) {
    if (partida < byes) {
      slots.push(participantes[proximo++], null)
    } else {
      slots.push(participantes[proximo++], participantes[proximo++])
    }
  }

  return slots
}

/**
 * Deriva todas as rodadas a partir das posições iniciais e das escolhas feitas.
 *
 * A chave inteira é recalculada a cada render em vez de mutada. Isso resolve de
 * graça o caso difícil: ao trocar o vencedor de uma partida anterior, as
 * escolhas seguintes que dependiam do participante removido deixam
 * automaticamente de valer, porque o vencedor gravado não está mais entre os
 * dois lados da partida.
 */
export function derivarRodadas(
  slots: (string | null)[],
  escolhas: Record<string, string>,
): Partida[][] {
  const rodadas: Partida[][] = []
  let lados = slots
  let rodada = 0

  while (lados.length > 1) {
    const partidas: Partida[] = []

    for (let i = 0; i < lados.length; i += 2) {
      const a = lados[i] ?? null
      const b = lados[i + 1] ?? null
      const id = `r${rodada}-p${i / 2}`

      // Bye só existe na primeira rodada, onde `null` significa "sem
      // adversário". Nas rodadas seguintes `null` significa "aguardando a
      // partida anterior" — tratar isso como bye declararia um campeão sem
      // clique, bastando uma das semifinais estar decidida.
      const bye = rodada === 0 && (a !== null) !== (b !== null)
      let vencedor: string | null = null

      if (bye) {
        vencedor = a ?? b
      } else if (a !== null && b !== null) {
        const escolhido = escolhas[id]
        // Escolha só vale se ainda for um dos dois lados atuais.
        vencedor = escolhido === a || escolhido === b ? escolhido : null
      }

      partidas.push({
        id,
        rodada,
        a,
        b,
        vencedor,
        bye,
        pronta: a !== null && b !== null,
      })
    }

    rodadas.push(partidas)
    lados = partidas.map((partida) => partida.vencedor)
    rodada++
  }

  return rodadas
}

/** Nome da rodada conforme quantas partidas ela tem. */
export function nomeDaRodada(quantidadeDePartidas: number): string {
  switch (quantidadeDePartidas) {
    case 1:
      return 'Final'
    case 2:
      return 'Semifinal'
    case 4:
      return 'Quartas de final'
    case 8:
      return 'Oitavas de final'
    default:
      return `${quantidadeDePartidas} partidas`
  }
}

/** Campeão, quando a final já foi decidida. */
export function campeao(rodadas: Partida[][]): string | null {
  const final = rodadas.at(-1)
  return final?.[0]?.vencedor ?? null
}

/** Quantas partidas ainda faltam ser decididas. */
export function partidasPendentes(rodadas: Partida[][]): number {
  return rodadas.flat().filter((partida) => partida.vencedor === null).length
}

/** Embaralha sem alterar o array original (Fisher-Yates). */
export function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

export interface Validacao {
  participantes: string[]
  erro: string | null
}

/** Uma opção por linha, ignorando linhas vazias e espaços nas pontas. */
export function validar(texto: string): Validacao {
  const participantes = texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)

  if (participantes.length < MIN_PARTICIPANTES) {
    return {
      participantes,
      erro: `Informe ao menos ${MIN_PARTICIPANTES} opções, uma por linha.`,
    }
  }
  if (participantes.length > MAX_PARTICIPANTES) {
    return {
      participantes,
      erro: `O limite é ${MAX_PARTICIPANTES} opções (você informou ${participantes.length}).`,
    }
  }

  const longos = participantes.filter((item) => item.length > MAX_CARACTERES)
  if (longos.length > 0) {
    return {
      participantes,
      erro:
        `Cada opção precisa ter até ${MAX_CARACTERES} caracteres. ` +
        `Passou do limite: ${longos.map((item) => `"${item}" (${item.length})`).join(', ')}.`,
    }
  }

  const repetidos = participantes.filter((item, i) => participantes.indexOf(item) !== i)
  if (repetidos.length > 0) {
    return {
      participantes,
      erro: `Há opções repetidas: ${[...new Set(repetidos)].join(', ')}.`,
    }
  }

  return { participantes, erro: null }
}
