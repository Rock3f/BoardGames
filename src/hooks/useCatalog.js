import imageCompression from 'browser-image-compression'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

async function compressImage(file) {
  return imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    useWebWorker: false,
  })
}

function storagePath(gameId, ext) {
  return `catalog/${gameId}.${ext}`
}

export async function uploadGameCover(gameId, file, oldCoverUrl = null) {
  const compressed = await compressImage(file)
  const ext = file.name.split('.').pop().toLowerCase()
  const path = storagePath(gameId, ext)

  // Remove old cover if it has a different extension
  if (oldCoverUrl) {
    const oldPath = oldCoverUrl.split('/game-covers/')[1]
    if (oldPath && oldPath !== path) {
      await supabase.storage.from('game-covers').remove([oldPath])
    }
  }

  const { error } = await supabase.storage
    .from('game-covers')
    .upload(path, compressed, { upsert: true })
  if (error) throw error

  const { data: { publicUrl } } = supabase.storage.from('game-covers').getPublicUrl(path)
  return publicUrl
}

export function useCatalogSearch(query) {
  return useQuery({
    queryKey: ['catalog-search', query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_catalog')
        .select('*')
        .ilike('title', `%${query}%`)
        .order('title')
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!query && query.length >= 2,
  })
}

export function useCreateGame() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({
      title, publisher, coverFile, minPlayers, maxPlayers,
      minDuration, maxDuration, yearPublished, description,
      parentGameId, status,
    }) => {
      // 1. Insert game without cover
      const { data: game, error: gameErr } = await supabase
        .from('game_catalog')
        .insert({
          title,
          publisher: publisher?.trim() || null,
          cover_url: null,
          min_players: minPlayers ? Number(minPlayers) : 1,
          max_players: maxPlayers ? Number(maxPlayers) : 1,
          min_duration_min: minDuration ? Number(minDuration) : null,
          max_duration_min: maxDuration ? Number(maxDuration) : null,
          year_published: yearPublished ? Number(yearPublished) : null,
          description: description || null,
          parent_game_id: parentGameId || null,
          created_by: session.user.id,
        })
        .select()
        .single()
      if (gameErr) throw gameErr

      // 2. Upload cover with game ID in path
      let coverUrl = null
      if (coverFile) {
        coverUrl = await uploadGameCover(game.id, coverFile)
        await supabase.from('game_catalog').update({ cover_url: coverUrl }).eq('id', game.id)
      }

      // 3. Add to collection
      const { error: entryErr } = await supabase
        .from('collection_entries')
        .insert({ user_id: session.user.id, catalog_game_id: game.id, status: status ?? 'owned' })
      if (entryErr) throw entryErr

      return { ...game, cover_url: coverUrl }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-all'] })
      qc.invalidateQueries({ queryKey: ['catalog-search'] })
      qc.invalidateQueries({ queryKey: ['collection'] })
    },
  })
}

export function useAllGames() {
  return useQuery({
    queryKey: ['catalog-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_catalog')
        .select('*')
        .order('title')
      if (error) throw error
      return data
    },
  })
}

export function useUpdateGame() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id, title, publisher, minPlayers, maxPlayers,
      minDuration, maxDuration, yearPublished, description,
      coverFile, currentCoverUrl,
    }) => {
      let newCoverUrl
      if (coverFile) {
        newCoverUrl = await uploadGameCover(id, coverFile, currentCoverUrl ?? null)
      }

      const updates = {
        title: title.trim(),
        publisher: publisher?.trim() || null,
        min_players: Number(minPlayers),
        max_players: Number(maxPlayers),
        min_duration_min: minDuration ? Number(minDuration) : null,
        max_duration_min: maxDuration ? Number(maxDuration) : null,
        year_published: yearPublished ? Number(yearPublished) : null,
        description: description?.trim() || null,
      }
      if (newCoverUrl !== undefined) updates.cover_url = newCoverUrl

      const { error } = await supabase.from('game_catalog').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-all'] })
      qc.invalidateQueries({ queryKey: ['catalog-search'] })
      qc.invalidateQueries({ queryKey: ['collection'] })
    },
  })
}

export function useGameExtensions(gameId) {
  return useQuery({
    queryKey: ['game-extensions', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_catalog')
        .select('*')
        .eq('parent_game_id', gameId)
        .order('title')
      if (error) throw error
      return data
    },
    enabled: !!gameId,
  })
}

export function useAddExtension() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({
      parentGameId, title, publisher, minPlayers, maxPlayers,
      minDuration, maxDuration, yearPublished, description, coverFile,
    }) => {
      const { data: game, error: gameErr } = await supabase
        .from('game_catalog')
        .insert({
          title: title.trim(),
          publisher: publisher?.trim() || null,
          cover_url: null,
          min_players: minPlayers ? Number(minPlayers) : 1,
          max_players: maxPlayers ? Number(maxPlayers) : 1,
          min_duration_min: minDuration ? Number(minDuration) : null,
          max_duration_min: maxDuration ? Number(maxDuration) : null,
          year_published: yearPublished ? Number(yearPublished) : null,
          description: description?.trim() || null,
          parent_game_id: parentGameId,
          created_by: session.user.id,
        })
        .select()
        .single()
      if (gameErr) throw gameErr

      if (coverFile) {
        const coverUrl = await uploadGameCover(game.id, coverFile)
        await supabase.from('game_catalog').update({ cover_url: coverUrl }).eq('id', game.id)
      }

      return game
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['game-extensions', variables.parentGameId] })
      qc.invalidateQueries({ queryKey: ['catalog-all'] })
      qc.invalidateQueries({ queryKey: ['catalog-search'] })
    },
  })
}

export function useUpdateGameCover() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ game, coverFile }) => {
      const coverUrl = await uploadGameCover(game.id, coverFile, game.cover_url)
      const { error } = await supabase
        .from('game_catalog')
        .update({ cover_url: coverUrl })
        .eq('id', game.id)
      if (error) throw error
      return coverUrl
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-all'] })
      qc.invalidateQueries({ queryKey: ['catalog-search'] })
      qc.invalidateQueries({ queryKey: ['collection'] })
    },
  })
}
