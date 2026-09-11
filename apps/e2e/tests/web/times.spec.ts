import { expect, test } from '@playwright/test'

import { api, autenticar } from '../../src/api'
import { USUARIOS } from '../../src/dados'
import { entrarComo } from '../../src/sessao'
import { kpi, tituloDaPagina } from '../../src/telas'

/**
 * Times e membros — só leitura (PRD seção 3.1).
 *
 * Criar, renomear e arquivar ficam em `com-residuo/`: a API não tem DELETE de
 * time, então um teste que cria deixa registro no banco para sempre.
 */

test('a lista mostra os times que a pessoa enxerga pela API', async ({ page }) => {
  const token = await autenticar(USUARIOS.gestora)
  const times = await api.listarTimes(token)

  await entrarComo(page, USUARIOS.gestora, '/times')
  await expect(tituloDaPagina(page)).toHaveText('Times')

  for (const time of times) {
    await expect(page.getByText(time.name, { exact: true }).first()).toBeVisible()
  }
})

test('os KPIs conferem com os dados', async ({ page }) => {
  const token = await autenticar(USUARIOS.gestora)
  const times = await api.listarTimes(token)
  const ativos = times.filter((time) => time.status === 'ACTIVE').length

  await entrarComo(page, USUARIOS.gestora, '/times')

  await expect(kpi(page, 'Times visíveis')).toContainText(String(times.length))
  await expect(kpi(page, 'Times ativos')).toContainText(String(ativos))
})

test('abrir um time lista os membros com seus papéis', async ({ page }) => {
  const token = await autenticar(USUARIOS.gestora)
  const times = await api.listarTimes(token)
  const time = times.find((t) => t.status === 'ACTIVE')
  test.skip(!time, 'nenhum time ativo neste ambiente')

  const membros = await api.listarMembros(token, time!.id)

  await entrarComo(page, USUARIOS.gestora, `/times/${time!.id}`)

  await expect(tituloDaPagina(page)).toHaveText(time!.name)
  for (const membro of membros) {
    await expect(page.getByText(membro.name, { exact: false }).first()).toBeVisible()
  }
})

test('Gestor Principal aparece identificado como tal', async ({ page }) => {
  // RN1: todo time tem exatamente um. Se a tela deixasse de marcá-lo, não daria
  // para saber de quem é a transferência de liderança.
  const token = await autenticar(USUARIOS.gestora)
  const times = await api.listarTimes(token)
  const time = times.find((t) => t.myRole === 'GESTOR_PRINCIPAL')
  test.skip(!time, 'a gestora não é principal em nenhum time')

  await entrarComo(page, USUARIOS.gestora, `/times/${time!.id}`)

  await expect(page.getByText(/gestor principal/i).first()).toBeVisible()
})
