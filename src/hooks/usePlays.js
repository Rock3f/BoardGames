import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { enrichParticipants } from './usePlayers'

const PLAY_SELECT = `
  id, created_by, catalog_game_id, championship_id, win_rule,
  started_at, ended_at, duration_min, comment, rounds, created_at,
  game:game_catalog(id, title, cover_url, min_players, max_players),
  play_teams(id, name, score, is_winner),
  play_participants(id, play_team_id, user_id, provisioned_player_id, guest_player_id, score, is_winner, championship_points)
`

export function useMyPlays({ gameId, fromDate } = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['plays', session?.user?.id, { gameId, fromDate }],
    queryFn: async () => {
      let q = supabase
        .from('plays')
        .select(PLAY_SELECT)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
      if (gameId) q = q.eq('catalog_game_id', gameId)
      if (fromDate) q = q.gte('started_at', fromDate)
      const { data, error } = await q
      if (error) throw error

      // Batch-enrich all participants across all plays in 2-3 queries
      const allParticipants = (data ?? []).flatMap(p => p.play_participants ?? [])
      if (allParticipants.length === 0) return data ?? []
      const enriched = await enrichParticipants(allParticipants)
      const enrichedMap = new Map(enriched.map(p => [p.id, p]))
      return (data ?? []).map(play => ({
        ...play,
        play_participants: (play.play_participants ?? []).map(p => enrichedMap.get(p.id) ?? p),
      }))
    },
    enabled: !!session,
  })
}

export function useActivePlay() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['active-play', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plays')
        .select(`id, created_by, catalog_game_id, started_at, win_rule, championship_id, game:game_catalog(id, title, cover_url)`)
        .eq('created_by', session.user.id)
        .is('ended_at', null)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!session,
    staleTime: 0,
  })
}

export function usePlayDetails(playId) {
  return useQuery({
    queryKey: ['play-details', playId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plays')
        .select(PLAY_SELECT)
        .eq('id', playId)
        .single()
      if (error) throw error

      const enriched = await enrichParticipants(data.play_participants ?? [])
      return { ...data, play_participants: enriched }
    },
    enabled: !!playId,
  })
}

export function useCreatePlay() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({ gameId, winRule, championshipId, participants, teams }) => {
      // 1. Insert play
      const { data: play, error: playErr } = await supabase
        .from('plays')
        .insert({
          created_by: session.user.id,
          catalog_game_id: gameId,
          win_rule: winRule,
          championship_id: championshipId || null,
          started_at: new Date().toISOString(),
          rounds: [],
        })
        .select()
        .single()
      if (playErr) throw playErr

      // 2. Insert teams → map localId to server id
      const teamIdMap = {}
      for (const team of teams) {
        const { data: pt, error: ptErr } = await supabase
          .from('play_teams')
          .insert({ play_id: play.id, name: team.name || null })
          .select()
          .single()
        if (ptErr) throw ptErr
        teamIdMap[team.localId] = pt.id
      }

      // 3. Create guest_players for guest participants
      const guestIdMap = {}
      for (const p of participants.filter(p => p.type === 'guest')) {
        const { data: gp, error: gpErr } = await supabase
          .from('guest_players')
          .insert({ created_by: session.user.id, name: p.name })
          .select()
          .single()
        if (gpErr) throw gpErr
        guestIdMap[p.localId] = gp.id
      }

      // 4. Insert participants (deduplicate non-guest by type+id)
      const seen = new Set()
      const ppInserts = participants.reduce((acc, p) => {
        const key = p.type !== 'guest' ? `${p.type}:${p.id}` : `guest:${p.localId}`
        if (seen.has(key)) return acc
        seen.add(key)
        const row = {
          play_id: play.id,
          play_team_id: p.teamLocalId ? teamIdMap[p.teamLocalId] : null,
        }
        if (p.type === 'user') row.user_id = p.id
        else if (p.type === 'provisioned') row.provisioned_player_id = p.id
        else row.guest_player_id = guestIdMap[p.localId]
        acc.push(row)
        return acc
      }, [])

      const { error: ppErr } = await supabase.from('play_participants').insert(ppInserts)
      if (ppErr) throw ppErr

      return play
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-play'] })
      qc.invalidateQueries({ queryKey: ['plays'] })
    },
  })
}

export function useSaveScores() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ playId, participantScores, teamScores, comment, rounds, startedAt }) => {
      const now = new Date().toISOString()

      // Update individual participant scores (sequential to avoid trigger deadlock)
      for (const { id, score } of participantScores) {
        const { error } = await supabase.from('play_participants').update({
          score: score !== '' && score !== null && score !== undefined ? Number(score) : null,
        }).eq('id', id)
        if (error) throw error
      }

      // Update team scores (sequential for same reason)
      for (const { id, score } of teamScores) {
        const { error } = await supabase.from('play_teams').update({
          score: score !== '' && score !== null && score !== undefined ? Number(score) : null,
        }).eq('id', id)
        if (error) throw error
      }

      // Close the play: set ended_at, comment, rounds
      // duration_min is a generated column computed from started_at/ended_at — do not set it
      const playUpdate = {
        ended_at: now,
        comment: comment || null,
      }
      if (rounds !== undefined) playUpdate.rounds = rounds
      const { error: playError } = await supabase
        .from('plays')
        .update(playUpdate)
        .eq('id', playId)
      if (playError) throw playError
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['play-details', variables.playId] })
      qc.invalidateQueries({ queryKey: ['plays'] })
      qc.invalidateQueries({ queryKey: ['active-play'] })
    },
  })
}

export function useDeletePlay() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (playId) => {
      const { error } = await supabase.from('plays').delete().eq('id', playId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plays'] }),
  })
}

// Client-side winner calculation for real-time UI feedback
export function calcWinners(entities, winRule) {
  const scored = entities.filter(e => e.score !== null && e.score !== '' && e.score !== undefined)
  if (scored.length === 0) return entities.map(e => ({ ...e, is_winner: false }))
  const scores = scored.map(e => Number(e.score))
  const winScore = winRule === 'highest_score' ? Math.max(...scores) : Math.min(...scores)
  return entities.map(e => ({
    ...e,
    is_winner: e.score !== null && e.score !== '' && e.score !== undefined && Number(e.score) === winScore,
  }))
}
