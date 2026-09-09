import { useState, type FormEvent } from 'react'

import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui'
import { authApi } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useResource } from '@/hooks/useResource'
import { ApiError } from '@/services/httpClient'
import { ROLE_LABEL, type Role, type User } from '@/types'

const ROLE_TONE: Record<Role, 'primary' | 'secondary' | 'neutral'> = {
  ADMIN: 'primary',
  GESTOR: 'secondary',
  COLABORADOR: 'neutral',
}

export function UsersPage() {
  const { me } = useAuth()
  const isAdmin = me?.user.role === 'ADMIN'
  const { data, loading, error, reload } = useResource<User[]>(authApi.listUsers)
  const [dialogOpen, setDialogOpen] = useState(false)

  const users = data ?? []

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle={
          isAdmin
            ? 'Cadastro e visão geral dos acessos'
            : 'Pessoas disponíveis para compor os seus times'
        }
        actions={
          isAdmin ? (
            <Button icon="person_add" onClick={() => setDialogOpen(true)}>
              Novo usuário
            </Button>
          ) : undefined
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <Spinner /> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline text-[13px] tracking-[0.14em] text-content-muted uppercase">
                <th className="px-5 py-3 font-semibold">Usuário</th>
                <th className="px-5 py-3 font-semibold">Papel global</th>
                <th className="px-5 py-3 font-semibold">Desde</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-outline/60 transition-colors last:border-0 hover:bg-surface-container-high"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={user.name}
                        tone={user.role === 'ADMIN' ? 'primary' : 'secondary'}
                      />
                      <div>
                        <p className="font-semibold text-content">{user.name}</p>
                        <p className="text-xs text-content-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-content-muted">
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateUserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false)
          void reload()
        }}
      />
    </>
  )
}

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('COLABORADOR')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authApi.createUser({ name, email, password, role })
      setName('')
      setEmail('')
      setPassword('')
      setRole('COLABORADOR')
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o usuário')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} title="Novo usuário" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="E-mail"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Senha"
          type="password"
          required
          minLength={8}
          hint="Mínimo de 8 caracteres"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Select
          label="Papel global"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          <option value="COLABORADOR">Colaborador</option>
          <option value="GESTOR">Gestor</option>
          <option value="ADMIN">Admin</option>
        </Select>

        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={submitting}>
            {submitting ? 'Criando…' : 'Criar usuário'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
