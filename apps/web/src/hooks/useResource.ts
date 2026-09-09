import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '@/services/httpClient'

interface ResourceState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Recarrega os dados (usado após mutações). */
  reload: () => Promise<void>
}

/**
 * Hook genérico de leitura: cuida de loading, erro e recarga, evitando repetir
 * esse controle em cada tela.
 */
export function useResource<T>(fetcher: () => Promise<T>, enabled = true): ResourceState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)
    try {
      setData(await fetcher())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar os dados')
    } finally {
      setLoading(false)
    }
  }, [fetcher, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
