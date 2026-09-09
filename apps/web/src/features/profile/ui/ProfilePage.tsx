import { Avatar, Badge, Card, KpiCard, PageHeader, Spinner } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ROLE_LABEL } from '@/types'

/**
 * Exposição mínima dos dados de gamificação que já existem no modelo (XP/nível).
 * As regras de ganho de XP são um épico fora do escopo deste MVP (PRD seção 5).
 */
export function ProfilePage() {
  const { me } = useAuth()

  if (!me) return <Spinner />

  const { user, profile } = me
  // Régua provisória de progresso: 1000 XP por nível, apenas para visualização.
  const xpPerLevel = 1000
  const progress = Math.min(100, Math.round(((profile.xp % xpPerLevel) / xpPerLevel) * 100))

  return (
    <>
      <PageHeader title="Meu perfil" subtitle="Seus dados e progresso no Synergy" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="scale-125">
              <Avatar name={user.name} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-content">{user.name}</h2>
              <p className="text-sm text-content-muted">{user.email}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-content-muted">Papel global</span>
              <Badge tone={user.role === 'ADMIN' ? 'primary' : 'secondary'}>
                {ROLE_LABEL[user.role]}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-muted">Hobby</span>
              <span className="text-content">{profile.hobby || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-muted">Membro desde</span>
              <span className="text-content">
                {new Date(user.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <KpiCard label="Nível atual" value={profile.level} icon="military_tech" />
          <KpiCard label="Experiência" value={`${profile.xp} XP`} accent="secondary" icon="bolt" />

          <Card className="p-5 sm:col-span-2">
            <p className="text-[13px] font-semibold tracking-[0.18em] text-content-muted uppercase">
              Progresso para o nível {profile.level + 1}
            </p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary shadow-glow-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-content-muted">
              {progress}% — as regras de ganho de XP serão definidas em um épico futuro.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
