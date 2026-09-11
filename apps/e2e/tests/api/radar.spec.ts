import { expect, test } from '@playwright/test'

import { api, autenticar, primeiroTimeQueGere } from '../../src/api'
import { USUARIOS } from '../../src/dados'

/**
 * Radar do Time (PRD seção 3.2.4) — as invariantes do agregado.
 *
 * São propriedades, não valores fixos: continuam valendo quando as respostas de
 * demonstração mudarem.
 */

const TOTAL_DE_MOTIVADORES = 10
/** 10 + 9 + ... + 1: a soma da contagem de Borda de um ranking completo. */
const SOMA_DE_BORDA = 55

test.describe('GET /teams/{id}/motivators', () => {
  test('devolve os 10 motivadores, do mais forte ao mais fraco', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)

    const radar = await api.radar(token, time.id)

    expect(radar.scores).toHaveLength(TOTAL_DE_MOTIVADORES)
    const notas = radar.scores.map((item) => item.score)
    expect([...notas].sort((a, b) => b - a)).toEqual(notas)
  })

  test('a soma dos scores é 55 — a propriedade que valida a fórmula de Borda', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)

    const radar = await api.radar(token, time.id)
    test.skip(radar.membersAnswered === 0, 'ninguém respondeu neste time')

    const soma = radar.scores.reduce((total, item) => total + item.score, 0)
    // A média de rankings completos preserva a soma: se a conta somasse posições
    // em vez de pontos, ou perdesse alguém no meio, isto quebraria.
    expect(soma).toBeCloseTo(SOMA_DE_BORDA, 6)
  })

  test('gestores do time NÃO aparecem no radar', async () => {
    // Decisão de 2026-09-10: a visão é do gestor sobre a equipe. Incluir a
    // resposta dele misturaria quem observa com quem é observado — e num time
    // pequeno chegaria a dominar a média.
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)

    const [radar, membros] = await Promise.all([
      api.radar(token, time.id),
      api.listarMembros(token, time.id),
    ])

    const gestores = membros.filter((membro) => membro.role.startsWith('GESTOR'))
    expect(gestores.length).toBeGreaterThan(0)

    for (const gestor of gestores) {
      expect(radar.members.map((membro) => membro.userId)).not.toContain(gestor.userId)
    }
  })

  test('a contagem de cobertura bate com a lista devolvida', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)

    const radar = await api.radar(token, time.id)

    expect(radar.membersTotal).toBe(radar.members.length)
    expect(radar.membersAnswered).toBe(radar.members.filter((m) => m.answered).length)
    expect(radar.membersAnswered).toBeLessThanOrEqual(radar.membersTotal)
  })

  test('quem respondeu traz as 10 posições, sem repetir nenhuma', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)

    const radar = await api.radar(token, time.id)
    const respondentes = radar.members.filter((membro) => membro.answered)
    test.skip(respondentes.length === 0, 'ninguém respondeu neste time')

    for (const pessoa of respondentes) {
      const posicoes = Object.values(pessoa.positions ?? {})
      expect(posicoes).toHaveLength(TOTAL_DE_MOTIVADORES)
      // O banco garante isso por chave única; aqui confirmamos que o contrato
      // da API não perde nada no caminho.
      expect(new Set(posicoes).size).toBe(TOTAL_DE_MOTIVADORES)
      expect(Math.min(...posicoes)).toBe(1)
      expect(Math.max(...posicoes)).toBe(TOTAL_DE_MOTIVADORES)
    }
  })

  test('quem não respondeu entra na lista de pendentes', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)

    const radar = await api.radar(token, time.id)
    const semResposta = radar.members.filter((membro) => !membro.answered)

    for (const pessoa of semResposta) {
      expect(radar.pending.map((p) => p.userId)).toContain(pessoa.userId)
    }
  })

  test('a série individual do cliente reproduz o score do time', async () => {
    // É a conta que a tela faz para sobrepor a linha de uma pessoa ao polígono
    // do time: força = 11 - posição. Se ela divergir da agregação do servidor,
    // o gráfico mente.
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)

    const radar = await api.radar(token, time.id)
    const respondentes = radar.members.filter((membro) => membro.answered)
    test.skip(respondentes.length === 0, 'ninguém respondeu neste time')

    for (const item of radar.scores) {
      const forcas = respondentes.map(
        (pessoa) => TOTAL_DE_MOTIVADORES + 1 - (pessoa.positions?.[item.motivator] ?? 0),
      )
      const media = forcas.reduce((total, forca) => total + forca, 0) / forcas.length
      expect(media).toBeCloseTo(item.score, 6)
    }
  })
})

test.describe('GET /teams/motivators — Radar consolidado', () => {
  test('soma apenas os times que a pessoa gere', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const times = await api.listarTimes(token)
    const geridos = times.filter((t) => t.status === 'ACTIVE' && t.myRole.startsWith('GESTOR'))
    const soParticipa = times.filter((t) => t.myRole === 'COLABORADOR')

    const consolidado = await api.radarConsolidado(token)

    const nomes = consolidado.teams.map((t) => t.name)
    expect(nomes.sort()).toEqual(geridos.map((t) => t.name).sort())
    for (const time of soParticipa) expect(nomes).not.toContain(time.name)
  })

  test('a soma dos scores continua 55 no conjunto', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const consolidado = await api.radarConsolidado(token)
    test.skip(consolidado.membersAnswered === 0, 'ninguém respondeu nos times geridos')

    const soma = consolidado.scores.reduce((total, item) => total + item.score, 0)
    expect(soma).toBeCloseTo(55, 6)
  })

  test('cada pessoa aparece uma única vez, mesmo estando em dois times', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const consolidado = await api.radarConsolidado(token)

    const ids = consolidado.members.map((m) => m.userId)
    // Contar alguém duas vezes faria a resposta dessa pessoa pesar o dobro.
    expect(new Set(ids).size).toBe(ids.length)
    expect(consolidado.membersTotal).toBe(ids.length)
  })

  test('cada linha diz de qual time a pessoa veio', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const consolidado = await api.radarConsolidado(token)
    test.skip(consolidado.members.length === 0, 'nenhum colaborador nos times geridos')

    const nomesDeTimes = consolidado.teams.map((t) => t.name)
    for (const membro of consolidado.members) {
      expect(nomesDeTimes).toContain(membro.teamName)
    }
  })

  test('nenhum gestor dos times somados aparece', async () => {
    const token = await autenticar(USUARIOS.gestora)
    const consolidado = await api.radarConsolidado(token)

    for (const time of consolidado.teams) {
      const membros = await api.listarMembros(token, time.id)
      for (const gestor of membros.filter((m) => m.role.startsWith('GESTOR'))) {
        expect(consolidado.members.map((m) => m.userId)).not.toContain(gestor.userId)
      }
    }
  })

  test('Colaborador não tem acesso', async () => {
    const token = await autenticar(USUARIOS.colaborador)

    await expect(api.radarConsolidado(token)).rejects.toMatchObject({ status: 403 })
  })
})
