import { useEffect, useRef, useState } from 'react'
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

// Navegação por área do produto. O que é do próprio usuário (perfil e sair) não
// entra aqui: vive no menu do canto superior direito.
const NAV_ITEMS: NavItem[] = [
  { to: '/times', label: 'Times', icon: 'groups' },
  { to: '/usuarios', label: 'Usuários', icon: 'badge', roles: ['ADMIN', 'GESTOR'] },
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

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha o menu do usuário ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menuOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  function handleLogout() {
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* SideNavBar — desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-outline bg-surface-container-low/80 backdrop-blur-sm lg:flex">
        <div className="border-b border-outline px-6 py-5">
          <Logo size="md" />
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
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* TopNavBar */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-outline bg-surface-dim/85 px-4 backdrop-blur-md sm:px-8">
          <Logo size="sm" className="lg:hidden" />

          {/*
            Canto superior direito: tudo que é do próprio usuário. A navegação por
            área do produto fica só na SideNavBar (e na BottomNavBar no mobile).
          */}
          {me ? (
            <div className="relative ml-auto" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-container-high"
              >
                <span className="hidden text-right sm:block">
                  <span className="block text-sm font-semibold text-content">{me.user.name}</span>
                  <span className="block text-[13px] tracking-wide text-content-muted uppercase">
                    {ROLE_LABEL[me.user.role]} · Nível {me.profile.level}
                  </span>
                </span>
                <Avatar name={me.user.name} tone="secondary" />
                <Icon
                  name={menuOpen ? 'expand_less' : 'expand_more'}
                  className="text-[20px] text-content-muted"
                />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-outline bg-surface-container/95 shadow-glow-primary backdrop-blur-md"
                >
                  <NavLink
                    to="/perfil"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary-soft text-primary'
                          : 'text-content hover:bg-surface-container-high',
                      )
                    }
                  >
                    <Icon name="account_circle" className="text-[20px]" />
                    Meu perfil
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 border-t border-outline px-4 py-3 text-sm font-medium text-content-muted transition-colors hover:bg-surface-container-high hover:text-danger"
                  >
                    <Icon name="logout" className="text-[20px]" />
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        <main className="flex-1 px-4 pt-6 pb-28 sm:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* BottomNavBar flutuante — mobile, onde a SideNavBar fica oculta */}
      <nav className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-around rounded-2xl border border-outline bg-surface-container/90 px-2 py-2 backdrop-blur-md lg:hidden">
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
