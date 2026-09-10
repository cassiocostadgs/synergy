/** Os 10 motivadores da prática Moving Motivators (Management 3.0). */
export type Motivator =
  | 'CURIOSIDADE'
  | 'LIBERDADE'
  | 'PROPOSITO'
  | 'MAESTRIA'
  | 'RELACOES'
  | 'HONRA'
  | 'ACEITACAO'
  | 'ORDEM'
  | 'PODER'
  | 'STATUS'

export interface MotivatorRanking {
  order: Motivator[]
  /** false para quem nunca respondeu — a ordem vem só como ponto de partida. */
  answered: boolean
  updatedAt?: string
  /*
   * Contadores da regra de revisão, calculados pela API. O período não é
   * duplicado aqui de propósito: a regra tem uma única fonte da verdade.
   */
  daysSinceAnswer?: number
  daysUntilReview?: number
  reviewPeriodDays: number
  needsReview: boolean
}

/**
 * Rótulo e descrição de cada motivador. Vivem no frontend porque são texto de
 * apresentação; o backend guarda apenas o identificador.
 */
export const MOTIVATOR_INFO: Record<Motivator, { nome: string; desc: string }> = {
  CURIOSIDADE: { nome: 'Curiosidade', desc: 'espaço para aprender e testar novas ideias' },
  LIBERDADE: { nome: 'Liberdade', desc: 'autonomia para definir como e quando fazer' },
  PROPOSITO: { nome: 'Propósito', desc: 'conexão com uma causa ou objetivo maior' },
  MAESTRIA: { nome: 'Maestria', desc: 'desafios práticos para evoluir na área' },
  RELACOES: { nome: 'Relações', desc: 'boas conexões e espírito de equipe' },
  HONRA: { nome: 'Honra', desc: 'valores pessoais alinhados à empresa' },
  ACEITACAO: { nome: 'Aceitação', desc: 'aprovação e sentimento de pertencimento' },
  ORDEM: { nome: 'Ordem', desc: 'processos claros, regras e estabilidade' },
  PODER: { nome: 'Poder', desc: 'voz ativa para influenciar decisões' },
  STATUS: { nome: 'Status', desc: 'reconhecimento formal e prestígio' },
}

/** Quantas posições do topo recebem destaque visual. */
export const DESTAQUE_TOPO = 3

/** Move um item da lista para outra posição, sem alterar o array original. */
export function mover<T>(itens: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= itens.length || para >= itens.length) {
    return itens
  }
  const copia = [...itens]
  const [item] = copia.splice(de, 1)
  copia.splice(para, 0, item)
  return copia
}

/** Compara duas ordenações posição a posição. */
export function mesmaOrdem(a: Motivator[], b: Motivator[]): boolean {
  return a.length === b.length && a.every((item, indice) => item === b[indice])
}
