import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Search registered + provisioned players
export function usePlayerSearch(query) {
  return useQuery({
    queryKey: ['player-search', query],
    queryFn: async () => {
      const [{ data: users }, { data: provisioned }] = await Promise.all([
        supabase.from('user_profiles').select('id, username, avatar_url')
          .ilike('username', `%${query}%`).limit(10),
        supabase.from('provisioned_players').select('id, username, avatar_url, created_by')
          .ilike('username', `%${query}%`).limit(10),
      ])
      return {
        users: users ?? [],
        provisioned: provisioned ?? [],
      }
    },
    enabled: !!query && query.length >= 2,
  })
}

// All users visible (for championship participant selector)
export function useAllUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const [{ data: users }, { data: provisioned }] = await Promise.all([
        supabase.from('user_profiles').select('id, username, avatar_url').order('username'),
        supabase.from('provisioned_players').select('id, username, avatar_url, created_by').order('username'),
      ])
      return { users: users ?? [], provisioned: provisioned ?? [] }
    },
  })
}

// Provisioned players (for management page)
export function useMyProvisionedPlayers() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['provisioned-players', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provisioned_players')
        .select('*')
        .order('username')
      if (error) throw error
      return data
    },
    enabled: !!session,
  })
}

export function useCreateProvisionedPlayer() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({ username }) => {
      const { data, error } = await supabase
        .from('provisioned_players')
        .insert({ created_by: session.user.id, username })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provisioned-players'] })
      qc.invalidateQueries({ queryKey: ['all-provisioned'] })
      qc.invalidateQueries({ queryKey: ['player-search'] })
    },
  })
}

export function useLinkProvisionedPlayer() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, linkedUserId }) => {
      const { error } = await supabase
        .from('provisioned_players')
        .update({ linked_user_id: linkedUserId })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provisioned-players'] })
      qc.invalidateQueries({ queryKey: ['all-provisioned'] })
    },
  })
}

export function useUnlinkProvisionedPlayer() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('provisioned_players')
        .update({ linked_user_id: null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provisioned-players'] })
      qc.invalidateQueries({ queryKey: ['all-provisioned'] })
    },
  })
}

export function useDeleteProvisionedPlayer() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('provisioned_players')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provisioned-players'] })
      qc.invalidateQueries({ queryKey: ['all-provisioned'] })
      qc.invalidateQueries({ queryKey: ['player-search'] })
    },
  })
}

export function useAllProvisionedPlayers() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['all-provisioned'],
    queryFn: async () => {
      const { data: players, error } = await supabase
        .from('provisioned_players')
        .select('*')
        .order('username')
      if (error) throw error

      const linkedIds = players.filter(p => p.linked_user_id).map(p => p.linked_user_id)
      if (linkedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', linkedIds)
        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
        return players.map(p => ({
          ...p,
          linked_profile: p.linked_user_id ? (profileMap.get(p.linked_user_id) ?? null) : null,
        }))
      }
      return players.map(p => ({ ...p, linked_profile: null }))
    },
    enabled: !!session,
  })
}

// ── Directory hooks ───────────────────────────────────────────────────────────

export function useAllPlayers(query = '') {
  return useQuery({
    queryKey: ['players', query],
    queryFn: async () => {
      let q = supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .order('username')
      if (query.trim().length >= 1) {
        q = q.ilike('username', `%${query.trim()}%`)
      }
      const [{ data: profiles, error: pe }, { data: entries, error: ee }] = await Promise.all([
        q,
        supabase.from('collection_entries').select('user_id'),
      ])
      if (pe) throw pe
      if (ee) throw ee

      const countMap = new Map()
      for (const e of (entries ?? [])) {
        countMap.set(e.user_id, (countMap.get(e.user_id) ?? 0) + 1)
      }
      return (profiles ?? []).map((p) => ({
        ...p,
        collectionCount: countMap.get(p.id) ?? 0,
      }))
    },
  })
}

export function usePlayerProfile(userId) {
  return useQuery({
    queryKey: ['player-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

export function usePlayerCollection(userId) {
  return useQuery({
    queryKey: ['player-collection', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_entries')
        .select('*, game:game_catalog(*)')
        .eq('user_id', userId)
      if (error) throw error
      return (data ?? []).sort((a, b) =>
        (a.game?.title ?? '').localeCompare(b.game?.title ?? '', 'fr', { sensitivity: 'base' })
      )
    },
    enabled: !!userId,
  })
}

export function useGameOwners(gameId) {
  return useQuery({
    queryKey: ['game-owners', gameId],
    queryFn: async () => {
      const { data: entries, error: e1 } = await supabase
        .from('collection_entries')
        .select('user_id, status')
        .eq('catalog_game_id', gameId)
        .in('status', ['owned', 'lent', 'borrowed'])
      if (e1) throw e1
      if (!entries?.length) return []

      const { data: profiles, error: e2 } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', entries.map((e) => e.user_id))
      if (e2) throw e2

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      return entries
        .map((e) => ({ ...e, profile: profileMap.get(e.user_id) }))
        .filter((e) => e.profile)
    },
    enabled: !!gameId,
  })
}

// Enrich a list of play_participants with display names
export async function enrichParticipants(participants) {
  const userIds = participants.filter(p => p.user_id).map(p => p.user_id)
  const provIds = participants.filter(p => p.provisioned_player_id).map(p => p.provisioned_player_id)
  const guestIds = participants.filter(p => p.guest_player_id).map(p => p.guest_player_id)

  const [profiles, provisioned, guests] = await Promise.all([
    userIds.length
      ? supabase.from('user_profiles').select('id, username, avatar_url').in('id', userIds)
      : { data: [] },
    provIds.length
      ? supabase.from('provisioned_players').select('id, username, avatar_url').in('id', provIds)
      : { data: [] },
    guestIds.length
      ? supabase.from('guest_players').select('id, name').in('id', guestIds)
      : { data: [] },
  ])

  const profileMap = Object.fromEntries((profiles.data ?? []).map(p => [p.id, p]))
  const provMap = Object.fromEntries((provisioned.data ?? []).map(p => [p.id, p]))
  const guestMap = Object.fromEntries((guests.data ?? []).map(p => [p.id, p]))

  return participants.map(p => ({
    ...p,
    displayName: p.user_id
      ? (profileMap[p.user_id]?.username ?? '?')
      : p.provisioned_player_id
        ? (provMap[p.provisioned_player_id]?.username ?? '?')
        : (guestMap[p.guest_player_id]?.name ?? 'Invité'),
    avatarUrl: p.user_id
      ? profileMap[p.user_id]?.avatar_url
      : p.provisioned_player_id
        ? provMap[p.provisioned_player_id]?.avatar_url
        : null,
    type: p.user_id ? 'user' : p.provisioned_player_id ? 'provisioned' : 'guest',
  }))
}
