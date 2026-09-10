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

export interface TeamMotivators {
  team: Team
  membersTotal: number
  membersAnswered: number
  reviewPeriodDays: number
  scores: MotivatorScore[]
  /** Respostas individuais de todos do time, para o mapa de calor. */
  members: RadarMember[]
  pending: PendingMember[]
}

export const radarApi = {
  /** Radar de um time. Restrito aos Gestores do time e ao Admin. */
  team: (teamId: string) => apiFetch<TeamMotivators>(`/teams/${teamId}/motivators`),
}
