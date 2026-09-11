import { expect, test } from '@playwright/test'

import { USUARIOS } from '../../src/dados'
import { entrarComo } from '../../src/sessao'
import { itensDoMenu, tituloDaPagina } from '../../src/telas'

/**
 * O que cada papel enxerga no menu (PRD seção 2).
 *
 * Esconder a tela é conveniência, não proteção — quem protege é a API, coberta
 * em tests/api/permissoes.spec.ts. Aqui o que se verifica é que a pessoa não
 * recebe portas que levariam a um 403.
 */

test('Colaborador não vê Usuários nem Radar', async ({ page }) => {
  await entrarComo(page, USUARIOS.colaborador)

  const itens = await itensDoMenu(page)
  expect(itens).toContain('Times')
  expect(itens).toContain('Sorteio')
  expect(itens).toContain('Brackets')
  expect(itens).not.toContain('Usuários')
  expect(itens).not.toContain('Radar')
})

test('Colaborador que digita /radar é devolvido para Times', async ({ page }) => {
  await entrarComo(page, USUARIOS.colaborador)

  await page.goto('/radar')

  await expect(page).toHaveURL(/\/times$/)
  await expect(tituloDaPagina(page)).toHaveText('Times')
})

test('Gestor vê Radar e Usuários', async ({ page }) => {
  await entrarComo(page, USUARIOS.gestora)

  const itens = await itensDoMenu(page)
  expect(itens).toContain('Radar')
  expect(itens).toContain('Usuários')
})

test('Admin vê tudo e chega às telas restritas', async ({ page }) => {
  await entrarComo(page, USUARIOS.admin)

  const itens = await itensDoMenu(page)
  expect(itens).toEqual(
    expect.arrayContaining(['Times', 'Usuários', 'Radar', 'Sorteio', 'Brackets']),
  )

  await page.goto('/usuarios')
  await expect(tituloDaPagina(page)).toHaveText('Usuários')
})

test('Colaborador não recebe o botão de criar time', async ({ page }) => {
  await entrarComo(page, USUARIOS.colaborador)

  await expect(page.getByRole('button', { name: 'Novo time' })).toHaveCount(0)
})
