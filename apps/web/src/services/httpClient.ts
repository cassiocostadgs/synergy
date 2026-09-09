/**
 * Cliente HTTP global. A API responde sempre no envelope { data } | { error },
 * então centralizamos aqui o desempacotamento e a tradução de erros.
 */

/*
 * Base da API. VITE_API_URL é resolvida no build (o Vite substitui pelo literal),
 * não em runtime.
 *
 * A barra final é removida de propósito: sem isso, "https://api.exemplo.com/"
 * geraria "…com//api/v1" e o valor "/" geraria "//api/v1", que o navegador trata
 * como outro host (URL protocol-relative). Deixar a variável vazia é o jeito de
 * apontar para a mesma origem do frontend.
 */
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')
const TOKEN_KEY = 'synergy.token'

interface ApiEnvelope<T> {
  data?: T
  error?: { code: string; message: string }
}

/** Erro de API já traduzido, com o código de negócio devolvido pelo backend. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Rotas públicas (login) não enviam o Authorization. */
  anonymous?: boolean
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (!anonymous) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Não foi possível falar com o servidor', 0, 'NETWORK')
  }

  if (response.status === 204) {
    return undefined as T
  }

  let payload: ApiEnvelope<T> = {}
  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    if (!response.ok) {
      throw new ApiError('Erro inesperado do servidor', response.status, 'INTERNAL')
    }
  }

  if (!response.ok || payload.error) {
    const message = payload.error?.message ?? 'Erro inesperado do servidor'
    const code = payload.error?.code ?? 'INTERNAL'

    // Sessão expirada: limpamos o token para o app voltar ao login.
    if (response.status === 401) {
      setToken(null)
    }
    throw new ApiError(message, response.status, code)
  }

  return payload.data as T
}
