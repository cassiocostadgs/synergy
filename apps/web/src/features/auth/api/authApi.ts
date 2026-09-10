import { apiFetch } from '@/services/httpClient'
import type { LoginResult, Me, Role, User, UserStatus } from '@/types'

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: Role
  hobby?: string
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResult>('/auth/login', {
      method: 'POST',
      body: { email, password },
      anonymous: true,
    }),

  me: () => apiFetch<Me>('/me'),

  /** O usuário edita os próprios dados. E-mail e papel não são editáveis. */
  updateMe: (input: { name: string; hobby: string }) =>
    apiFetch<Me>('/me', { method: 'PATCH', body: input }),

  /** Troca da própria senha, exigindo a atual. */
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<void>('/me/password', {
      method: 'PATCH',
      body: { currentPassword, newPassword },
    }),

  /** Admin e Gestor podem listar usuários (o Gestor precisa montar seu time). */
  listUsers: () => apiFetch<User[]>('/users'),

  /** Cadastro de usuários é exclusivo do Admin (PRD seção 2). */
  createUser: (input: CreateUserInput) =>
    apiFetch<User>('/users', { method: 'POST', body: input }),

  /** Ativa ou inativa um acesso. Exclusivo do Admin (PRD seção 3.4). */
  setUserStatus: (userId: string, status: UserStatus) =>
    apiFetch<User>(`/users/${userId}/status`, { method: 'PATCH', body: { status } }),

  /** Altera o papel global de outro usuário. Exclusivo do Admin. */
  setUserRole: (userId: string, role: Role) =>
    apiFetch<User>(`/users/${userId}/role`, { method: 'PATCH', body: { role } }),

  /**
   * Redefine a senha de outro usuário, sem exigir a antiga. Exclusivo do Admin
   * e a única saída para quem perdeu a senha, já que não há recuperação por
   * e-mail. O Admin não redefine a própria por aqui.
   */
  resetUserPassword: (userId: string, newPassword: string) =>
    apiFetch<void>(`/users/${userId}/reset-password`, {
      method: 'POST',
      body: { newPassword },
    }),
}
