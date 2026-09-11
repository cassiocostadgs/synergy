import { expect, type Page } from '@playwright/test'

import { autenticar } from './api'
import { CHAVE_DO_TOKEN, type Usuario } from './dados'
import { blocoDoUsuario } from './telas'

/**
 * Deixa a página autenticada sem passar pela tela de login.
 *
 * O token é obtido pela API e injetado no `localStorage` antes de qualquer
 * script da página rodar — é o que o próprio app faria ao marcar "Manter sessão
 * neste dispositivo". Repetir o formulário de login em cada teste só tornaria a
 * suíte lenta e faria toda ela quebrar junto se o login quebrasse; quem cobre o
 * formulário é o `login.spec.ts`.
 */
export async function entrarComo(page: Page, usuario: Usuario, rota = '/times'): Promise<string> {
  const token = await autenticar(usuario)

  // Grava UMA vez, já dentro da origem do app. Fazer isso por `addInitScript`
  // parece mais elegante, mas o script roda a cada navegação: depois de um
  // logout, o próximo `goto` reinjetaria o token e a sessão "voltaria" sozinha
  // — mascarando exatamente o que o teste de sair precisa provar.
  await page.goto('/login')
  await page.evaluate(
    ([chave, valor]) => {
      window.localStorage.setItem(chave, valor)
    },
    [CHAVE_DO_TOKEN, token] as const,
  )

  await page.goto(rota)
  // A sessão é restaurada por uma chamada a /me; esperar o nome na barra
  // superior evita que cada teste comece a interagir com a tela ainda em branco.
  await expect(blocoDoUsuario(page)).toContainText(usuario.nome)

  return token
}

/** Faz o login pela tela, como uma pessoa faria. */
export async function entrarPelaTela(
  page: Page,
  usuario: Usuario,
  opcoes: { lembrar?: boolean } = {},
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(usuario.email)
  await page.getByLabel('Senha').fill(usuario.senha)

  const lembrar = page.getByLabel('Manter sessão neste dispositivo')
  if (opcoes.lembrar === false) await lembrar.uncheck()

  await page.getByRole('button', { name: 'Entrar' }).click()
}
