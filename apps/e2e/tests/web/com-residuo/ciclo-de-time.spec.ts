import { expect, test } from '@playwright/test'

import { api, autenticar } from '../../../src/api'
import { USUARIOS } from '../../../src/dados'
import { entrarComo } from '../../../src/sessao'

/**
 * Ciclo completo de um time pela interface: criar, adicionar membro, trocar
 * papel, remover membro e arquivar.
 *
 * ⚠️ DEIXA RESÍDUO NO BANCO. A API não tem DELETE de time — arquivar é o mais
 * perto disso que existe, e o time continua na lista como "Arquivado". Por isso
 * este projeto é opt-in (`npm run test:residuo`) e fica fora do `npm test`.
 *
 * Os nomes levam o prefixo E2E e a data, para dar para achar e limpar depois
 * (o SQL está no README).
 */

const PREFIXO = 'E2E'

function nomeUnico(): string {
  const agora = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '')
  return `${PREFIXO} ${agora}-${Math.floor(Math.random() * 1000)}`
}

test.describe('Ciclo de vida de um time', () => {
  // Remover membro e arquivar passam por `window.confirm`. Sem este tratador o
  // Playwright dispensa o diálogo automaticamente e a ação nunca acontece —
  // o teste falharia sem explicar por quê.
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (dialogo) => void dialogo.accept())
  })

  test('cria, gerencia membros e arquiva', async ({ page }) => {
    // Um teste só percorrendo seis operações, cada uma confirmada pela API:
    // o padrão de 30s não cobre isso com folga.
    test.setTimeout(90_000)

    const nome = nomeUnico()
    const token = await autenticar(USUARIOS.gestora)

    await entrarComo(page, USUARIOS.gestora, '/times')

    // --- criar ---
    await page.getByRole('button', { name: 'Novo time' }).click()
    await page.getByLabel('Nome do time').fill(nome)
    await page.getByRole('button', { name: 'Criar time' }).click()

    await expect(page.getByText(nome, { exact: true }).first()).toBeVisible()

    // Quem cria nasce Gestor Principal, na mesma transação (RN1).
    const criado = (await api.listarTimes(token)).find((time) => time.name === nome)
    expect(criado?.myRole).toBe('GESTOR_PRINCIPAL')

    // --- adicionar membro ---
    // A opção é rotulada "Nome (e-mail)", então escolhemos pelo id em vez de
    // pelo texto: o rótulo é detalhe de apresentação e pode mudar.
    // Entra quem tem papel global de Gestor, porque o mesmo teste promove a
    // pessoa a Gestor de Apoio logo em seguida.
    const usuarios = await api.listarUsuarios(token)
    const convidada = usuarios.find((u) => u.email === USUARIOS.gestoraSemTime.email)!

    await page.goto(`/times/${criado!.id}`)
    await page.getByRole('button', { name: 'Adicionar membro' }).click()
    await page.getByLabel('Usuário').selectOption(convidada.id)
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click()

    const linhaDoMembro = page.getByRole('row', { name: new RegExp(USUARIOS.gestoraSemTime.nome) })
    await expect(linhaDoMembro).toBeVisible()
    expect(await api.listarMembros(token, criado!.id)).toHaveLength(2)

    // --- promover a Gestor de Apoio e voltar ---
    const seletorDePapel = linhaDoMembro.getByLabel(
      `Alterar papel de ${USUARIOS.gestoraSemTime.nome}`,
    )
    await seletorDePapel.selectOption('GESTOR_APOIO')
    await expect
      .poll(async () => {
        const membros = await api.listarMembros(token, criado!.id)
        return membros.find((m) => m.name === USUARIOS.gestoraSemTime.nome)?.role
      })
      .toBe('GESTOR_APOIO')

    await seletorDePapel.selectOption('COLABORADOR')
    await expect
      .poll(async () => {
        const membros = await api.listarMembros(token, criado!.id)
        return membros.find((m) => m.name === USUARIOS.gestoraSemTime.nome)?.role
      })
      .toBe('COLABORADOR')

    // --- remover membro ---
    await linhaDoMembro.getByRole('button', { name: 'Remover' }).click()
    await expect(linhaDoMembro).toHaveCount(0)
    await expect.poll(async () => (await api.listarMembros(token, criado!.id)).length).toBe(1)

    // --- arquivar ---
    await page.getByRole('button', { name: 'Arquivar' }).click()
    await expect
      .poll(async () => (await api.listarTimes(token)).find((t) => t.id === criado!.id)?.status)
      .toBe('ARCHIVED')
    await expect(page.getByText(/alterações de membros estão bloqueadas/i)).toBeVisible()
  })

  test('promover a Gestor de Apoio quem é Colaborador global é recusado na tela', async ({
    page,
  }) => {
    // Papel de gestão em time exige papel global de Gestor ou Admin. A tela
    // oferece a opção assim mesmo — quem barra é a API —, então o que importa é
    // a pessoa receber o motivo em vez de um silêncio.
    const token = await autenticar(USUARIOS.gestora)
    const time = await api.criarTime(token, nomeUnico())

    try {
      const usuarios = await api.listarUsuarios(token)
      const colaborador = usuarios.find((u) => u.email === USUARIOS.colaborador.email)!
      await api.adicionarMembro(token, time.id, colaborador.id, 'COLABORADOR')

      await entrarComo(page, USUARIOS.gestora, `/times/${time.id}`)
      await page
        .getByLabel(`Alterar papel de ${USUARIOS.colaborador.nome}`)
        .selectOption('GESTOR_APOIO')

      await expect(page.getByText(/papel global de Gestor ou Admin/i)).toBeVisible()

      const membros = await api.listarMembros(token, time.id)
      expect(membros.find((m) => m.name === USUARIOS.colaborador.nome)?.role).toBe('COLABORADOR')
    } finally {
      await api.arquivarTime(token, time.id)
    }
  })

  test('o Gestor Principal não pode ser removido do próprio time', async () => {
    // RN1 pela API: ele só sai por transferência de liderança. Fica aqui, e não
    // na suíte de API, porque precisa criar um time para montar o cenário.
    const token = await autenticar(USUARIOS.gestora)
    const time = await api.criarTime(token, nomeUnico())

    try {
      const membros = await api.listarMembros(token, time.id)
      const principal = membros.find((membro) => membro.role === 'GESTOR_PRINCIPAL')!

      await expect(api.removerMembro(token, time.id, principal.userId)).rejects.toMatchObject({
        status: 409,
      })
    } finally {
      await api.arquivarTime(token, time.id)
    }
  })
})
