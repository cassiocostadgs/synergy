import { expect, test } from '@playwright/test'

import { CHAVE_DO_TOKEN, USUARIOS } from '../../src/dados'
import { entrarComo, entrarPelaTela } from '../../src/sessao'
import { blocoDoUsuario, menuLateral } from '../../src/telas'

test.describe('Login', () => {
  test('entra com credenciais válidas e cai em Times', async ({ page }) => {
    await entrarPelaTela(page, USUARIOS.gestora)

    await expect(page).toHaveURL(/\/times$/)
    await expect(blocoDoUsuario(page)).toContainText(USUARIOS.gestora.nome)
  })

  test('senha errada mostra o erro e mantém na tela de login', async ({ page }) => {
    await entrarPelaTela(page, { ...USUARIOS.gestora, senha: 'senha-errada-de-proposito' })

    await expect(page.getByText(/credenciais inválidas/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    // Nada de sessão pela metade.
    expect(await page.evaluate((chave) => localStorage.getItem(chave), CHAVE_DO_TOKEN)).toBeNull()
  })

  test('rota protegida sem sessão redireciona para o login', async ({ page }) => {
    await page.goto('/radar')

    await expect(page).toHaveURL(/\/login$/)
  })

  test('"manter sessão" desmarcado guarda o token só na aba', async ({ page }) => {
    // O requisito é explícito na tela: sem a opção, a sessão termina ao fechar
    // o navegador — o que significa sessionStorage, não localStorage.
    await entrarPelaTela(page, USUARIOS.gestora, { lembrar: false })
    await expect(page).toHaveURL(/\/times$/)

    const guardado = await page.evaluate((chave) => {
      return {
        local: localStorage.getItem(chave),
        sessao: sessionStorage.getItem(chave),
      }
    }, CHAVE_DO_TOKEN)

    expect(guardado.local).toBeNull()
    expect(guardado.sessao).not.toBeNull()
  })

  test('sair pelo rodapé encerra a sessão de verdade', async ({ page }) => {
    await entrarComo(page, USUARIOS.gestora)

    await menuLateral(page).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)

    // Voltar pela URL não deve reabrir a sessão.
    await page.goto('/times')
    await expect(page).toHaveURL(/\/login$/)
  })
})
