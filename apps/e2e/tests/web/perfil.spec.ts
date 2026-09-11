import { expect, test } from '@playwright/test'

import { USUARIOS } from '../../src/dados'
import { entrarComo } from '../../src/sessao'
import { blocoDoUsuario, tituloDaPagina } from '../../src/telas'

/**
 * Perfil e Moving Motivators (PRD 3.3 e 3.2.3).
 *
 * Nenhum teste aqui SALVA: gravar um ranking mudaria a data da última resposta
 * e, com isso, o contador de revisão e os dados de demonstração do Radar. O que
 * se exercita é a interação — que é onde mora o risco de regressão.
 */

test.describe('Meu perfil', () => {
  test('abre pelo bloco do canto superior direito', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador)

    await blocoDoUsuario(page).click()

    await expect(page).toHaveURL(/\/perfil$/)
    await expect(tituloDaPagina(page)).toHaveText('Meu perfil')
  })

  test('traz os dados da sessão e não deixa editar e-mail nem papel', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/perfil')

    await expect(page.getByLabel('Nome')).toHaveValue(USUARIOS.colaborador.nome)
    await expect(page.getByText(USUARIOS.colaborador.email)).toBeVisible()
    await expect(page.getByText(/e-mail e papel são definidos pelo admin/i)).toBeVisible()
    // E-mail não é campo de formulário nesta tela.
    await expect(page.getByLabel('E-mail')).toHaveCount(0)
  })

  test('o botão de salvar só habilita depois de alterar algo', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/perfil')

    const salvar = page.getByRole('button', { name: 'Salvar dados' })
    await expect(salvar).toBeDisabled()

    await page.getByLabel('Hobby').fill('Escalada de teste')
    await expect(salvar).toBeEnabled()

    // Desfaz digitando o valor original — sem salvar, nada chega ao banco.
    await page.getByLabel('Nome').fill(USUARIOS.colaborador.nome)
  })

  test('a troca de senha exige confirmação conferindo', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/perfil')

    await page.getByLabel('Senha atual').fill(USUARIOS.colaborador.senha)
    await page.getByLabel('Nova senha', { exact: false }).first().fill('uma-senha-nova-1')
    await page.getByLabel('Confirmar nova senha').fill('outra-coisa-2')
    await page.getByRole('button', { name: 'Alterar senha' }).click()

    // A conferência é feita no cliente: a API nem é chamada.
    await expect(page.getByText(/confirmação não confere/i)).toBeVisible()
  })
})

test.describe('Moving Motivators', () => {
  test('lista os 10 motivadores em ordem', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/perfil')

    const itens = page.getByRole('listitem')
    await expect(itens).toHaveCount(10)
    await expect(itens.first()).toContainText('1º')
    await expect(itens.last()).toContainText('10º')
  })

  test('a seta reordena e o Desfazer devolve a ordem original', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/perfil')

    const itens = page.getByRole('listitem')
    const primeiroAntes = await itens.first().innerText()
    const segundoAntes = await itens.nth(1).innerText()

    // Sobe o segundo colocado: ele troca de lugar com o primeiro.
    await itens.nth(1).getByRole('button', { name: /^Subir/ }).click()

    expect(await itens.first().innerText()).toBe(segundoAntes.replace('2º', '1º'))
    await expect(page.getByRole('button', { name: 'Desfazer' })).toBeVisible()

    await page.getByRole('button', { name: 'Desfazer' }).click()

    expect(await itens.first().innerText()).toBe(primeiroAntes)
    // Sem alteração pendente, não há o que desfazer nem o que salvar.
    await expect(page.getByRole('button', { name: 'Desfazer' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Salvar perfil' })).toBeDisabled()
  })

  test('o primeiro colocado não pode subir nem o último descer', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/perfil')

    const itens = page.getByRole('listitem')
    await expect(itens.first().getByRole('button', { name: /^Subir/ })).toBeDisabled()
    await expect(itens.last().getByRole('button', { name: /^Descer/ })).toBeDisabled()
  })

  test('informa quando a resposta foi dada ou que ainda não houve', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/perfil')

    // Uma das três faixas de estado sempre aparece (PRD 3.2.3).
    await expect(
      page.getByText(/respondido (hoje|ontem|há \d+ dias)|ainda não respondeu|hora de revisar/i),
    ).toBeVisible()
  })
})
