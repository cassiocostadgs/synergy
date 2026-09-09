import { NavLink, Outlet, useNavigate } from 'react-router-dom'

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

const NAV_ITEMS: NavItem[] = [
  { to: '/times', label: 'Times', icon: 'groups' },
  { to: '/usuarios', label: 'Usuários', icon: 'badge', roles: ['ADMIN', 'GESTOR'] },
  { to: '/perfil', label: 'Perfil', icon: 'account_circle' },
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
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-outline bg-surface-container-low/80 backdrop-blur-sm lg:flex">
        <div className="border-b border-outline px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg border border-primary/40 bg-primary-soft">
              <Icon name="hub" className="text-[18px] text-primary" />
            </span>
            <span className="text-lg font-bold tracking-tight text-content">Synergy</span>
          </div>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.24em] text-secondary uppercase">
            Remote Intelligence
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
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

        {/* Rodapé com ações rápidas (DESIGN-SYSTEM.md seção 3.1) */}
        <div className="border-t border-outline px-3 py-4">
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

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* TopNavBar */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-outline bg-surface-dim/85 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg border border-primary/40 bg-primary-soft">
              <Icon name="hub" className="text-[18px] text-primary" />
            </span>
            <span className="font-bold tracking-tight text-content">Synergy</span>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-secondary'
                      : 'text-content-muted hover:text-content',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {me ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-content">{me.user.name}</p>
                  <p className="text-[11px] tracking-wide text-content-muted uppercase">
                    {ROLE_LABEL[me.user.role]} · Nível {me.profile.level}
                  </p>
                </div>
                <Avatar name={me.user.name} tone="secondary" />
              </>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-4 pt-6 pb-28 sm:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* BottomNavBar flutuante — mobile (DESIGN-SYSTEM.md seção 5.3) */}
      <nav className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-around rounded-2xl border border-outline bg-surface-container/90 px-2 py-2 backdrop-blur-md lg:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cx(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors',
                isActive ? 'bg-primary-soft text-primary' : 'text-content-muted',
              )
            }
          >
            <Icon name={item.icon} className="text-[20px]" />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-medium text-content-muted"
        >
          <Icon name="logout" className="text-[20px]" />
          Sair
        </button>
      </nav>
    </div>
  )
}
