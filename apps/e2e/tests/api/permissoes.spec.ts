import { expect, test } from '@playwright/test'

import { ErroDaApi, api, autenticar, primeiroTimeQueGere } from '../../src/api'
import { USUARIOS } from '../../src/dados'

/**
 * RBAC pela API (PRD seção 2 e RN2).
 *
 * A interface esconde o que a pessoa não pode fazer, mas esconder não é
 * proteger: aqui as chamadas são feitas direto, sem passar pela tela.
 */

test.describe('Colaborador', () => {
  test('não lista usuários', async () => {
    const token = await autenticar(USUARIOS.colaborador)

    await expect(api.listarUsuarios(token)).rejects.toMatchObject({ status: 403 })
  })

  test('não abre o Radar de um time que integra', async () => {
    const tokenGestora = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(tokenGestora)

    const tokenColaborador = await autenticar(USUARIOS.colaborador)
    await expect(api.radar(tokenColaborador, time.id)).rejects.toMatchObject({ status: 403 })
  })

  test('não cria time', async () => {
    const token = await autenticar(USUARIOS.colaborador)

    await expect(api.criarTime(token, 'Time que não deve nascer')).rejects.toMatchObject({
      status: 403,
    })
  })
})

test.describe('Gestor', () => {
  test('abre o Radar do time que gere', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)

    const radar = await api.radar(token, time.id)
    expect(radar.team.id).toBe(time.id)
  })

  test('NÃO abre o Radar de time em que é apenas colaborador', async () => {
    // Regressão: a listagem de times devolve todos os que a pessoa integra.
    // Antes de `myRole` existir, o seletor do Radar oferecia esses times e a
    // escolha terminava em 403 na cara do usuário.
    const token = await autenticar(USUARIOS.gestora)
    const times = await api.listarTimes(token)

    const soParticipa = times.find((time) => time.myRole === 'COLABORADOR')
    test.skip(!soParticipa, 'a gestora não é colaboradora em nenhum time neste ambiente')

    await expect(api.radar(token, soParticipa!.id)).rejects.toMatchObject({ status: 403 })
  })

  test('lista usuários, porque precisa montar o time', async () => {
    const token = await autenticar(USUARIOS.gestora)

    const usuarios = await api.listarUsuarios(token)
    expect(usuarios.length).toBeGreaterThan(0)
  })
})

test.describe('Admin', () => {
  test('enxerga todos os times, inclusive os que não integra', async () => {
    const tokenAdmin = await autenticar(USUARIOS.admin)
    const tokenGestora = await autenticar(USUARIOS.gestora)

    const [doAdmin, daGestora] = await Promise.all([
      api.listarTimes(tokenAdmin),
      api.listarTimes(tokenGestora),
    ])

    expect(doAdmin.length).toBeGreaterThanOrEqual(daGestora.length)
  })

  test('abre o Radar de time que não integra', async () => {
    const tokenGestora = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(tokenGestora)

    const tokenAdmin = await autenticar(USUARIOS.admin)
    const membros = await api.listarMembros(tokenAdmin, time.id)
    const admin = membros.find((membro) => membro.name === USUARIOS.admin.nome)
    test.skip(admin !== undefined, 'o Admin é membro deste time — o caso não se aplica')

    const radar = await api.radar(tokenAdmin, time.id)
    expect(radar.team.id).toBe(time.id)
  })
})

test('erro de permissão traz código FORBIDDEN, não 500', async () => {
  const token = await autenticar(USUARIOS.colaborador)

  const erro = await api.listarUsuarios(token).catch((e: unknown) => e)
  expect(erro).toBeInstanceOf(ErroDaApi)
  expect((erro as ErroDaApi).codigo).toBe('FORBIDDEN')
})
