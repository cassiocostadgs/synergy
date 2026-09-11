import { expect, test } from '@playwright/test'

import { USUARIOS } from '../../src/dados'
import { entrarComo } from '../../src/sessao'

/**
 * Sorteio de Temas e Brackets (PRD 3.2.1 e 3.2.2).
 *
 * Nada aqui toca o banco: as duas dinâmicas vivem no navegador e são
 * descartadas ao sair da tela. É o que permite testá-las à vontade.
 */

test.describe('Sorteio de temas', () => {
  // Com movimento reduzido o app entrega o resultado sem a animação de 4,2s —
  // o teste fica rápido e ainda exercita esse caminho, que existe por
  // acessibilidade.
  test.use({ reducedMotion: 'reduce' })

  const TEMAS = ['Retrospectiva', 'Débito técnico', 'Metas do trimestre', 'Saúde do time']

  test('sorteia um dos temas informados', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/sorteio')

    await page.getByLabel('Temas').fill(TEMAS.join('\n'))
    await page.getByRole('button', { name: 'Girar a roda' }).click()

    const resultado = page.getByText('Tema sorteado').locator('..')
    await expect(resultado).toBeVisible()

    // O tema fica no segundo parágrafo do bloco. Recortar o innerText inteiro
    // não funciona: o rótulo é exibido em caixa alta por CSS, então o texto
    // renderizado não é o mesmo que está no código.
    const sorteado = (await resultado.locator('p').last().innerText()).trim()
    // Precisa ser um dos temas da lista — e não um rótulo cortado ou o tema
    // errado por engano de índice.
    expect(TEMAS).toContain(sorteado)
  })

  test('recusa lista com menos de dois temas', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/sorteio')

    await page.getByLabel('Temas').fill('Tema único')

    await expect(page.getByText(/informe ao menos 2 temas/i)).toBeVisible()
  })

  test('recusa tema acima do limite de caracteres', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/sorteio')

    await page.getByLabel('Temas').fill(['Curto', 'X'.repeat(30)].join('\n'))

    // "até 20 caracteres" também aparece na dica fixa embaixo do campo; o que
    // identifica a mensagem de erro é ela citar qual tema passou do limite.
    await expect(page.getByText(/passou do limite/i)).toBeVisible()
  })
})

test.describe('Brackets', () => {
  const OPCOES = ['Matrix', 'Cidade de Deus', 'Interestelar', 'Cidadão Kane']

  async function montarChave(page: import('@playwright/test').Page) {
    await entrarComo(page, USUARIOS.colaborador, '/brackets')

    await page.getByLabel('Tema da disputa').fill('Melhor filme')
    await page.getByLabel('Opções').fill(OPCOES.join('\n'))
    // Sem embaralhar, os confrontos da primeira rodada são previsíveis:
    // (1º x 2º) e (3º x 4º).
    await page.getByLabel('Embaralhar os confrontos da primeira rodada').uncheck()
    await page.getByRole('button', { name: 'Criar chaveamento' }).click()

    await expect(page.getByRole('heading', { name: 'Melhor filme' })).toBeVisible()
  }

  test('o campeão só aparece depois que a final é decidida', async ({ page }) => {
    // Regressão do bug reportado: a final era coroada sozinha, porque um lado
    // ainda vazio era tratado como "passou direto".
    await montarChave(page)

    await expect(page.getByText('Campeão')).toHaveCount(0)

    await page.getByRole('button', { name: OPCOES[0], exact: true }).click()
    await expect(page.getByText('Campeão')).toHaveCount(0)

    await page.getByRole('button', { name: OPCOES[2], exact: true }).click()
    // Semifinais decididas, final em aberto: ainda não há campeão.
    await expect(page.getByText('Campeão')).toHaveCount(0)

    // Na final os dois vencedores se enfrentam; clicar em um deles encerra.
    await page.getByRole('button', { name: OPCOES[0], exact: true }).last().click()

    await expect(page.getByText('Campeão')).toBeVisible()
    await expect(page.getByText('Disputa encerrada')).toBeVisible()
  })

  test('"Recomeçar" devolve a chave em aberto sem perder os participantes', async ({ page }) => {
    await montarChave(page)

    await page.getByRole('button', { name: OPCOES[0], exact: true }).click()
    await page.getByRole('button', { name: 'Recomeçar' }).click()

    await expect(page.getByText('Campeão')).toHaveCount(0)
    for (const opcao of OPCOES) {
      await expect(page.getByRole('button', { name: opcao, exact: true }).first()).toBeVisible()
    }
  })

  test('exige tema antes de montar a chave', async ({ page }) => {
    await entrarComo(page, USUARIOS.colaborador, '/brackets')

    // Um espaço em branco passa pelo `required` do HTML e chega à validação da
    // aplicação, que é o que este teste quer exercitar. Com o campo vazio, o
    // próprio navegador barra o envio e o código nem roda.
    await page.getByLabel('Tema da disputa').fill(' ')
    await page.getByLabel('Opções').fill(OPCOES.join('\n'))
    await page.getByRole('button', { name: 'Criar chaveamento' }).click()

    await expect(page.getByText(/informe o tema/i)).toBeVisible()
  })
})
