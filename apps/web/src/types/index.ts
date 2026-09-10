/** Papel global do usuário (PRD seção 2). AUDITOR está fora do escopo do MVP. */
export type Role = 'ADMIN' | 'GESTOR' | 'COLABORADOR'

/** Papel do usuário dentro de um time (PRD seção 4). */
export type TeamRole = 'GESTOR_PRINCIPAL' | 'GESTOR_APOIO' | 'COLABORADOR'

export type TeamStatus = 'ACTIVE' | 'ARCHIVED'

/** Usuário inativo não autentica e perde o acesso na hora (PRD seção 3.4). */
export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  createdAt: string
}

export interface Profile {
  hobby: string
  xp: number
  level: number
}

export interface Me {
  user: User
  profile: Profile
}

export interface LoginResult {
  token: string
  expiresAt: string
  user: User
}

export interface Team {
  id: string
  name: string
  status: TeamStatus
  /**
   * Papel de quem fez a requisição neste time. Ausente quando não é membro —
   * possível para o Admin, que enxerga todos os times.
   */
  myRole?: TeamRole
  createdAt: string
}

export interface TeamMember {
  userId: string
  name: string
  email: string
  role: TeamRole
}

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  GESTOR_PRINCIPAL: 'Gestor Principal',
  GESTOR_APOIO: 'Gestor de Apoio',
  COLABORADOR: 'Colaborador',
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  GESTOR: 'Gestor',
  COLABORADOR: 'Colaborador',
}

/** Gestores do time são os únicos que administram membros (Regra de Negócio 2). */
export function isTeamManager(role: TeamRole | undefined): boolean {
  return role === 'GESTOR_PRINCIPAL' || role === 'GESTOR_APOIO'
}
