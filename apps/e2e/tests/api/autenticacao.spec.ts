import { expect, test } from '@playwright/test'

import { ErroDaApi, api, autenticar } from '../../src/api'
import { USUARIOS } from '../../src/dados'

/**
 * Contrato de autenticação, direto na API — sem navegador.
 *
 * Os testes unitários do Go já cobrem as regras; o que se verifica aqui é que
 * elas continuam valendo depois de passar por handler, middleware e envelope de
 * resposta, contra o PostgreSQL de verdade.
 */

test.describe('POST /auth/login', () => {
  test('credenciais válidas devolvem token e usuário', async () => {
    const token = await autenticar(USUARIOS.gestora)
    expect(token).not.toBe('')

    const times = await api.listarTimes(token)
    expect(Array.isArray(times)).toBe(true)
  })

  test('senha errada e e-mail inexistente dão a MESMA resposta', async ({ request }) => {
    const comSenhaErrada = await request.post('/api/v1/auth/login', {
      data: { email: USUARIOS.gestora.email, password: 'senha-errada-de-proposito' },
    })
    const comEmailInexistente = await request.post('/api/v1/auth/login', {
      data: { email: 'ninguem-mesmo@synergy.dev', password: 'senha-errada-de-proposito' },
    })

    expect(comSenhaErrada.status()).toBe(401)
    expect(comEmailInexistente.status()).toBe(401)

    // Mensagens idênticas de propósito: resposta diferente revelaria quais
    // e-mails existem no sistema.
    expect(await comSenhaErrada.json()).toEqual(await comEmailInexistente.json())
  })

  test('corpo sem senha é recusado como validação, não como credencial inválida', async ({
    request,
  }) => {
    const resposta = await request.post('/api/v1/auth/login', {
      data: { email: USUARIOS.gestora.email },
    })

    expect(resposta.status()).toBe(400)
    expect((await resposta.json()).error.code).toBe('VALIDATION')
  })
})

test.describe('rotas protegidas', () => {
  test('sem token devolvem 401 no envelope da API', async ({ request }) => {
    const resposta = await request.get('/api/v1/me')

    expect(resposta.status()).toBe(401)
    const corpo = await resposta.json()
    expect(corpo.error.code).toBe('UNAUTHORIZED')
    expect(corpo.data).toBeUndefined()
  })

  test('token adulterado devolve 401', async ({ request }) => {
    const token = await autenticar(USUARIOS.gestora)
    // Troca o último caractere: a assinatura deixa de bater.
    const adulterado = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')

    const resposta = await request.get('/api/v1/me', {
      headers: { Authorization: `Bearer ${adulterado}` },
    })

    expect(resposta.status()).toBe(401)
  })
})

test.describe('respostas fora do contrato', () => {
  test('rota inexistente responde 404 com envelope, não texto puro', async ({ request }) => {
    const resposta = await request.get('/api/v1/rota-que-nao-existe')

    expect(resposta.status()).toBe(404)
    expect((await resposta.json()).error.code).toBe('NOT_FOUND')
  })

  test('método não permitido responde 405 com corpo', async ({ request }) => {
    const resposta = await request.delete('/api/v1/auth/login')

    expect(resposta.status()).toBe(405)
    expect((await resposta.json()).error.code).toBe('METHOD_NOT_ALLOWED')
  })

  test('a raiz identifica o serviço', async ({ request }) => {
    const resposta = await request.get('/')

    expect(resposta.ok()).toBe(true)
    expect((await resposta.json()).data.service).toBe('Synergy API')
  })
})

test.describe('SSO da Microsoft', () => {
  test('token forjado nunca vira sessão', async ({ request }) => {
    const resposta = await request.post('/api/v1/auth/microsoft', {
      data: { idToken: 'isto-nao-e-um-token-do-entra' },
    })

    // 403 quando o SSO está desligado no ambiente, 401 quando está ligado e o
    // token não passa na validação. O que não pode, nunca, é 200.
    expect([401, 403]).toContain(resposta.status())
    expect((await resposta.json()).data).toBeUndefined()
  })

  test('campo desconhecido no corpo é recusado antes de qualquer coisa', async ({ request }) => {
    const resposta = await request.post('/api/v1/auth/microsoft', {
      data: { token: 'nome-errado-do-campo' },
    })

    expect(resposta.status()).toBe(400)
    expect((await resposta.json()).error.code).toBe('VALIDATION')
  })
})

test('erro da API chega tipado no cliente de teste', async () => {
  // Garante que o helper usado pelos demais testes traduz o envelope de erro —
  // se ele engolisse a falha, testes passariam sem ter feito nada.
  await expect(
    autenticar({ ...USUARIOS.gestora, senha: 'errada' }),
  ).rejects.toBeInstanceOf(ErroDaApi)
})
