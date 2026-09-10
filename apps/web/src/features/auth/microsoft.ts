import type { PublicClientApplication } from '@azure/msal-browser'

/**
 * SSO da Microsoft (Entra ID) — lado do navegador.
 *
 * O MSAL cuida da dança do OAuth (Authorization Code + PKCE) e entrega o ID
 * token; quem decide se a pessoa entra é a API, que valida o token e confere se
 * existe cadastro no Synergy (PRD seção 3.4.4).
 *
 * As duas variáveis são resolvidas no build, como a VITE_API_URL: mudá-las no
 * servidor depois de buildar não tem efeito. Não são segredo — ficam embutidas
 * no bundle que o navegador baixa, e é assim que o fluxo foi desenhado.
 */

const TENANT_ID = import.meta.env.VITE_MS_TENANT_ID ?? ''
const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID ?? ''

/** Só o suficiente para identificar a pessoa: nada de acesso ao Graph. */
const ESCOPOS = ['openid', 'profile', 'email']

/** Sem configuração, a tela de login não mostra o botão. */
export function ssoMicrosoftHabilitado(): boolean {
  return TENANT_ID !== '' && CLIENT_ID !== ''
}

/** Erro do MSAL que representa desistência, não falha — não vira mensagem vermelha. */
export class LoginMicrosoftCancelado extends Error {
  constructor() {
    super('login com a Microsoft cancelado')
    this.name = 'LoginMicrosoftCancelado'
  }
}

let instancia: PublicClientApplication | null = null
let inicializacao: Promise<PublicClientApplication> | null = null
/** Guardado para o tratamento de erro consultar os códigos sem novo await. */
let msal: typeof import('@azure/msal-browser') | null = null

/**
 * Cria e inicializa o MSAL uma única vez.
 *
 * A biblioteca entra por `import()` dinâmico: ela pesa mais que todo o resto do
 * app somado, e só a tela de login precisa dela. Assim ela vira um chunk
 * separado, baixado quando a tela de login aparece — as outras páginas não
 * pagam esse custo.
 *
 * A promessa é memoizada porque `initialize()` precisa terminar antes de
 * qualquer chamada — e porque a tela de login dispara isso ao montar, para que
 * o clique no botão só chame `loginPopup`. Se o download e o `await` da
 * inicialização acontecessem dentro do clique, o navegador poderia tratar a
 * janela como popup não solicitado pelo usuário e bloqueá-la.
 */
export function prepararMicrosoft(): Promise<PublicClientApplication> {
  if (!ssoMicrosoftHabilitado()) {
    return Promise.reject(new Error('SSO da Microsoft não está configurado'))
  }
  if (inicializacao) return inicializacao

  inicializacao = (async () => {
    msal = await import('@azure/msal-browser')

    const app = new msal.PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
      },
      cache: {
        // sessionStorage: a sessão do MSAL morre com a aba. Quem decide se a
        // sessão do Synergy sobrevive é o "Manter sessão neste dispositivo",
        // que controla o armazenamento do NOSSO token.
        cacheLocation: 'sessionStorage',
      },
    })
    await app.initialize()
    instancia = app
    return app
  })()

  return inicializacao
}

/**
 * Abre o login da Microsoft e devolve o ID token.
 *
 * O cache é limpo em seguida, com ou sem sucesso: o Synergy não usa a sessão do
 * MSAL para nada depois deste ponto (a sessão é o nosso JWT). Sem limpar, uma
 * segunda tentativa reaproveitaria a conta em cache silenciosamente — o que
 * confunde justamente quem falhou por não ter cadastro e quer tentar com outra
 * conta.
 */
export async function obterIdTokenMicrosoft(): Promise<string> {
  const app = await prepararMicrosoft()

  try {
    const resultado = await app.loginPopup({ scopes: ESCOPOS, prompt: 'select_account' })
    if (!resultado.idToken) {
      throw new Error('a Microsoft não devolveu um ID token')
    }
    return resultado.idToken
  } catch (erro) {
    if (msal && erro instanceof msal.BrowserAuthError) {
      const { userCancelled, popupWindowError } = msal.BrowserAuthErrorCodes
      if (erro.errorCode === userCancelled || erro.errorCode === popupWindowError) {
        throw new LoginMicrosoftCancelado()
      }
    }
    throw erro
  } finally {
    await limparSessaoMicrosoft()
  }
}

/** Limpa o cache local do MSAL. Não encerra a sessão da pessoa na Microsoft. */
async function limparSessaoMicrosoft(): Promise<void> {
  try {
    await (instancia ?? (await prepararMicrosoft())).clearCache()
  } catch {
    // Falhar ao limpar o cache não deve derrubar um login que deu certo.
  }
}
