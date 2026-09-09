import { apiFetch } from '@/services/httpClient'
import type { Team, TeamMember, TeamRole } from '@/types'

export const teamsApi = {
  /** Admin vê todos os times; demais papéis veem apenas os seus. */
  list: () => apiFetch<Team[]>('/teams'),

  get: (teamId: string) => apiFetch<Team>(`/teams/${teamId}`),

  /** principalUserId é obrigatório para o Admin; o Gestor assume o time que cria. */
  create: (name: string, principalUserId?: string) =>
    apiFetch<Team>('/teams', {
      method: 'POST',
      body: principalUserId ? { name, principalUserId } : { name },
    }),

  update: (teamId: string, name: string) =>
    apiFetch<Team>(`/teams/${teamId}`, { method: 'PATCH', body: { name } }),

  archive: (teamId: string) =>
    apiFetch<Team>(`/teams/${teamId}/archive`, { method: 'POST' }),

  members: (teamId: string) => apiFetch<TeamMember[]>(`/teams/${teamId}/members`),

  addMember: (teamId: string, userId: string, role: TeamRole) =>
    apiFetch<TeamMember>(`/teams/${teamId}/members`, {
      method: 'POST',
      body: { userId, role },
    }),

  changeMemberRole: (teamId: string, userId: string, role: TeamRole) =>
    apiFetch<TeamMember>(`/teams/${teamId}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
    }),

  removeMember: (teamId: string, userId: string) =>
    apiFetch<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),

  /** Transferência de liderança: mantém sempre 1 Gestor Principal (RN1). */
  transferPrincipal: (teamId: string, userId: string) =>
    apiFetch<void>(`/teams/${teamId}/transfer-principal`, {
      method: 'POST',
      body: { userId },
    }),
}
