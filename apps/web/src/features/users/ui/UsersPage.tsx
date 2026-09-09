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
  cx,
} from '@/components/ui'
import { authApi } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { teamsApi } from '@/features/teams/api/teamsApi'
import { useResource } from '@/hooks/useResource'
import { ApiError } from '@/services/httpClient'
import {
  ROLE_LABEL,
  TEAM_ROLE_LABEL,
  type Role,
  type Team,
  type TeamRole,
  type User,
} from '@/types'

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
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [emAndamento, setEmAndamento] = useState<string | null>(null)

  const users = data ?? []
  const inativos = users.filter((user) => user.status === 'INACTIVE').length

  async function alternarStatus(user: User) {
    const inativando = user.status === 'ACTIVE'
    const confirmacao = inativando
      ? `Inativar o acesso de ${user.name}? A pessoa perde o acesso imediatamente, mas continua nos times de que participa.`
      : `Reativar o acesso de ${user.name}?`
    if (!confirm(confirmacao)) return

    setErroAcao(null)
    setEmAndamento(user.id)
    try {
      await authApi.setUserStatus(user.id, inativando ? 'INACTIVE' : 'ACTIVE')
      await reload()
    } catch (err) {
      setErroAcao(err instanceof ApiError ? err.message : 'Não foi possível alterar o status')
    } finally {
      setEmAndamento(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle={
          isAdmin
            ? `Cadastro e visão geral dos acessos${inativos > 0 ? ` · ${inativos} inativo${inativos > 1 ? 's' : ''}` : ''}`
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
      {erroAcao ? (
        <div className="mb-4">
          <ErrorBanner message={erroAcao} />
        </div>
      ) : null}
      {loading ? <Spinner /> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline text-[13px] tracking-[0.14em] text-content-muted uppercase">
                <th className="px-5 py-3 font-semibold">Usuário</th>
                <th className="px-5 py-3 font-semibold">Papel global</th>
                <th className="px-5 py-3 font-semibold">Situação</th>
                <th className="px-5 py-3 font-semibold">Desde</th>
                {isAdmin ? <th className="px-5 py-3 text-right font-semibold">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const inativo = user.status === 'INACTIVE'
                const ehVoceMesmo = user.id === me?.user.id

                return (
                  <tr
                    key={user.id}
                    className={cx(
                      'border-b border-outline/60 transition-colors last:border-0 hover:bg-surface-container-high',
                      // Inativos ficam esmaecidos para se distinguirem à primeira vista.
                      inativo && 'opacity-55',
                    )}
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
                    <td className="px-5 py-3">
                      <Badge tone={inativo ? 'neutral' : 'success'}>
                        {inativo ? 'Inativo' : 'Ativo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-content-muted">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    {isAdmin ? (
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          {ehVoceMesmo ? (
                            <span className="text-xs text-content-muted">Você</span>
                          ) : (
                            <Button
                              variant={inativo ? 'secondary' : 'danger'}
                              icon={inativo ? 'person_check' : 'person_off'}
                              disabled={emAndamento === user.id}
                              className="px-2.5 py-1 text-xs"
                              onClick={() => void alternarStatus(user)}
                            >
                              {emAndamento === user.id
                                ? 'Aguarde…'
                                : inativo
                                  ? 'Reativar'
                                  : 'Inativar'}
                            </Button>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
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
        onReload={() => void reload()}
      />
    </>
  )
}

function CreateUserDialog({
  open,
  onClose,
  onCreated,
  onReload,
}: {
  open: boolean
  onClose: () => void
  /** Recarrega a lista e fecha o diálogo. */
  onCreated: () => void
  /** Recarrega a lista mantendo o diálogo aberto (falha parcial). */
  onReload: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('COLABORADOR')
  const [teamId, setTeamId] = useState('')
  const [teamRole, setTeamRole] = useState<TeamRole>('COLABORADOR')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Times arquivados não aceitam alteração de membros, então nem são oferecidos.
  const { data: teams } = useResource<Team[]>(teamsApi.list, open)
  const activeTeams = (teams ?? []).filter((team) => team.status === 'ACTIVE')

  // Gestor de Apoio exige papel global de Gestor ou Admin (regra do backend),
  // então a opção só aparece quando o papel escolhido permite.
  const canBeSupportManager = role === 'GESTOR' || role === 'ADMIN'

  function resetForm() {
    setName('')
    setEmail('')
    setPassword('')
    setRole('COLABORADOR')
    setTeamId('')
    setTeamRole('COLABORADOR')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    let created
    try {
      created = await authApi.createUser({ name, email, password, role })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o usuário')
      setSubmitting(false)
      return
    }

    // O vínculo é uma segunda chamada — a API não tem endpoint que crie o usuário
    // já dentro do time. Se ela falhar, o usuário já existe, então avisamos disso
    // explicitamente em vez de fazer parecer que nada aconteceu.
    if (teamId) {
      try {
        await teamsApi.addMember(teamId, created.id, teamRole)
      } catch (err) {
        const motivo = err instanceof ApiError ? err.message : 'erro inesperado'
        setError(
          `Usuário ${created.name} foi criado, mas o vínculo com o time falhou: ${motivo}. ` +
            'Adicione-o pelo painel de membros do time.',
        )
        setSubmitting(false)
        onReload()
        return
      }
    }

    setSubmitting(false)
    resetForm()
    onCreated()
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
          onChange={(event) => {
            const novoPapel = event.target.value as Role
            setRole(novoPapel)
            // Colaborador global não pode ser Gestor de Apoio de um time.
            if (novoPapel === 'COLABORADOR') setTeamRole('COLABORADOR')
          }}
        >
          <option value="COLABORADOR">Colaborador</option>
          <option value="GESTOR">Gestor</option>
          <option value="ADMIN">Admin</option>
        </Select>

        <div className="space-y-4 rounded-lg border border-outline bg-surface-dim/60 p-3">
          <Select
            label="Vincular a um time (opcional)"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">Não vincular agora</option>
            {activeTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>

          {teamId ? (
            <>
              <Select
                label="Papel no time"
                value={teamRole}
                onChange={(event) => setTeamRole(event.target.value as TeamRole)}
              >
                <option value="COLABORADOR">{TEAM_ROLE_LABEL.COLABORADOR}</option>
                {canBeSupportManager ? (
                  <option value="GESTOR_APOIO">{TEAM_ROLE_LABEL.GESTOR_APOIO}</option>
                ) : null}
              </Select>
              <p className="text-xs text-content-muted">
                O Gestor Principal é definido na criação do time e só muda por transferência de
                liderança. O time admite <strong className="text-secondary">1 Gestor de Apoio</strong>.
              </p>
            </>
          ) : null}
        </div>

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
