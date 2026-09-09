import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Spinner } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { Role } from '@/types'

/** Exige sessão ativa; redireciona ao login preservando a rota pretendida. */
export function RequireAuth({ children }: PropsWithChildren) {
  const { me, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Restaurando sessão…" />
      </div>
    )
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

/**
 * Restringe a rota a papéis globais. As regras de escopo por time (RN2) são
 * aplicadas pela API — aqui apenas evitamos exibir telas inúteis ao usuário.
 */
export function RequireRole({ roles, children }: PropsWithChildren<{ roles: Role[] }>) {
  const { me } = useAuth()

  if (me && !roles.includes(me.user.role)) {
    return <Navigate to="/times" replace />
  }

  return children
}
