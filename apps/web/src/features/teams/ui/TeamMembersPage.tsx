import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  ErrorBanner,
  Icon,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui'
import { authApi } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { teamsApi } from '@/features/teams/api/teamsApi'
import { useTeamMembers } from '@/features/teams/hooks/useTeamMembers'
import { useResource } from '@/hooks/useResource'
import { ApiError } from '@/services/httpClient'
import { TEAM_ROLE_LABEL, type TeamMember, type TeamRole, type User } from '@/types'

const ROLE_TONE: Record<TeamRole, 'primary' | 'secondary' | 'neutral'> = {
  GESTOR_PRINCIPAL: 'primary',
  GESTOR_APOIO: 'secondary',
  COLABORADOR: 'neutral',
}

export function TeamMembersPage() {
  const { teamId = '' } = useParams()
  const { me } = useAuth()
  const isAdmin = me?.user.role === 'ADMIN'

  const { team, members, canManage, canTransfer, loading, error, reload } = useTeamMembers(
    teamId,
    me?.user.id,
    isAdmin,
  )

  const [actionError, setActionError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const archived = team?.status === 'ARCHIVED'
  const canMutate = canManage && !archived

  async function runAction(userId: string, action: () => Promise<unknown>) {
    setActionError(null)
    setBusyUserId(userId)
    try {
      await action()
      await reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação')
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleArchive() {
    if (!confirm('Arquivar este time? Ele deixará de aceitar alterações de membros.')) return
    setActionError(null)
    try {
      await teamsApi.archive(teamId)
      await reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível arquivar o time')
    }
  }

  if (loading && !team) return <Spinner label="Carregando time…" />
  if (error && !team) return <ErrorBanner message={error} />

  return (
    <>
      <Link
        to="/times"
        className="mb-4 inline-flex items-center gap-1 text-sm text-content-muted transition-colors hover:text-secondary"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Voltar aos times
      </Link>

      <PageHeader
        title={team?.name ?? 'Time'}
        subtitle={`${members.length} ${members.length === 1 ? 'membro' : 'membros'}`}
        actions={
          <>
            {archived ? <Badge tone="neutral">Arquivado</Badge> : <Badge tone="success">Ativo</Badge>}
            {canMutate ? (
              <>
                <Button variant="ghost" icon="edit" onClick={() => setRenameOpen(true)}>
                  Renomear
                </Button>
                <Button variant="ghost" icon="inventory_2" onClick={handleArchive}>
                  Arquivar
                </Button>
                <Button icon="person_add" onClick={() => setAddOpen(true)}>
                  Adicionar membro
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {archived ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <Icon name="info" className="text-[18px]" />
          Time arquivado: alterações de membros estão bloqueadas.
        </div>
      ) : null}

      {!canManage && !archived ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-outline bg-surface-container/60 px-3 py-2 text-sm text-content-muted">
          <Icon name="lock" className="text-[18px]" />
          Apenas os Gestores deste time podem alterar os membros.
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <ErrorBanner message={actionError} />
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline text-[13px] tracking-[0.14em] text-content-muted uppercase">
                <th className="px-5 py-3 font-semibold">Membro</th>
                <th className="px-5 py-3 font-semibold">Papel no time</th>
                <th className="px-5 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  teamId={teamId}
                  canMutate={canMutate}
                  canTransfer={canTransfer && !archived}
                  busy={busyUserId === member.userId}
                  onAction={runAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AddMemberDialog
        open={addOpen}
        teamId={teamId}
        existing={members}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false)
          void reload()
        }}
      />

      <RenameTeamDialog
        open={renameOpen}
        teamId={teamId}
        currentName={team?.name ?? ''}
        onClose={() => setRenameOpen(false)}
        onRenamed={() => {
          setRenameOpen(false)
          void reload()
        }}
      />
    </>
  )
}

function MemberRow({
  member,
  teamId,
  canMutate,
  canTransfer,
  busy,
  onAction,
}: {
  member: TeamMember
  teamId: string
  canMutate: boolean
  canTransfer: boolean
  busy: boolean
  onAction: (userId: string, action: () => Promise<unknown>) => Promise<void>
}) {
  const isPrincipal = member.role === 'GESTOR_PRINCIPAL'

  return (
    <tr className="border-b border-outline/60 transition-colors last:border-0 hover:bg-surface-container-high">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={member.name} tone={isPrincipal ? 'primary' : 'secondary'} />
          <div>
            <p className="font-semibold text-content">{member.name}</p>
            <p className="text-xs text-content-muted">{member.email}</p>
          </div>
        </div>
      </td>

      <td className="px-5 py-3">
        <Badge tone={ROLE_TONE[member.role]}>{TEAM_ROLE_LABEL[member.role]}</Badge>
      </td>

      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-2">
          {busy ? <span className="text-xs text-content-muted">Processando…</span> : null}

          {/* RN1: o Gestor Principal não troca de papel nem sai sem transferência. */}
          {canMutate && !isPrincipal ? (
            <select
              aria-label={`Alterar papel de ${member.name}`}
              value={member.role}
              disabled={busy}
              onChange={(event) =>
                void onAction(member.userId, () =>
                  teamsApi.changeMemberRole(
                    teamId,
                    member.userId,
                    event.target.value as TeamRole,
                  ),
                )
              }
              className="rounded-lg border border-outline bg-surface-dim px-2 py-1 text-xs text-content focus:border-primary focus:outline-none"
            >
              <option value="COLABORADOR">Colaborador</option>
              <option value="GESTOR_APOIO">Gestor de Apoio</option>
            </select>
          ) : null}

          {canTransfer && !isPrincipal ? (
            <Button
              variant="secondary"
              icon="swap_horiz"
              disabled={busy}
              className="px-2.5 py-1 text-xs"
              onClick={() => {
                if (!confirm(`Transferir a liderança do time para ${member.name}?`)) return
                void onAction(member.userId, () =>
                  teamsApi.transferPrincipal(teamId, member.userId),
                )
              }}
            >
              Liderança
            </Button>
          ) : null}

          {canMutate && !isPrincipal ? (
            <Button
              variant="danger"
              icon="person_remove"
              disabled={busy}
              className="px-2.5 py-1 text-xs"
              onClick={() => {
                if (!confirm(`Remover ${member.name} do time?`)) return
                void onAction(member.userId, () => teamsApi.removeMember(teamId, member.userId))
              }}
            >
              Remover
            </Button>
          ) : null}

          {isPrincipal ? (
            <span className="text-xs text-content-muted">Liderança do time</span>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

function AddMemberDialog({
  open,
  teamId,
  existing,
  onClose,
  onAdded,
}: {
  open: boolean
  teamId: string
  existing: TeamMember[]
  onClose: () => void
  onAdded: () => void
}) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<TeamRole>('COLABORADOR')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: users } = useResource<User[]>(authApi.listUsers, open)
  const memberIds = new Set(existing.map((member) => member.userId))
  const candidates = (users ?? []).filter((user) => !memberIds.has(user.id))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await teamsApi.addMember(teamId, userId, role)
      setUserId('')
      setRole('COLABORADOR')
      onAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível adicionar o membro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} title="Adicionar membro" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Usuário"
          required
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        >
          <option value="">Selecione…</option>
          {candidates.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.email})
            </option>
          ))}
        </Select>

        <Select
          label="Papel no time"
          value={role}
          onChange={(event) => setRole(event.target.value as TeamRole)}
        >
          <option value="COLABORADOR">Colaborador</option>
          <option value="GESTOR_APOIO">Gestor de Apoio</option>
        </Select>

        <p className="rounded-lg border border-outline bg-surface-dim px-3 py-2 text-xs text-content-muted">
          O time admite <strong className="text-secondary">1 Gestor de Apoio</strong>. Para trocar
          o Gestor Principal, use a transferência de liderança.
        </p>

        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon="person_add" disabled={submitting}>
            {submitting ? 'Adicionando…' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function RenameTeamDialog({
  open,
  teamId,
  currentName,
  onClose,
  onRenamed,
}: {
  open: boolean
  teamId: string
  currentName: string
  onClose: () => void
  onRenamed: () => void
}) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await teamsApi.update(teamId, name)
      onRenamed()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível renomear o time')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} title="Renomear time" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome do time"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {error ? <ErrorBanner message={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={submitting}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
