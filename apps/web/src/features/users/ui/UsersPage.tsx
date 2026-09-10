import { useEffect, useState, type FormEvent } from 'react'

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
  const [papelDe, setPapelDe] = useState<User | null>(null)
  const [senhaDe, setSenhaDe] = useState<User | null>(null)

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
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {ehVoceMesmo ? (
                            // O próprio Admin não altera papel, senha nem status
                            // por aqui — as guardas estão na API e a UI reflete.
                            <span className="text-xs text-content-muted">Você</span>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                icon="badge"
                                disabled={emAndamento === user.id}
                                className="px-2 py-1 text-xs"
                                onClick={() => setPapelDe(user)}
                              >
                                Papel
                              </Button>
                              <Button
                                variant="ghost"
                                icon="key"
                                disabled={emAndamento === user.id}
                                className="px-2 py-1 text-xs"
                                onClick={() => setSenhaDe(user)}
                              >
                                Senha
                              </Button>
                              <Button
                                variant={inativo ? 'secondary' : 'danger'}
                                icon={inativo ? 'person_check' : 'person_off'}
                                disabled={emAndamento === user.id}
                                className="px-2 py-1 text-xs"
                                onClick={() => void alternarStatus(user)}
                              >
                                {emAndamento === user.id
                                  ? 'Aguarde…'
                                  : inativo
                                    ? 'Reativar'
                                    : 'Inativar'}
                              </Button>
                            </>
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

      <AlterarPapelDialog
        user={papelDe}
        onClose={() => setPapelDe(null)}
        onSaved={() => {
          setPapelDe(null)
          void reload()
        }}
      />

      <RedefinirSenhaDialog user={senhaDe} onClose={() => setSenhaDe(null)} />
    </>
  )
}

/** Altera o papel global de outro usuário. */
function AlterarPapelDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null
  onClose: () => void
  onSaved: () => void
}) {
  const [role, setRole] = useState<Role>('COLABORADOR')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Reabre já refletindo o papel atual de quem foi escolhido.
  useEffect(() => {
    if (user) {
      setRole(user.role)
      setErro(null)
    }
  }, [user])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user) return

    setErro(null)
    setSalvando(true)
    try {
      await authApi.setUserRole(user.id, role)
      onSaved()
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível alterar o papel')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={user !== null} title="Alterar papel global" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-content-muted">
          Papel de <strong className="text-content">{user?.name}</strong>.
        </p>

        <Select
          label="Papel global"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          <option value="COLABORADOR">Colaborador</option>
          <option value="GESTOR">Gestor</option>
          <option value="ADMIN">Admin</option>
        </Select>

        <p className="rounded-lg border border-outline bg-surface-dim px-3 py-2 text-xs text-content-muted">
          Quem exerce papel de gestão em um time ativo não pode ser rebaixado a Colaborador —
          ajuste o time antes.
        </p>

        {erro ? <ErrorBanner message={erro} /> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={salvando || role === user?.role}>
            {salvando ? 'Salvando…' : 'Alterar papel'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Redefine a senha de outro usuário, sem exigir a antiga. */
function RedefinirSenhaDialog({
  user,
  onClose,
}: {
  user: User | null
  onClose: () => void
}) {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    if (user) {
      setSenha('')
      setConfirmacao('')
      setErro(null)
      setPronto(false)
    }
  }, [user])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user) return

    if (senha !== confirmacao) {
      setErro('A confirmação não confere com a nova senha.')
      return
    }

    setErro(null)
    setEnviando(true)
    try {
      await authApi.resetUserPassword(user.id, senha)
      setPronto(true)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível redefinir a senha')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={user !== null} title="Redefinir senha" onClose={onClose}>
      {pronto ? (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-success">
            <Icon name="check_circle" className="text-[18px]" />
            Senha de {user?.name} redefinida. Combine com a pessoa que ela troque por uma própria
            no perfil.
          </p>
          <p className="text-xs text-content-muted">
            As sessões já abertas dessa pessoa seguem válidas até expirar.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-content-muted">
            Nova senha para <strong className="text-content">{user?.name}</strong>. A senha atual
            não é necessária.
          </p>

          <Input
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="Mínimo de 8 caracteres"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
          />

          {erro ? <ErrorBanner message={erro} /> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" icon="key" disabled={enviando}>
              {enviando ? 'Redefinindo…' : 'Redefinir senha'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
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
