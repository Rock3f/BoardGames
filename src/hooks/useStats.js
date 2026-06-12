import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function useMyStats() {
  const { session } = useAuth()
  const uid = session?.user?.id

  return useQuery({
    queryKey: ['my-stats', uid],
    queryFn: async () => {
      const [playsRes, collectionRes, participationsRes] = await Promise.all([
        supabase
          .from('plays')
          .select('id, catalog_game_id, duration_min, started_at, championship_id')
          .not('ended_at', 'is', null)
          .eq('created_by', uid),
        supabase
          .from('collection_entries')
          .select('id, status')
          .eq('user_id', uid),
        supabase
          .from('play_participants')
          .select('id, is_winner, play_id, score')
          .eq('user_id', uid),
      ])

      if (playsRes.error) throw playsRes.error

      const plays = playsRes.data ?? []
      const collection = collectionRes.data ?? []
      const participations = participationsRes.data ?? []

      // ── Primary ───────────────────────────────────────────────────────────────
      const totalPlays = plays.length
      const totalMinutes = plays.reduce((sum, p) => sum + (p.duration_min ?? 0), 0)

      const wins = participations.filter(p => p.is_winner).length
      const winRate = participations.length ? Math.round((wins / participations.length) * 100) : null

      // ── Collection breakdown ──────────────────────────────────────────────────
      const collectionBreakdown = {
        owned:    collection.filter(e => e.status === 'owned').length,
        wishlist: collection.filter(e => e.status === 'wishlist').length,
        lent:     collection.filter(e => e.status === 'lent').length,
        borrowed: collection.filter(e => e.status === 'borrowed').length,
        for_sale: collection.filter(e => e.status === 'for_sale').length,
      }
      const ownedGames = collectionBreakdown.owned

      // ── Play diversity ────────────────────────────────────────────────────────
      const uniqueGamesPlayed = new Set(plays.map(p => p.catalog_game_id).filter(Boolean)).size
      const longestSession = plays.reduce((max, p) => Math.max(max, p.duration_min ?? 0), 0) || null
      const champPlaysCount = plays.filter(p => p.championship_id).length

      // ── Duration ──────────────────────────────────────────────────────────────
      const finishedWithDuration = plays.filter(p => p.duration_min)
      const avgDuration = finishedWithDuration.length
        ? Math.round(finishedWithDuration.reduce((s, p) => s + p.duration_min, 0) / finishedWithDuration.length)
        : null

      // ── Best month ───────────────────────────────────────────────────────────
      const monthCounts = {}
      plays.forEach(p => {
        if (p.started_at) {
          const d = new Date(p.started_at)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
          monthCounts[key] = { label, count: (monthCounts[key]?.count ?? 0) + 1 }
        }
      })
      const bestMonth = Object.values(monthCounts).sort((a, b) => b.count - a.count)[0]

      // ── Day of week ───────────────────────────────────────────────────────────
      const dayCounts = {}
      plays.forEach(p => {
        if (p.started_at) {
          const d = new Date(p.started_at).getDay()
          dayCounts[d] = (dayCounts[d] ?? 0) + 1
        }
      })
      const dayOfWeekData = DAYS_FR.map((label, i) => ({ label, count: dayCounts[i] ?? 0 }))
      const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]

      // ── Preferred hour ────────────────────────────────────────────────────────
      const hourCounts = {}
      plays.forEach(p => {
        if (p.started_at) {
          const h = new Date(p.started_at).getHours()
          hourCounts[h] = (hourCounts[h] ?? 0) + 1
        }
      })
      const prefHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

      // ── Recent win rate (30 days) ─────────────────────────────────────────────
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const recentPlayIds = new Set(
        plays.filter(p => p.started_at && new Date(p.started_at) >= thirtyDaysAgo).map(p => p.id)
      )
      const recentParts = participations.filter(p => recentPlayIds.has(p.play_id))
      const recentWins = recentParts.filter(p => p.is_winner).length
      const recentWinRate = recentParts.length >= 3
        ? Math.round((recentWins / recentParts.length) * 100)
        : null

      // ── Score stats ───────────────────────────────────────────────────────────
      const scores = participations.map(p => p.score).filter(s => s !== null && s !== undefined)
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + Number(b), 0) / scores.length) : null
      const bestScore = scores.length ? Math.max(...scores.map(Number)) : null

      // ── Win streak ────────────────────────────────────────────────────────────
      const sortedParts = [...participations].sort((a, b) => {
        const pa = plays.find(p => p.id === a.play_id)
        const pb = plays.find(p => p.id === b.play_id)
        return new Date(pa?.started_at ?? 0) - new Date(pb?.started_at ?? 0)
      })
      let maxStreak = 0, curStreak = 0, ongoingStreak = 0
      for (let i = sortedParts.length - 1; i >= 0; i--) {
        if (sortedParts[i].is_winner && ongoingStreak !== -1) ongoingStreak++
        else ongoingStreak = -1
      }
      ongoingStreak = ongoingStreak === -1 ? 0 : ongoingStreak
      sortedParts.forEach(p => {
        if (p.is_winner) { curStreak++; maxStreak = Math.max(maxStreak, curStreak) }
        else curStreak = 0
      })

      return {
        // Primary
        totalPlays, totalMinutes, ownedGames, wins, winRate,
        // Collection
        collectionBreakdown,
        // Diversity
        uniqueGamesPlayed, longestSession, champPlaysCount,
        // Performance
        avgDuration, bestMonth, prefHour, maxStreak, ongoingStreak,
        recentWinRate, recentPlaysCount: recentParts.length,
        // Scores
        avgScore, bestScore,
        // Activity
        dayOfWeekData, mostActiveDay,
        participationsCount: participations.length,
      }
    },
    enabled: !!uid,
  })
}

