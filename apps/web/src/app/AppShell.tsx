import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { Avatar, Icon, cx } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ROLE_LABEL, type Role } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: string
  /** Quando definido, o item só aparece para estes papéis globais. */
  roles?: Role[]
}

// Navegação por área do produto. Perfil não entra aqui: é alcançado pelo bloco
// do usuário no canto superior direito.
const NAV_ITEMS: NavItem[] = [
  { to: '/times', label: 'Times', icon: 'groups' },
  { to: '/usuarios', label: 'Usuários', icon: 'badge', roles: ['ADMIN', 'GESTOR'] },
  // Radar expõe dado agregado de motivação do time: Colaborador não acessa.
  { to: '/radar', label: 'Radar', icon: 'radar', roles: ['ADMIN', 'GESTOR'] },
  { to: '/sorteio', label: 'Sorteio', icon: 'casino' },
  { to: '/brackets', label: 'Brackets', icon: 'emoji_events' },
]

function visibleItems(role: Role | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)))
}

/**
 * Layout base do sistema (DESIGN-SYSTEM.md seção 3): SideNavBar fixa + TopNavBar
 * sticky no desktop, com BottomNavBar flutuante no mobile.
 */
export function AppShell() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const items = visibleItems(me?.user.role)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* SideNavBar — desktop */}
      {/*
        Largura ajustada ao conteúdo (w-52): com w-64 sobrava espaço vazio à
        direita dos rótulos. Sem divisórias horizontais internas — o painel é um
        bloco único, separado do conteúdo apenas pela borda direita e pelo fundo.
      */}
      <aside className="fixed inset-y-0 left-0 hidden w-52 flex-col border-r border-outline bg-surface-container-low/80 backdrop-blur-sm lg:flex">
        <div className="px-4 py-5">
          <Logo size="sm" />
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'border-primary bg-primary-soft text-primary shadow-glow-primary'
                    : 'border-transparent text-content-muted hover:bg-surface-container-high hover:text-content',
                )
              }
            >
              <Icon name={item.icon} className="text-[20px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé: encerrar sessão fica no canto inferior esquerdo. */}
        <div className="px-3 py-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-container-high hover:text-danger"
          >
            <Icon name="logout" className="text-[20px]" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-52">
        {/* TopNavBar */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-outline bg-surface-dim/85 px-4 backdrop-blur-md sm:px-8">
          <Logo size="sm" className="lg:hidden" />

          {/* Canto superior direito: atalho para o próprio perfil. */}
          {me ? (
            <NavLink
              to="/perfil"
              title="Meu perfil"
              className={({ isActive }) =>
                cx(
                  'ml-auto flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors',
                  isActive ? 'bg-primary-soft' : 'hover:bg-surface-container-high',
                )
              }
            >
              <span className="hidden text-right sm:block">
                <span className="block text-sm font-semibold text-content">{me.user.name}</span>
                {/* Sem "Nível N": a gamificação não tem regra que altere o
                    nível, então o valor seria sempre 1 (PRD seção 5). */}
                <span className="block text-[13px] tracking-wide text-content-muted uppercase">
                  {ROLE_LABEL[me.user.role]}
                </span>
              </span>
              <Avatar name={me.user.name} tone="secondary" />
            </NavLink>
          ) : null}
        </header>

        {/*
          O respiro inferior reserva espaço para a BottomNavBar flutuante, que
          passa por cima do conteúdo. Em janela baixa ele encolhe para o mínimo
          que a barra ocupa (altura + o `bottom-4` dela): 28 dá folga que ali
          custa caro. O topo também aperta um pouco.
        */}
        <main className="flex-1 px-4 pt-6 pb-28 sm:px-8 lg:pb-10 [@media(max-height:760px)]:pt-4 max-lg:[@media(max-height:760px)]:pb-24">
          <Outlet />
        </main>
      </div>

      {/*
        BottomNavBar flutuante — mobile, onde a SideNavBar fica oculta. "Sair" vem
        primeiro (à esquerda) para espelhar a posição que ocupa no rodapé da
        lateral no desktop.
      */}
      <nav className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-around rounded-2xl border border-outline bg-surface-container/90 px-2 py-2 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-0.5 px-2 py-1.5 text-[13px] font-medium text-content-muted"
        >
          <Icon name="logout" className="text-[20px]" />
          Sair
        </button>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cx(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[13px] font-medium transition-colors',
                isActive ? 'bg-primary-soft text-primary' : 'text-content-muted',
              )
            }
          >
            <Icon name={item.icon} className="text-[20px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
