import { URL_API, type Usuario } from './dados'

/**
 * Cliente mínimo da API, usado pelos testes para preparar cenário e limpar o
 * que criaram — sem passar pela interface.
 *
 * Preparar estado pela tela deixa o teste lento e frágil: uma falha no formulário
 * de cadastro derrubaria o teste de Radar, que não tem nada a ver com isso.
 */

export interface RespostaDeErro {
  code: string
  message: string
}

export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(`${status} ${codigo}: ${mensagem}`)
    this.name = 'ErroDaApi'
  }
}

async function chamar<T>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown; token?: string } = {},
): Promise<T> {
  const resposta = await fetch(`${URL_API}/api/v1${caminho}`, {
    method: opcoes.metodo ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opcoes.token ? { Authorization: `Bearer ${opcoes.token}` } : {}),
    },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  })

  if (resposta.status === 204) return undefined as T

  const envelope = (await resposta.json()) as { data?: T; error?: RespostaDeErro }
  if (!resposta.ok) {
    throw new ErroDaApi(
      resposta.status,
      envelope.error?.code ?? 'DESCONHECIDO',
      envelope.error?.message ?? 'sem mensagem',
    )
  }
  return envelope.data as T
}

// --- Tipos do contrato (só o que os testes usam) ---

export interface TimeResumo {
  id: string
  name: string
  status: 'ACTIVE' | 'ARCHIVED'
  /** Papel de quem pediu a lista, dentro deste time. Vazio para Admin de fora. */
  myRole: string
}

export interface Membro {
  userId: string
  name: string
  role: string
}

export interface MembroDoRadar {
  userId: string
  name: string
  /** Só vem na visão consolidada, onde a matriz mistura times. */
  teamName?: string
  teamRole: string
  answered: boolean
  positions?: Record<string, number>
}

export interface RadarBase {
  scores: Array<{ motivator: string; score: number; topCount: number }>
  members: MembroDoRadar[]
  membersAnswered: number
  membersTotal: number
  pending: Array<{ userId: string; name: string }>
  reviewPeriodDays: number
}

export interface Radar extends RadarBase {
  team: { id: string; name: string }
}

/** Radar de todos os times que a pessoa gere, somados pelo servidor. */
export interface RadarConsolidado extends RadarBase {
  teams: Array<{ id: string; name: string }>
}

// --- Operações ---

export async function autenticar(usuario: Usuario): Promise<string> {
  const { token } = await chamar<{ token: string }>('/auth/login', {
    metodo: 'POST',
    corpo: { email: usuario.email, password: usuario.senha },
  })
  return token
}

export const api = {
  chamar,

  listarTimes: (token: string) => chamar<TimeResumo[]>('/teams', { token }),

  listarMembros: (token: string, timeId: string) =>
    chamar<Membro[]>(`/teams/${timeId}/members`, { token }),

  radar: (token: string, timeId: string) => chamar<Radar>(`/teams/${timeId}/motivators`, { token }),

  radarConsolidado: (token: string) => chamar<RadarConsolidado>('/teams/motivators', { token }),

  criarTime: (token: string, nome: string) =>
    chamar<TimeResumo>('/teams', { metodo: 'POST', corpo: { name: nome }, token }),

  arquivarTime: (token: string, timeId: string) =>
    chamar<TimeResumo>(`/teams/${timeId}/archive`, { metodo: 'POST', token }),

  adicionarMembro: (token: string, timeId: string, userId: string, papel: string) =>
    chamar<Membro>(`/teams/${timeId}/members`, {
      metodo: 'POST',
      corpo: { userId, role: papel },
      token,
    }),

  removerMembro: (token: string, timeId: string, userId: string) =>
    chamar<void>(`/teams/${timeId}/members/${userId}`, { metodo: 'DELETE', token }),

  listarUsuarios: (token: string) =>
    chamar<Array<{ id: string; name: string; email: string; role: string; status: string }>>(
      '/users',
      { token },
    ),
}

/**
 * Primeiro time que o usuário GERE (não apenas participa).
 *
 * É a mesma regra do seletor do Radar: quem é só colaborador em um time não
 * enxerga o Radar dele.
 */
export async function primeiroTimeQueGere(token: string): Promise<TimeResumo> {
  const times = await api.listarTimes(token)
  const gerido = times.find(
    (time) => time.status === 'ACTIVE' && time.myRole.startsWith('GESTOR'),
  )
  if (!gerido) {
    throw new Error('nenhum time ativo gerido por este usuário — cenário de teste incompleto')
  }
  return gerido
}

/**
 * Time gerido com mais gente no Radar — o que serve para testar filtro e
 * sobreposição.
 *
 * `primeiroTimeQueGere` devolve o primeiro da lista, que pode ser um time de um
 * colaborador só: nele, filtrar não reduz nada e o teste não provaria nada.
 */
export async function timeComRadarPopulado(
  token: string,
): Promise<{ time: TimeResumo; radar: Radar } | null> {
  const times = await api.listarTimes(token)
  const geridos = times.filter((t) => t.status === 'ACTIVE' && t.myRole.startsWith('GESTOR'))

  const radares = await Promise.all(
    geridos.map(async (time) => ({ time, radar: await api.radar(token, time.id) })),
  )

  const uteis = radares
    .filter(({ radar }) => radar.members.length >= 2 && radar.membersAnswered >= 1)
    .sort((a, b) => b.radar.members.length - a.radar.members.length)

  return uteis[0] ?? null
}
