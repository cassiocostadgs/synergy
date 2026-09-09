import { useCallback } from 'react'

import { teamsApi } from '@/features/teams/api/teamsApi'
import { useResource } from '@/hooks/useResource'
import type { Team } from '@/types'

/** Lista os times visíveis para o usuário autenticado. */
export function useTeams() {
  const fetcher = useCallback(() => teamsApi.list(), [])
  const { data, loading, error, reload } = useResource<Team[]>(fetcher)

  return {
    teams: data ?? [],
    loading,
    error,
    reload,
  }
}
