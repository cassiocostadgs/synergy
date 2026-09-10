import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { Button, Card, ErrorBanner, Input } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  LoginMicrosoftCancelado,
  prepararMicrosoft,
  ssoMicrosoftHabilitado,
} from '@/features/auth/microsoft'
import { ApiError } from '@/services/httpClient'

/**
 * Pede ao navegador para guardar as credenciais (o prompt nativo de "salvar
 * senha"). Em SPA o navegador costuma não oferecer sozinho, porque não há
 * navegação após o submit — a Credential Management API resolve isso.
 *
 * Implementada em Chrome e Edge; Firefox e Safari não expõem PasswordCredential,
 * e nesses casos a função simplesmente não faz nada (o autocomplete dos campos
 * já dá ao gerenciador de senhas o que ele precisa).
 */
async function ofertarSalvarSenha(email: string, senha: string): Promise<void> {
  const suporte = window as Window & {
    PasswordCredential?: new (data: { id: string; password: string }) => Credential
  }
  if (!suporte.PasswordCredential || !navigator.credentials) return

  try {
    const credencial = new suporte.PasswordCredential({ id: email, password: senha })
    await navigator.credentials.store(credencial)
  } catch {
    // O usuário pode recusar o prompt — não é erro do login.
  }
}

/**
 * Marca da Microsoft, em SVG.
 *
 * Vem inline porque as diretrizes de marca pedem o logotipo no botão de "Entrar
 * com Microsoft" — é o que faz a pessoa reconhecer para onde vai — e o
 * Material Symbols não tem logotipos de marca.
 */
function MarcaMicrosoft() {
  return (
    <svg viewBox="0 0 21 21" className="size-4 shrink-0" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

export function LoginPage() {
  const { me, loading, login, loginComMicrosoft } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Erro do SSO fica separado do erro de senha para cada mensagem aparecer
  // junto do botão que falhou.
  const [erroSSO, setErroSSO] = useState<string | null>(null)
  const [entrandoComMicrosoft, setEntrandoComMicrosoft] = useState(false)

  const comSSO = ssoMicrosoftHabilitado()

  // Inicializa o MSAL ao montar. Se isso ficasse dentro do clique, o `await`
  // antes de abrir a janela faria o navegador tratá-la como popup não
  // solicitado — e bloqueá-la.
  useEffect(() => {
    if (comSSO) void prepararMicrosoft().catch(() => undefined)
  }, [comSSO])

  if (!loading && me) {
    return <Navigate to="/times" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setErroSSO(null)
    setSubmitting(true)
    try {
      await login(email, password, lembrar)
      // Só oferece guardar a senha depois de o login dar certo.
      await ofertarSalvarSenha(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMicrosoft() {
    setError(null)
    setErroSSO(null)
    setEntrandoComMicrosoft(true)
    try {
      await loginComMicrosoft(lembrar)
    } catch (err) {
      if (err instanceof LoginMicrosoftCancelado) {
        // Fechar a janela é desistência, não falha: nada a informar.
        return
      }
      // A mensagem do erro SSO_SEM_CADASTRO já traz o e-mail usado e a
      // instrução de procurar o administrador — vem da API de propósito, para
      // não haver duas versões do mesmo texto.
      setErroSSO(
        err instanceof ApiError ? err.message : 'Não foi possível entrar com a Microsoft',
      )
    } finally {
      setEntrandoComMicrosoft(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 shadow-glow-primary">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" orientation="vertical" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-content-muted">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(event) => setLembrar(event.target.checked)}
              className="size-4 accent-primary"
            />
            Manter sessão neste dispositivo
          </label>

          {error ? <ErrorBanner message={error} /> : null}

          <Button
            type="submit"
            icon="login"
            disabled={submitting || entrandoComMicrosoft}
            className="w-full"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        {comSSO ? (
          <div className="mt-5">
            <div className="mb-4 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-outline" />
              <span className="text-xs text-content-muted">ou</span>
              <span className="h-px flex-1 bg-outline" />
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => void handleMicrosoft()}
              disabled={submitting || entrandoComMicrosoft}
            >
              <MarcaMicrosoft />
              {entrandoComMicrosoft ? 'Aguardando a Microsoft…' : 'Entrar com Microsoft'}
            </Button>

            {erroSSO ? (
              <div className="mt-4">
                <ErrorBanner message={erroSSO} />
              </div>
            ) : null}

            <p className="mt-3 text-xs text-content-muted">
              Use a conta da empresa. O acesso precisa ter sido cadastrado aqui antes — a
              Microsoft confirma quem você é, não libera o acesso.
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-content-muted">
          Sem a opção marcada, a sessão é encerrada ao fechar o navegador — recomendado em
          computador compartilhado.
        </p>
      </Card>
    </main>
  )
}
