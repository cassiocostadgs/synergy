/**
 * Endereços e contas usadas pelos testes.
 *
 * As contas são as do seed de desenvolvimento (ver README da API). Os testes
 * NÃO assumem quais times existem nem quem é membro de quê — isso é descoberto
 * pela API em tempo de execução, para a suíte não quebrar quando o time de
 * demonstração mudar.
 */

export const URL_WEB = process.env.E2E_WEB_URL ?? 'http://localhost:5173'
export const URL_API = process.env.E2E_API_URL ?? 'http://localhost:8080'

export interface Usuario {
  nome: string
  email: string
  senha: string
  papel: 'ADMIN' | 'GESTOR' | 'COLABORADOR'
}

export const USUARIOS = {
  admin: {
    nome: 'Admin Synergy',
    email: 'admin@synergy.dev',
    senha: 'synergy123',
    papel: 'ADMIN',
  },
  /** Gestora Principal de time — é ela quem enxerga o Radar com dado. */
  gestora: {
    nome: 'Carla Lider',
    email: 'carla@synergy.dev',
    senha: 'synergy123',
    papel: 'GESTOR',
  },
  /** Papel global de Gestor, mas colaboradora dentro do time da Carla. */
  gestoraSemTime: {
    nome: 'Ana Lider',
    email: 'ana@synergy.dev',
    senha: 'synergy123',
    papel: 'GESTOR',
  },
  colaborador: {
    nome: 'Bruno Dev',
    email: 'bruno@synergy.dev',
    senha: 'synergy123',
    papel: 'COLABORADOR',
  },
} satisfies Record<string, Usuario>

/** Chave do token no armazenamento do navegador (ver services/httpClient.ts). */
export const CHAVE_DO_TOKEN = 'synergy.token'
