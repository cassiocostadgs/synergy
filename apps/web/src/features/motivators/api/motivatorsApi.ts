import type { Motivator, MotivatorRanking } from '@/features/motivators/motivators'
import { apiFetch } from '@/services/httpClient'

export const motivatorsApi = {
  /** Ranking do próprio usuário. */
  get: () => apiFetch<MotivatorRanking>('/me/motivators'),

  /** PUT porque a ordenação é substituída por completo, nunca mesclada. */
  save: (order: Motivator[]) =>
    apiFetch<MotivatorRanking>('/me/motivators', { method: 'PUT', body: { order } }),
}
