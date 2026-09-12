import { expect, test } from '@playwright/test'

import { api, autenticar, primeiroTimeQueGere, timeComRadarPopulado } from '../../src/api'
import { USUARIOS } from '../../src/dados'
import { entrarComo } from '../../src/sessao'
import {
  coberturaDoRadar,
  destaqueDoRadar,
  filtroDeColaborador,
  filtroDeTime,
  tituloDaPagina,
} from '../../src/telas'

/**
 * Radar do Time na tela (PRD seção 3.2.4).
 *
 * O cenário esperado é descoberto pela API antes de abrir a página: assim o
 * teste compara a tela com a fonte da verdade, em vez de com nomes fixos que
 * envelhecem junto com os dados de demonstração.
 */

test.describe('Radar', () => {
  test('mostra KPIs, gráfico e mapa de calor', async ({ page }) => {
    await entrarComo(page, USUARIOS.gestora, '/radar')
    await expect(tituloDaPagina(page)).toHaveText('Radar')

    await expect(page.getByRole('img', { name: /radar dos motivadores/i })).toBeVisible()
    await expect(coberturaDoRadar(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mapa de calor individual' })).toBeVisible()
  })

  test('o seletor de time oferece só os times que a pessoa gere', async ({ page }) => {
    // Regressão: antes, a lista trazia todo time que a pessoa integra, e
    // escolher um em que ela era só colaboradora terminava em 403 na tela.
    const token = await autenticar(USUARIOS.gestora)
    const times = await api.listarTimes(token)
    const geridos = times.filter((t) => t.status === 'ACTIVE' && t.myRole.startsWith('GESTOR'))
    const soParticipa = times.filter((t) => t.myRole === 'COLABORADOR')

    await entrarComo(page, USUARIOS.gestora, '/radar')

    const seletor = filtroDeTime(page)
    test.skip((await seletor.count()) === 0, 'só há um time gerido — o seletor não aparece')

    const opcoes = await seletor.locator('option').allInnerTexts()
    for (const time of geridos) expect(opcoes).toContain(time.name)
    for (const time of soParticipa) expect(opcoes).not.toContain(time.name)
  })

  test('quem gere o time não aparece na matriz', async ({ page }) => {
    const token = await autenticar(USUARIOS.gestora)
    const time = await primeiroTimeQueGere(token)
    const membros = await api.listarMembros(token, time.id)
    const gestores = membros.filter((m) => m.role.startsWith('GESTOR'))

    await entrarComo(page, USUARIOS.gestora, '/radar')
    const matriz = page.getByRole('table')
    await expect(matriz).toBeVisible()

    for (const gestor of gestores) {
      await expect(matriz.getByText(gestor.name, { exact: false })).toHaveCount(0)
    }
    // E os colaboradores continuam lá — senão o teste passaria com a tela vazia.
    const colaboradores = membros.filter((m) => m.role === 'COLABORADOR')
    for (const pessoa of colaboradores) {
      await expect(matriz.getByText(pessoa.name, { exact: false }).first()).toBeVisible()
    }
  })

  test('filtrar por colaborador reduz a matriz e sobrepõe a linha no gráfico', async ({ page }) => {
    const token = await autenticar(USUARIOS.gestora)
    const cenario = await timeComRadarPopulado(token)
    test.skip(!cenario, 'nenhum time gerido tem dois colaboradores e ao menos uma resposta')
    const { time, radar } = cenario!
    const respondente = radar.members.find((membro) => membro.answered)!

    await entrarComo(page, USUARIOS.gestora, '/radar')
    await filtroDeTime(page).selectOption({ label: time.name })

    // Espera a matriz chegar antes de contar: o radar carrega por requisição, e
    // contar linhas de uma tabela que ainda não existe dá zero — o teste
    // passaria por engano na comparação seguinte.
    const linhas = page.getByRole('table').getByRole('row')
    await expect(linhas).toHaveCount(radar.members.length + 1)

    await filtroDeColaborador(page).selectOption({ label: respondente.name })

    // Sobra o cabeçalho e a linha da pessoa.
    await expect(linhas).toHaveCount(2)

    // E o gráfico ganha a segunda série: a legenda só existe quando há duas.
    await expect(page.getByText(/^Time \(\d+ resposta/)).toBeVisible()
    await expect(
      page.getByRole('img', { name: new RegExp(`série de ${respondente.name}`, 'i') }),
    ).toBeVisible()
  })

  test('o filtro não altera o que é do time', async ({ page }) => {
    const token = await autenticar(USUARIOS.gestora)
    const cenario = await timeComRadarPopulado(token)
    test.skip(!cenario, 'nenhum time gerido tem dois colaboradores e ao menos uma resposta')
    const { time, radar } = cenario!
    const respondente = radar.members.find((membro) => membro.answered)!

    await entrarComo(page, USUARIOS.gestora, '/radar')
    await filtroDeTime(page).selectOption({ label: time.name })

    const cobertura = coberturaDoRadar(page)
    const valor = `${radar.membersAnswered}/${radar.membersTotal}`
    await expect(cobertura).toContainText(valor)

    await filtroDeColaborador(page).selectOption({ label: respondente.name })

    // Recalcular sobre uma pessoa transformaria o "radar do time" no radar dela.
    await expect(cobertura).toContainText(valor)
  })
})

test.describe('Todos os meus times', () => {
  test('a opção consolidada soma os times e marca o time de cada pessoa', async ({ page }) => {
    const token = await autenticar(USUARIOS.gestora)
    const consolidado = await api.radarConsolidado(token)
    test.skip(consolidado.teams.length < 2, 'a gestora gere menos de dois times')

    await entrarComo(page, USUARIOS.gestora, '/radar')
    await filtroDeTime(page).selectOption({ label: `Todos os meus times (${consolidado.teams.length})` })

    const linhas = page.getByRole('table').getByRole('row')
    await expect(linhas).toHaveCount(consolidado.members.length + 1)

    // Na visão consolidada o rótulo ao lado do nome passa a ser o time, senão
    // não dá para saber de onde cada pessoa veio.
    const nomesDeTimes = [...new Set(consolidado.members.map((m) => m.teamName))]
    for (const nome of nomesDeTimes) {
      await expect(page.getByRole('table').getByText(`(${nome})`).first()).toBeVisible()
    }
  })

  test('a cobertura consolidada bate com a soma dos times', async ({ page }) => {
    const token = await autenticar(USUARIOS.gestora)
    const consolidado = await api.radarConsolidado(token)
    test.skip(consolidado.teams.length < 2, 'a gestora gere menos de dois times')

    await entrarComo(page, USUARIOS.gestora, '/radar')
    await filtroDeTime(page).selectOption({ label: `Todos os meus times (${consolidado.teams.length})` })

    await expect(coberturaDoRadar(page)).toContainText(
      `${consolidado.membersAnswered}/${consolidado.membersTotal}`,
    )
    await expect(destaqueDoRadar(page)).toBeVisible()
  })

  test('a tela cabe sem rolagem vertical', async ({ page }) => {
    // O pedido é explícito: nada de rolar a página no Radar. Quem rola, quando
    // precisa, é o mapa de calor por dentro.
    await entrarComo(page, USUARIOS.gestora, '/radar')
    await expect(page.getByRole('table')).toBeVisible()

    const rola = await page.evaluate(() => {
      const raiz = document.documentElement
      // 2px de tolerância para arredondamento de layout.
      return raiz.scrollHeight - raiz.clientHeight > 2
    })
    expect(rola).toBe(false)
  })
})

test('o gráfico continua legível em janela baixa', async ({ page }) => {
  // Regressão: o SVG era item de um flex e cedia espaço para o botão e os
  // destaques, chegando a 75px de altura numa janela de 620px — praticamente
  // sumindo. O gráfico é o assunto da tela; quando não couber, quem rola é a
  // página.
  await page.setViewportSize({ width: 1280, height: 620 })
  await entrarComo(page, USUARIOS.gestora, '/radar')

  const grafico = page.getByRole('img', { name: /radar dos motivadores/i })
  await expect(grafico).toBeVisible()

  const altura = (await grafico.boundingBox())?.height ?? 0
  expect(altura).toBeGreaterThanOrEqual(180)
})

test('o mapa de calor mostra só o nome na visão de um time', async ({ page }) => {
  // O papel saía sempre como "Colaborador" (gestor não entra no Radar) e o
  // ícone de revisão repetia o que o KPI e a faixa de atenção já dizem.
  await entrarComo(page, USUARIOS.gestora, '/radar')

  const matriz = page.getByRole('table')
  await expect(matriz).toBeVisible()
  await expect(matriz.getByText('(Colaborador)')).toHaveCount(0)
  await expect(matriz.getByText('revisão vencida')).toHaveCount(0)
})

test('a visão consolidada também cabe em tela grande', async ({ page }) => {
  // Regressão relatada: em 1920 a tela voltou a rolar na visão consolidada, que
  // tem mais linhas e a faixa de pendências. A causa foi o cartão do gráfico ter
  // deixado de poder encolher — o SVG reivindica a altura da própria proporção
  // como mínimo, e sem `min-h-0` isso trava a linha inteira.
  await page.setViewportSize({ width: 1920, height: 945 })
  await entrarComo(page, USUARIOS.gestora, '/radar')

  const consolidado = await api.radarConsolidado(await autenticar(USUARIOS.gestora))
  test.skip(consolidado.teams.length < 2, 'a gestora gere menos de dois times')

  await filtroDeTime(page).selectOption({
    label: `Todos os meus times (${consolidado.teams.length})`,
  })
  await page.getByRole('table').waitFor()

  const medidas = await page.evaluate(() => {
    const svg = document.querySelector('[aria-label*="adar dos motivadores"]')
    const cartao = svg?.closest('.rounded-2xl')
    return {
      rola: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      // Positivo = o gráfico ultrapassou a borda do cartão.
      vaza: Math.round(
        (svg?.getBoundingClientRect().bottom ?? 0) - (cartao?.getBoundingClientRect().bottom ?? 0),
      ),
    }
  })

  expect(medidas.rola).toBeLessThanOrEqual(2)
  expect(medidas.vaza).toBeLessThanOrEqual(2)
})

test('a ajuda explica o que é cada motivador', async ({ page }) => {
  await entrarComo(page, USUARIOS.gestora, '/radar')

  await page.getByRole('button', { name: 'O que significa cada motivador' }).click()

  const dialogo = page.getByText('Os 10 motivadores').locator('..').locator('..')
  await expect(dialogo).toBeVisible()

  // Os dez, com nome e sigla — é a sigla que decodifica as colunas da matriz.
  for (const [sigla, nome] of [
    ['CUR', 'Curiosidade'],
    ['LIB', 'Liberdade'],
    ['MAE', 'Maestria'],
    ['STA', 'Status'],
  ]) {
    await expect(dialogo.getByText(sigla, { exact: true })).toBeVisible()
    await expect(dialogo.getByText(new RegExp(`^${nome}:`))).toBeVisible()
  }
  await expect(dialogo.getByRole('listitem')).toHaveCount(10)

  // Esc fecha, como em qualquer modal.
  await page.keyboard.press('Escape')
  await expect(page.getByText('Os 10 motivadores')).toHaveCount(0)
})
