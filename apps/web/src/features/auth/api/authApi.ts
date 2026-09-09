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

  /** Admin e Gestor podem listar usuários (o Gestor precisa montar seu time). */
  listUsers: () => apiFetch<User[]>('/users'),

  /** Cadastro de usuários é exclusivo do Admin (PRD seção 2). */
  createUser: (input: CreateUserInput) =>
    apiFetch<User>('/users', { method: 'POST', body: input }),
}
