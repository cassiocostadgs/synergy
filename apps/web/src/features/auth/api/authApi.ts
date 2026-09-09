import { apiFetch } from '@/services/httpClient'
import type { LoginResult, Me, Role, User } from '@/types'

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
}
