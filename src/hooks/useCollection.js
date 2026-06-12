import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useMyPlayCounts() {
  const { session } = useAuth()
  const uid = session?.user?.id

  return useQuery({
    queryKey: ['play-counts', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('play_counts_per_game')
        .select('catalog_game_id, play_count')
        .eq('user_id', uid)
      if (error) throw error
      return Object.fromEntries((data ?? []).map(r => [r.catalog_game_id, r.play_count]))
    },
    enabled: !!uid,
  })
}

export function useMyCollection(status = null) {
  const { session } = useAuth()
  const userId = session?.user?.id

  return useQuery({
    queryKey: ['collection', userId, status],
    queryFn: async () => {
      let q = supabase
        .from('collection_entries')
        .select('*, game:game_catalog(*)')
        .eq('user_id', userId)
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).sort((a, b) =>
        (a.game?.title ?? '').localeCompare(b.game?.title ?? '', 'fr', { sensitivity: 'base' })
      )
    },
    enabled: !!userId,
  })
}

export function useAddToCollection() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({ gameId, status }) => {
      const { error } = await supabase
        .from('collection_entries')
        .insert({ user_id: session.user.id, catalog_game_id: gameId, status })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection'] }),
  })
}

export function useUpdateCollectionEntry() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, personal_rating, notes }) => {
      const { error } = await supabase
        .from('collection_entries')
        .update({ status, personal_rating: personal_rating ?? null, notes: notes || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection'] }),
  })
}

export function useRemoveFromCollection() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({ id, catalogGameId }) => {
      const uid = session?.user?.id

      // RB-C04: block removal if plays exist for this user+game
      const { data: playCountRow } = await supabase
        .from('play_counts_per_game')
        .select('play_count')
        .eq('catalog_game_id', catalogGameId)
        .eq('user_id', uid)
        .maybeSingle()
      if ((playCountRow?.play_count ?? 0) > 0) {
        throw new Error(
          `Ce jeu a ${playCountRow.play_count} partie(s) enregistrée(s). Supprimez-les d'abord ou changez le statut.`
        )
      }

      const { error } = await supabase
        .from('collection_entries')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['play-counts'] })
    },
  })
}
