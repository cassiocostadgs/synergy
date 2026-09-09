import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorBanner,
  Icon,
  Input,
  KpiCard,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui'
import { authApi } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { teamsApi } from '@/features/teams/api/teamsApi'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useResource } from '@/hooks/useResource'
import { ApiError } from '@/services/httpClient'
import type { User } from '@/types'

export function TeamsPage() {
  const { me } = useAuth()
  const { teams, loading, error, reload } = useTeams()
  const [dialogOpen, setDialogOpen] = useState(false)

  const isAdmin = me?.user.role === 'ADMIN'
  const canCreate = isAdmin || me?.user.role === 'GESTOR'

  const active = teams.filter((team) => team.status === 'ACTIVE').length
  const archived = teams.length - active

  return (
    <>
      <PageHeader
        title="Times"
        subtitle={
          isAdmin ? 'Todos os times da organização' : 'Times dos quais você participa'
        }
        actions={
          canCreate ? (
            <Button icon="add" onClick={() => setDialogOpen(true)}>
              Novo time
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Times visíveis" value={teams.length} icon="groups" />
        <KpiCard label="Times ativos" value={active} accent="secondary" icon="bolt" />
        <KpiCard label="Arquivados" value={archived} icon="inventory_2" />
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <Spinner /> : null}

      {!loading && teams.length === 0 ? (
        <Card>
          <EmptyState
            icon="groups"
            title="Nenhum time por aqui"
            description={
              canCreate
                ? 'Crie o primeiro time para começar a montar sua equipe.'
                : 'Você ainda não faz parte de nenhum time. Peça a um Gestor para incluir você.'
            }
            action={
              canCreate ? (
                <Button icon="add" onClick={() => setDialogOpen(true)}>
                  Criar time
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <Link key={team.id} to={`/times/${team.id}`} className="group">
            <Card className="h-full p-5 transition-all group-hover:border-primary/60 group-hover:shadow-glow-primary">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-bold tracking-tight text-content">
                  {team.name}
                </h2>
                <Badge tone={team.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {team.status === 'ACTIVE' ? 'Ativo' : 'Arquivado'}
                </Badge>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-content-muted">
                <Icon name="calendar_month" className="text-[15px]" />
                Criado em {new Date(team.createdAt).toLocaleDateString('pt-BR')}
              </p>
              <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-secondary">
                Ver membros
                <Icon name="arrow_forward" className="text-[16px]" />
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <CreateTeamDialog
        open={dialogOpen}
        isAdmin={isAdmin}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false)
          void reload()
        }}
      />
    </>
  )
}

function CreateTeamDialog({
  open,
  isAdmin,
  onClose,
  onCreated,
}: {
  open: boolean
  isAdmin: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [principalUserId, setPrincipalUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // O Admin precisa escolher quem lidera o time; só Gestores/Admins podem gerir.
  const { data: users } = useResource<User[]>(authApi.listUsers, open && isAdmin)
  const eligible = (users ?? []).filter(
    (user) => user.role === 'GESTOR' || user.role === 'ADMIN',
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await teamsApi.create(name, isAdmin ? principalUserId : undefined)
      setName('')
      setPrincipalUserId('')
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o time')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} title="Novo time" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome do time"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Squad Neon"
        />

        {isAdmin ? (
          <Select
            label="Gestor Principal"
            required
            value={principalUserId}
            onChange={(event) => setPrincipalUserId(event.target.value)}
          >
            <option value="">Selecione…</option>
            {eligible.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
        ) : (
          <p className="rounded-lg border border-outline bg-surface-dim px-3 py-2 text-xs text-content-muted">
            Você será o <strong className="text-primary">Gestor Principal</strong> deste time.
          </p>
        )}

        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={submitting}>
            {submitting ? 'Criando…' : 'Criar time'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
