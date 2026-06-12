import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('collection_entries')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection'] }),
  })
}
