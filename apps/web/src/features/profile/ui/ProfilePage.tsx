import { useEffect, useState, type FormEvent } from 'react'

import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorBanner,
  Icon,
  Input,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { authApi } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { MovingMotivatorsCard } from '@/features/motivators/ui/MovingMotivatorsCard'
import { ApiError } from '@/services/httpClient'
import { ROLE_LABEL } from '@/types'

/**
 * Perfil do próprio usuário: dados cadastrais e troca de senha (PRD seção 3.3).
 *
 * Tudo em um cartão só, em fluxo vertical — dividir em dois blocos lado a lado
 * criava duas colunas competindo pela atenção sem necessidade.
 *
 * XP e nível existem no modelo de dados e vêm na resposta de `GET /me`, mas não
 * são exibidos: não há nenhuma regra que os altere, então todo usuário ficaria
 * permanentemente em "nível 1 / 0 XP". A tela volta a mostrá-los quando o épico
 * de Gamificação definir o que gera XP (PRD seção 5).
 */
export function ProfilePage() {
  const { me } = useAuth()

  if (!me) return <Spinner />

  return (
    <>
      <PageHeader
        title="Meu perfil"
        subtitle="Seus dados cadastrais, sua senha e seus motivadores"
      />

      <div className="space-y-4">
        <Card className="max-w-2xl p-6 sm:p-8">
          <Identificacao />
          <hr className="my-7 border-outline" />
          <FormDados />
          <hr className="my-7 border-outline" />
          <FormSenha />
        </Card>

        <MovingMotivatorsCard />
      </div>
    </>
  )
}

/** Cabeçalho do cartão: quem você é, sem campos editáveis. */
function Identificacao() {
  const { me } = useAuth()
  if (!me) return null

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="scale-125">
        <Avatar name={me.user.name} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-display truncate text-xl font-bold text-content">{me.user.name}</h2>
        <p className="truncate text-sm text-content-muted">{me.user.email}</p>
      </div>
      <div className="text-right">
        <Badge tone={me.user.role === 'ADMIN' ? 'primary' : 'secondary'}>
          {ROLE_LABEL[me.user.role]}
        </Badge>
        <p className="mt-1.5 text-xs text-content-muted">
          No Synergy desde {new Date(me.user.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  )
}

function FormDados() {
  const { me, refresh } = useAuth()
  const [name, setName] = useState(me?.user.name ?? '')
  const [hobby, setHobby] = useState(me?.profile.hobby ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Mantém o formulário alinhado com a sessão quando ela é recarregada.
  useEffect(() => {
    setName(me?.user.name ?? '')
    setHobby(me?.profile.hobby ?? '')
  }, [me?.user.name, me?.profile.hobby])

  if (!me) return null

  const alterado = name !== me.user.name || hobby !== me.profile.hobby

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvo(false)
    setSalvando(true)
    try {
      await authApi.updateMe({ name, hobby })
      await refresh()
      setSalvo(true)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Nome"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="Hobby"
          maxLength={120}
          value={hobby}
          placeholder="Escalada, xadrez, cerâmica…"
          hint="Opcional — ajuda o time a te conhecer"
          onChange={(event) => setHobby(event.target.value)}
        />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-content-muted">
        <Icon name="lock" className="text-[15px]" />
        E-mail e papel são definidos pelo Admin e não podem ser alterados aqui.
      </p>

      {erro ? <ErrorBanner message={erro} /> : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {salvo && !alterado ? (
          <p className="mr-auto flex items-center gap-1.5 text-sm text-success">
            <Icon name="check_circle" className="text-[18px]" />
            Dados atualizados.
          </p>
        ) : null}
        <Button type="submit" icon="save" disabled={salvando || !alterado}>
          {salvando ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </div>
    </form>
  )
}

function FormSenha() {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [trocada, setTrocada] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setTrocada(false)

    // Confirmação é checada só no cliente: a API não precisa dela.
    if (nova !== confirmacao) {
      setErro('A confirmação não confere com a nova senha.')
      return
    }

    setEnviando(true)
    try {
      await authApi.changePassword(atual, nova)
      setAtual('')
      setNova('')
      setConfirmacao('')
      setTrocada(true)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h3 className="font-display text-lg font-bold text-content">Alterar senha</h3>

      <Input
        label="Senha atual"
        type="password"
        autoComplete="current-password"
        required
        value={atual}
        onChange={(event) => setAtual(event.target.value)}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="Mínimo de 8 caracteres"
          value={nova}
          onChange={(event) => setNova(event.target.value)}
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
      </div>

      {erro ? <ErrorBanner message={erro} /> : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {trocada ? (
          <p className="mr-auto flex items-start gap-1.5 text-sm text-success">
            <Icon name="check_circle" className="text-[18px]" />
            Senha alterada. Sessões abertas em outros dispositivos seguem válidas até expirar.
          </p>
        ) : null}
        <Button type="submit" icon="key" disabled={enviando}>
          {enviando ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </div>
    </form>
  )
}
