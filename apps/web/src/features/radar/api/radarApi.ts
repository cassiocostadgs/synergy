import type { Motivator } from '@/features/motivators/motivators'
import { apiFetch } from '@/services/httpClient'
import type { Team, TeamRole } from '@/types'

export interface MotivatorScore {
  motivator: Motivator
  /** Média de pontos entre quem respondeu, de 1 a 10 (contagem de Borda). */
  score: number
  /** Colocação média — 1 é o topo. */
  averagePosition: number
  /** Quantas pessoas colocaram este motivador no próprio top 3. */
  topCount: number
}

/** Linha de uma pessoa no mapa de calor individual. */
export interface RadarMember {
  userId: string
  name: string
  /** Só vem na visão consolidada, onde a tabela mistura times. */
  teamName?: string
  teamRole: TeamRole
  answered: boolean
  /** Motivador -> colocação (1 a 10). Ausente para quem não respondeu. */
  positions?: Partial<Record<Motivator, number>>
  daysSinceAnswer?: number
  needsReview: boolean
}

export interface PendingMember {
  userId: string
  name: string
  /** false = nunca respondeu; true = respondeu, mas a revisão venceu. */
  answered: boolean
  daysSinceAnswer?: number
}

/**
 * O que as duas visões do Radar têm em comum — é sobre isto que a tela é
 * construída, para não haver dois caminhos de renderização.
 */
export interface RadarBase {
  membersTotal: number
  membersAnswered: number
  reviewPeriodDays: number
  scores: MotivatorScore[]
  /** Respostas individuais, para o mapa de calor. */
  members: RadarMember[]
  pending: PendingMember[]
}

export interface TeamMotivators extends RadarBase {
  team: Team
}

/** Radar de todos os times que a pessoa gere, somados. */
export interface ConsolidatedMotivators extends RadarBase {
  teams: Team[]
}

export const radarApi = {
  /** Radar de um time. Restrito aos Gestores do time e ao Admin. */
  team: (teamId: string) => apiFetch<TeamMotivators>(`/teams/${teamId}/motivators`),

  /**
   * Radar consolidado dos times que a pessoa gere (todos os ativos, para o
   * Admin). A soma é feita no servidor: cada pessoa conta uma vez, mesmo
   * participando de dois times, e quem gere qualquer um deles fica de fora.
   */
  consolidado: () => apiFetch<ConsolidatedMotivators>('/teams/motivators'),
}
