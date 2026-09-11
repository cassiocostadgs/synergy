import type { Locator, Page } from '@playwright/test'

/**
 * Localizadores das partes do App Shell.
 *
 * O menu existe duas vezes no HTML — lateral no desktop, barra flutuante no
 * mobile — e só uma delas fica visível por vez. Sem escopo, um
 * `getByRole('link', { name: 'Times' })` acha as duas e o Playwright reclama de
 * ambiguidade. Por isso todo acesso ao menu passa por aqui.
 */

/** Menu lateral (visível a partir de `lg`). */
export function menuLateral(page: Page): Locator {
  return page.locator('aside')
}

/** Barra inferior flutuante (visível abaixo de `lg`). */
export function menuInferior(page: Page): Locator {
  return page.locator('nav.fixed')
}

/** Bloco do usuário no canto superior direito — leva ao perfil. */
export function blocoDoUsuario(page: Page): Locator {
  // Por href, não pelo nome acessível: o nome inclui papel e iniciais do avatar.
  return page.locator('header a[href="/perfil"]')
}

/** Título da página atual (o `h1` do PageHeader). */
export function tituloDaPagina(page: Page): Locator {
  return page.getByRole('heading', { level: 1 })
}

/**
 * Rótulos dos itens do menu lateral.
 *
 * O ícone do Material Symbols é um `<span>` cujo texto é o nome da ligadura
 * ("groups", "radar"), então o innerText de cada item vem como "groups\nTimes".
 * `aria-hidden` esconde o ícone do leitor de tela, mas não do innerText — por
 * isso ficamos com a última linha, que é o rótulo.
 */
export async function itensDoMenu(page: Page): Promise<string[]> {
  const textos = await menuLateral(page).getByRole('link').allInnerTexts()
  return textos
    .map((texto) => texto.trim().split('\n').pop()?.trim() ?? '')
    .filter(Boolean)
}

/**
 * Filtros do Radar.
 *
 * Por papel (`combobox`), não por rótulo: `getByLabel('Time')` casa por
 * substring e pega também o `aria-label` do gráfico ("motivadores do time"). E
 * o nome acessível de um `<select>` embrulhado em `<label>` inclui o texto das
 * opções, então `exact` também não resolve — daí a âncora no início.
 */
export function filtroDeTime(page: Page): Locator {
  return page.getByRole('combobox', { name: /^Time/ })
}

export function filtroDeColaborador(page: Page): Locator {
  return page.getByRole('combobox', { name: /^Colaborador/ })
}

/**
 * Cartão de KPI inteiro, a partir do rótulo.
 *
 * O rótulo mora num `<p>` dentro de um flex que só tem ele e o ícone; o valor é
 * irmão desse flex. Por isso são dois níveis até a raiz do cartão.
 */
export function kpi(page: Page, rotulo: string): Locator {
  return page.getByText(rotulo, { exact: true }).locator('..').locator('..')
}

/**
 * Cobertura do Radar ("quantos responderam"), na forma que estiver visível.
 *
 * Acima de 760px de altura ela é um cartão de KPI; abaixo disso os cartões dão
 * lugar a uma linha de texto, porque ali eles custariam um quarto da tela. O
 * teste não deve depender de qual das duas está na vez.
 */
export function coberturaDoRadar(page: Page): Locator {
  return kpi(page, 'Responderam')
    .or(page.getByText(/\d+\/\d+\s*responderam/i))
    .filter({ visible: true })
    .first()
}

/** Motivador mais forte, também nas duas formas. */
export function destaqueDoRadar(page: Page): Locator {
  return kpi(page, 'Move mais o time')
    .or(kpi(page, 'Move mais o conjunto'))
    .or(page.getByText(/^Move mais:/i))
    .filter({ visible: true })
    .first()
}
