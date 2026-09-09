import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { Button, Card, ErrorBanner, Icon, Input } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ApiError } from '@/services/httpClient'

export function LoginPage() {
  const { me, loading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 shadow-glow-primary">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <span className="flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary-soft">
              <Icon name="hub" className="text-[26px] text-primary" />
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-content">Synergy</h1>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.28em] text-secondary uppercase">
            Remote Intelligence
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />

          {error ? <ErrorBanner message={error} /> : null}

          <Button type="submit" icon="login" disabled={submitting} className="w-full">
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </main>
  )
}
