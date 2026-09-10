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
import { obterIdTokenMicrosoft } from '@/features/auth/microsoft'
import { getToken, setToken } from '@/services/httpClient'
import type { Me } from '@/types'

interface AuthContextValue {
  me: Me | null
  /** true enquanto a sessão inicial é restaurada do token salvo. */
  loading: boolean
  /** `lembrar` decide se a sessão sobrevive ao fechar o navegador. */
  login: (email: string, password: string, lembrar?: boolean) => Promise<void>
  /** SSO da Microsoft. Mesma sessão do login por senha, outra porta de entrada. */
  loginComMicrosoft: (lembrar?: boolean) => Promise<void>
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

  const login = useCallback(async (email: string, password: string, lembrar = true) => {
    const result = await authApi.login(email, password)
    setToken(result.token, lembrar)
    setMe(await authApi.me())
  }, [])

  const loginComMicrosoft = useCallback(async (lembrar = true) => {
    // A Microsoft só diz quem a pessoa é; a sessão continua sendo a nossa, e o
    // "lembrar" governa o armazenamento dela igual ao login por senha.
    const idToken = await obterIdTokenMicrosoft()
    const result = await authApi.loginWithMicrosoft(idToken)
    setToken(result.token, lembrar)
    setMe(await authApi.me())
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setMe(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ me, loading, login, loginComMicrosoft, logout, refresh }),
    [me, loading, login, loginComMicrosoft, logout, refresh],
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
