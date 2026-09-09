import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import { authApi } from '@/features/auth/api/authApi'
import { getToken, setToken } from '@/services/httpClient'
import type { Me } from '@/types'

interface AuthContextValue {
  me: Me | null
  /** true enquanto a sessão inicial é restaurada do token salvo. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null)
      setLoading(false)
      return
    }
    try {
      setMe(await authApi.me())
    } catch {
      // Token inválido/expirado: o httpClient já o descartou.
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    setToken(result.token)
    setMe(await authApi.me())
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setMe(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ me, loading, login, logout, refresh }),
    [me, loading, login, logout, refresh],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  }
  return context
}
