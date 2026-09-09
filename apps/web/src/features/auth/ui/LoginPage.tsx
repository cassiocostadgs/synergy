import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { Button, Card, ErrorBanner, Input } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
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

export function LoginPage() {
  const { me, loading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && me) {
    return <Navigate to="/times" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
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

          <Button type="submit" icon="login" disabled={submitting} className="w-full">
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-4 text-xs text-content-muted">
          Sem a opção marcada, a sessão é encerrada ao fechar o navegador — recomendado em
          computador compartilhado.
        </p>
      </Card>
    </main>
  )
}
