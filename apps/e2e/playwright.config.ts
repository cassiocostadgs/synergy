import { defineConfig, devices } from '@playwright/test'

import { URL_API, URL_WEB } from './src/dados'

/**
 * Camada de testes de ponta a ponta do Synergy.
 *
 * Três projetos, com propósitos diferentes:
 *   api              — contrato e RBAC direto na API, sem navegador (rápido)
 *   web              — fluxos de interface; NÃO deixa resíduo no banco
 *   web-com-residuo  — fluxos que criam registro sem como apagar (ver README)
 *
 * Por padrão `npm test` roda os dois primeiros. O terceiro é opt-in de
 * propósito: o banco de desenvolvimento é o mesmo que você usa na tela, e
 * time criado por teste não tem DELETE na API — só arquivamento.
 */

/*
 * Navegador: usamos o Chrome instalado na máquina (`channel`) em vez do
 * Chromium que o Playwright baixa. O download do CDN dele não completa na rede
 * corporativa da DB1 — dá timeout no ZIP. Para usar o Chromium empacotado onde
 * a rede permitir: `npx playwright install chromium` e troque `channel` por
 * nada (o padrão já é o Chromium baixado).
 */
const NAVEGADOR = { ...devices['Desktop Chrome'], channel: 'chrome' as const }

/**
 * Como subir a API no ambiente de desenvolvimento.
 *
 * No Windows o `go run` é barrado pelo antivírus (executável recém-compilado no
 * %TEMP%), e o script compila para um caminho fixo fora do OneDrive — ver
 * README da API. Em outros sistemas, `go run` resolve.
 */
const COMANDO_DA_API =
  process.platform === 'win32'
    ? 'powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/dev.ps1'
    : 'go run ./cmd/api'

export default defineConfig({
  testDir: './tests',
  // Um worker só: os três projetos compartilham um banco. Paralelizar faria um
  // teste enxergar dado que outro está criando ou removendo.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: URL_WEB,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Vídeo exigiria o ffmpeg que vem com `playwright install`, que é
    // justamente o download bloqueado aqui. Trace + screenshot bastam.
    video: 'off',
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: URL_API },
    },
    {
      name: 'web',
      testDir: './tests/web',
      testIgnore: '**/com-residuo/**',
      use: NAVEGADOR,
    },
    {
      name: 'web-com-residuo',
      testDir: './tests/web/com-residuo',
      use: NAVEGADOR,
    },
  ],

  // Reaproveita o que já estiver no ar; sobe o que faltar.
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../web',
      url: URL_WEB,
      reuseExistingServer: true,
      timeout: 90_000,
    },
    {
      command: COMANDO_DA_API,
      cwd: '../api',
      url: `${URL_API}/health`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
})