export function useTopGames() {
  const { session } = useAuth()
  const uid = session?.user?.id

  return useQuery({
    queryKey: ['top-games', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plays')
        .select('catalog_game_id, game:game_catalog(id, title, cover_url)')
        .eq('created_by', uid)
        .not('ended_at', 'is', null)
      if (error) throw error

      const counts = {}
      const gameInfo = {}
      data?.forEach(p => {
        if (!p.catalog_game_id) return
        counts[p.catalog_game_id] = (counts[p.catalog_game_id] ?? 0) + 1
        if (p.game) gameInfo[p.catalog_game_id] = p.game
      })

      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id, count, title: gameInfo[id]?.title ?? '?', coverUrl: gameInfo[id]?.cover_url }))
    },
    enabled: !!uid,
  })
}

export function useMonthlyPlays() {
  const { session } = useAuth()
  const uid = session?.user?.id

  return useQuery({
    queryKey: ['monthly-plays', uid],
    queryFn: async () => {
      const since = new Date()
      since.setMonth(since.getMonth() - 11)
      since.setDate(1)
      since.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('plays')
        .select('started_at')
        .eq('created_by', uid)
        .not('ended_at', 'is', null)
        .gte('started_at', since.toISOString())
      if (error) throw error

      const months = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = d.toLocaleDateString('fr-FR', { month: 'short' })
        months.push({ key, label, count: 0 })
      }

      data?.forEach(p => {
        const d = new Date(p.started_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const m = months.find(m => m.key === key)
        if (m) m.count++
      })

      return months
    },
    enabled: !!uid,
  })
}

export function useWinRateByGame() {
  const { session } = useAuth()
  const uid = session?.user?.id

  return useQuery({
    queryKey: ['win-rate-by-game', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('play_participants')
        .select('is_winner, play:plays!inner(catalog_game_id, ended_at, game:game_catalog(title))')
        .eq('user_id', uid)
      if (error) throw error

      const byGame = {}
      data?.forEach(pp => {
        if (!pp.play?.ended_at) return
        const gid = pp.play?.catalog_game_id
        const title = pp.play?.game?.title ?? '?'
        if (!gid) return
        if (!byGame[gid]) byGame[gid] = { title, wins: 0, total: 0 }
        byGame[gid].total++
        if (pp.is_winner) byGame[gid].wins++
      })

      return Object.values(byGame)
        .filter(g => g.total >= 3)
        .map(g => ({ ...g, rate: Math.round((g.wins / g.total) * 100) }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5)
    },
    enabled: !!uid,
  })
}

export function useTopOpponents() {
  const { session } = useAuth()
  const uid = session?.user?.id

  return useQuery({
    queryKey: ['top-opponents', uid],
    queryFn: async () => {
      // Fetch all participants in plays created by the current user
      const { data, error } = await supabase
        .from('play_participants')
        .select('user_id, is_winner, provisioned_player_id, play:plays!inner(id, created_by, ended_at)')
        .eq('play.created_by', uid)
        .not('play.ended_at', 'is', null)
      if (error) throw error

      // Also fetch all participants in plays where the user participated
      const { data: data2, error: error2 } = await supabase
        .from('play_participants')
        .select('user_id, is_winner, provisioned_player_id, play_id')
        .eq('user_id', uid)
      if (error2) throw error2

      const playIds = new Set((data2 ?? []).map(p => p.play_id))

      // Count co-players (excluding self)
      const opponents = {}
      ;(data ?? []).forEach(pp => {
        if (!playIds.has(pp.play?.id)) return
        const key = pp.user_id ? `u:${pp.user_id}` : `p:${pp.provisioned_player_id}`
        if (pp.user_id === uid || (!pp.user_id && !pp.provisioned_player_id)) return
        if (!opponents[key]) opponents[key] = { user_id: pp.user_id, provisioned_player_id: pp.provisioned_player_id, plays: 0, wins: 0 }
        opponents[key].plays++
        if (pp.is_winner) opponents[key].wins++
      })

      const top = Object.values(opponents)
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 5)

      if (!top.length) return []

      // Resolve display names
      const userIds = top.filter(o => o.user_id).map(o => o.user_id)
      const provIds = top.filter(o => o.provisioned_player_id).map(o => o.provisioned_player_id)

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

      return top.map(o => {
        const info = o.user_id ? profileMap[o.user_id] : provMap[o.provisioned_player_id]
        return {
          ...o,
          displayName: info?.username ?? '?',
          avatarUrl: info?.avatar_url ?? null,
        }
      })
    },
    enabled: !!uid,
  })
}
