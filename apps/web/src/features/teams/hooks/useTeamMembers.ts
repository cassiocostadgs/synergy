import { useCallback } from 'react'

import { teamsApi } from '@/features/teams/api/teamsApi'
import { useResource } from '@/hooks/useResource'
import { isTeamManager, type Team, type TeamMember, type TeamRole } from '@/types'

/** Carrega o time e o seu painel de membros. */
export function useTeamMembers(teamId: string, currentUserId: string | undefined, isAdmin: boolean) {
  const teamFetcher = useCallback(() => teamsApi.get(teamId), [teamId])
  const membersFetcher = useCallback(() => teamsApi.members(teamId), [teamId])

  const team = useResource<Team>(teamFetcher)
  const members = useResource<TeamMember[]>(membersFetcher)

  const list = members.data ?? []
  const myRole: TeamRole | undefined = list.find((m) => m.userId === currentUserId)?.role

  const reload = useCallback(async () => {
    await Promise.all([team.reload(), members.reload()])
  }, [team, members])

  return {
    team: team.data,
    members: list,
    myRole,
    /** RN2: só Gestores do próprio time (ou Admin global) administram membros. */
    canManage: isAdmin || isTeamManager(myRole),
    /** Só o Gestor Principal atual (ou Admin) transfere a liderança. */
    canTransfer: isAdmin || myRole === 'GESTOR_PRINCIPAL',
    loading: team.loading || members.loading,
    error: team.error ?? members.error,
    reload,
  }
}
