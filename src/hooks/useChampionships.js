import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const CHAMP_SELECT = `
  id, created_by, name, description, status, scoring, tiebreak_order,
  starts_at, ends_at, created_at,
  championship_players(id, user_id, provisioned_player_id, joined_at),
  championship_games(id, catalog_game_id, status, suggested_by, display_order, game:game_catalog(id, title, cover_url, min_players, max_players, min_duration_min, max_duration_min))
`

// Enrich championship_players rows with displayName + avatarUrl
export async function enrichChampionshipPlayers(players) {
  const userIds = players.filter(p => p.user_id).map(p => p.user_id)
  const provIds = players.filter(p => p.provisioned_player_id).map(p => p.provisioned_player_id)

  const [profiles, provisioned] = await Promise.all([
    userIds.length
      ? supabase.from('user_profiles').select('id, username, avatar_url').in('id', userIds)
      : { data: [] },
    provIds.length
      ? supabase.from('provisioned_players').select('id, username, avatar_url').in('id', provIds)
      : { data: [] },
  ])

  const profileMap = Object.fromEntries((profiles.data ?? []).map(p => [p.id, p]))
  const provMap = Object.fromEntries((provisioned.data ?? []).map(p => [p.id, p]))

  return players.map(p => ({
    ...p,
    displayName: p.user_id
      ? (profileMap[p.user_id]?.username ?? '?')
      : (provMap[p.provisioned_player_id]?.username ?? '?'),
    avatarUrl: p.user_id
      ? (profileMap[p.user_id]?.avatar_url ?? null)
      : (provMap[p.provisioned_player_id]?.avatar_url ?? null),
  }))
}

export function useMyChampionships() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['championships', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('championships')
        .select(CHAMP_SELECT)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!session,
  })
}

export function useChampionship(id) {
  return useQuery({
    queryKey: ['championship', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('championships')
        .select(CHAMP_SELECT)
        .eq('id', id)
        .single()
      if (error) throw error
      const enrichedPlayers = await enrichChampionshipPlayers(data.championship_players ?? [])
      return { ...data, championship_players: enrichedPlayers }
    },
    enabled: !!id,
  })
}

// Active championships where the current user is a participant
export function useMyActiveChampionships() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['my-active-championships', session?.user?.id],
    queryFn: async () => {
      const { data: playerRows, error: e1 } = await supabase
        .from('championship_players')
        .select('championship_id')
        .eq('user_id', session.user.id)
      if (e1) throw e1

      const ids = (playerRows ?? []).map(p => p.championship_id)
      if (ids.length === 0) return []

      const { data, error } = await supabase
        .from('championships')
        .select('id, name')
        .in('id', ids)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!session,
    staleTime: 30_000,
  })
}

// Games owned by participants — enriched with ownerIds + metadata
export function useChampionshipAvailableGames(championship) {
  const userIds = (championship?.championship_players ?? [])
    .filter(p => p.user_id)
    .map(p => p.user_id)

  return useQuery({
    queryKey: ['championship-available-games', championship?.id],
    queryFn: async () => {
      // Essaie avec les métadonnées étendues ; repli sur les champs de base si les colonnes n'existent pas
      const FULL_SELECT = 'user_id, catalog_game_id, game:game_catalog(id, title, cover_url, year_published, min_players, max_players, min_duration_min, max_duration_min)'
      const BASE_SELECT = 'user_id, catalog_game_id, game:game_catalog(id, title, cover_url, year_published)'

      let result = await supabase
        .from('collection_entries')
        .select(FULL_SELECT)
        .in('user_id', userIds)
        .neq('status', 'wishlist')

      if (result.error?.code === '42703' || result.error?.message?.includes('does not exist')) {
        result = await supabase
          .from('collection_entries')
          .select(BASE_SELECT)
          .in('user_id', userIds)
          .neq('status', 'wishlist')
      }

      if (result.error) throw result.error

      // Build game map with ownerIds (multiple participants may own the same game)
      const gameMap = new Map()
      for (const e of result.data ?? []) {
        if (!e.game) continue
        if (!gameMap.has(e.catalog_game_id)) {
          gameMap.set(e.catalog_game_id, { ...e.game, ownerIds: [] })
        }
        gameMap.get(e.catalog_game_id).ownerIds.push(e.user_id)
      }

      return [...gameMap.values()].sort((a, b) =>
        a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
      )
    },
    enabled: !!championship?.id && userIds.length > 0,
  })
}

export function useChampionshipStandings(id) {
  return useQuery({
    queryKey: ['championship-standings', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('championship_standings')
        .select('*')
        .eq('championship_id', id)
        .order('rank')
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateChampionship() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({ name, description, startsAt, endsAt, scoring, tiebreakOrder, participants = [] }) => {
      const { data, error } = await supabase
        .from('championships')
        .insert({
          created_by: session.user.id,
          name,
          description: description || null,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
          scoring: scoring ?? {
            mode: 'by_result',
            win_condition: 'highest',
            by_result: { win: 3, draw: 1, loss: 0 },
            by_rank: [],
            bonus_rules: [],
          },
          tiebreak_order: tiebreakOrder ?? ['wins', 'score_sum', 'head_to_head'],
        })
        .select()
        .single()
      if (error) throw error

      // Creator + additional participants (deduplicate creator if already in list)
      const extraPlayers = participants.filter(p => !(p.type === 'user' && p.id === session.user.id))
      const userIds = [session.user.id, ...extraPlayers.filter(p => p.type === 'user').map(p => p.id)]
      const provisionedIds = extraPlayers.filter(p => p.type === 'provisioned').map(p => p.id)

      // RPC SECURITY DEFINER → ON CONFLICT DO NOTHING, contourne cp_unique_user
      const { error: ppErr } = await supabase.rpc('add_championship_players', {
        p_championship_id: data.id,
        p_user_ids: userIds,
        p_provisioned_ids: provisionedIds,
      })
      if (ppErr) throw ppErr

      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['championships'] })
      qc.invalidateQueries({ queryKey: ['my-active-championships'] })
    },
  })
}

export function useUpdateChampionship() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { error } = await supabase.from('championships').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['championship', id] })
      qc.invalidateQueries({ queryKey: ['championships'] })
      qc.invalidateQueries({ queryKey: ['my-active-championships'] })
    },
  })
}

export function useAddChampionshipPlayer() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ championshipId, userId, provisionedPlayerId }) => {
      const row = { championship_id: championshipId }
      if (userId) row.user_id = userId
      else row.provisioned_player_id = provisionedPlayerId
      const { error } = await supabase.from('championship_players').insert(row)
      if (error) throw error
    },
    onSuccess: (_d, { championshipId }) => {
      qc.invalidateQueries({ queryKey: ['championship', championshipId] })
      qc.invalidateQueries({ queryKey: ['championship-available-games', championshipId] })
    },
  })
}

export function useRemoveChampionshipPlayer() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, championshipId }) => {
      const { error } = await supabase.from('championship_players').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { championshipId }) => {
      qc.invalidateQueries({ queryKey: ['championship', championshipId] })
      qc.invalidateQueries({ queryKey: ['championship-available-games', championshipId] })
    },
  })
}

export function useSuggestGame() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({ championshipId, catalogGameId }) => {
      const { error } = await supabase.from('championship_games').insert({
        championship_id: championshipId,
        catalog_game_id: catalogGameId,
        suggested_by: session.user.id,
        status: 'suggested',
      })
      if (error) throw error
    },
    onSuccess: (_d, { championshipId }) => {
      qc.invalidateQueries({ queryKey: ['championship', championshipId] })
    },
  })
}

export function useManageGame() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, championshipId, status }) => {
      const { error } = await supabase.from('championship_games').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { championshipId }) => {
      qc.invalidateQueries({ queryKey: ['championship', championshipId] })
    },
  })
}

export function useApproveAllPendingGames() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (championshipId) => {
      const { error } = await supabase
        .from('championship_games')
        .update({ status: 'approved' })
        .eq('championship_id', championshipId)
        .eq('status', 'suggested')
      if (error) throw error
    },
    onSuccess: (_d, championshipId) => {
      qc.invalidateQueries({ queryKey: ['championship', championshipId] })
    },
  })
}

export function useTransitionChampionship() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('championships').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['championship', id] })
      qc.invalidateQueries({ queryKey: ['championships'] })
      qc.invalidateQueries({ queryKey: ['my-active-championships'] })
    },
  })
}
