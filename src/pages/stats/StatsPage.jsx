import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/ui/Spinner'

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-3xl font-bold text-zinc-100 tabular-nums">{value ?? '—'}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

// ── Data hooks ─────────────────────────────────────────────────────────────────

function useMyStats() {
  const { session } = useAuth()
  const uid = session?.user?.id

  return useQuery({
    queryKey: ['my-stats', uid],
    queryFn: async () => {
      const [playsRes, collectionRes, winRes] = await Promise.all([
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
      const participations = winRes.data ?? []

      const totalPlays = plays.length
      const totalMinutes = plays.reduce((sum, p) => sum + (p.duration_min ?? 0), 0)
      const ownedGames = collection.filter(e => e.status === 'owned').length

      const participationsWithScore = participations.filter(p => p.score !== null)
      const wins = participations.filter(p => p.is_winner).length
      const winRate = participations.length ? Math.round((wins / participations.length) * 100) : null

      // Best month
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

      // Average duration
      const finishedWithDuration = plays.filter(p => p.duration_min)
      const avgDuration = finishedWithDuration.length
        ? Math.round(finishedWithDuration.reduce((s, p) => s + p.duration_min, 0) / finishedWithDuration.length)
        : null

      // Preferred hour
      const hourCounts = {}
      plays.forEach(p => {
        if (p.started_at) {
          const h = new Date(p.started_at).getHours()
          hourCounts[h] = (hourCounts[h] ?? 0) + 1
        }
      })
      const prefHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

      // Win streak
      const sortedParts = [...participations].sort((a, b) => {
        const pa = plays.find(p => p.id === a.play_id)
        const pb = plays.find(p => p.id === b.play_id)
        return new Date(pa?.started_at ?? 0) - new Date(pb?.started_at ?? 0)
      })
      let maxStreak = 0, curStreak = 0
      let ongoingStreak = 0
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
        totalPlays, totalMinutes, ownedGames, wins, winRate, bestMonth,
        avgDuration, prefHour, maxStreak, ongoingStreak,
        participationsCount: participations.length,
      }
    },
    enabled: !!uid,
  })
}

function useTopGames() {
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

function useMonthlyPlays() {
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

      // Build 12-month array
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

function useWinRateByGame() {
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
        if (!pp.play?.ended_at) return // skip in-progress plays
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(minutes) {
  if (!minutes) return '0h'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatHour(h) {
  if (h === undefined || h === null) return '—'
  const hStr = String(h).padStart(2, '0')
  return `${hStr}h–${String((h + 1) % 24).padStart(2, '0')}h`
}

const chartTheme = {
  stroke: '#f59e0b',
  grid: '#27272a',
  text: '#71717a',
  tooltip: { bg: '#18181b', border: '#3f3f46', text: '#f4f4f5' },
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="font-bold text-amber-400">{payload[0].value} partie{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

function WinRateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1 truncate max-w-40">{label}</p>
      <p className="font-bold text-amber-400">{payload[0].value}% victoires</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { data: stats, isLoading } = useMyStats()
  const { data: topGames } = useTopGames()
  const { data: monthly } = useMonthlyPlays()
  const { data: winRates } = useWinRateByGame()

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-100">Statistiques</h1>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>}

      {stats && (
        <>
          {/* Primary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Parties jouées" value={stats.totalPlays} />
            <StatCard label="Temps de jeu" value={formatTime(stats.totalMinutes)} sub={stats.avgDuration ? `~${formatTime(stats.avgDuration)} / partie` : undefined} />
            <StatCard label="Jeux possédés" value={stats.ownedGames} />
            <StatCard
              label="Taux de victoire"
              value={stats.winRate !== null ? `${stats.winRate}%` : '—'}
              sub={`${stats.wins} victoires`}
            />
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              label="Série en cours"
              value={stats.ongoingStreak > 0 ? `🔥 ${stats.ongoingStreak}` : stats.ongoingStreak === 0 ? '—' : '—'}
              sub="victoires consécutives"
            />
            <StatCard
              label="Meilleure série"
              value={stats.maxStreak || '—'}
              sub="victoires de suite"
            />
            <StatCard
              label="Heure préférée"
              value={stats.prefHour ? formatHour(Number(stats.prefHour[0])) : '—'}
              sub={stats.prefHour ? `${stats.prefHour[1]} parties` : undefined}
            />
          </div>

          {stats.bestMonth && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Mois le plus actif</p>
              <p className="text-zinc-100 font-semibold capitalize">{stats.bestMonth.label}</p>
              <p className="text-xs text-zinc-500">{stats.bestMonth.count} parties</p>
            </div>
          )}

          {/* Monthly chart */}
          {monthly && monthly.some(m => m.count > 0) && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-zinc-300">Parties sur 12 mois</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1 }} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={chartTheme.stroke}
                      strokeWidth={2}
                      dot={{ fill: chartTheme.stroke, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: chartTheme.stroke }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top games */}
          {topGames && topGames.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-zinc-300">Jeux les plus joués</h2>
              {topGames.map((entry, i) => (
                <div key={entry.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-bold text-zinc-500 w-5 text-center">{i + 1}</span>
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                    {entry.coverUrl
                      ? <img src={entry.coverUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">🎲</div>
                    }
                  </div>
                  <span className="flex-1 text-sm font-medium text-zinc-100 truncate">{entry.title}</span>
                  <span className="text-sm font-semibold text-zinc-300 tabular-nums shrink-0">
                    {entry.count} partie{entry.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Win rate by game (min 3 plays) */}
          {winRates && winRates.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-zinc-300">Taux de victoire par jeu</h2>
              <p className="text-xs text-zinc-600 -mt-1">Jeux avec au moins 3 parties</p>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={Math.max(120, winRates.length * 36)}>
                  <BarChart
                    data={winRates}
                    layout="vertical"
                    margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: chartTheme.text, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="title"
                      width={100}
                      tick={{ fill: chartTheme.text, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v}
                    />
                    <Tooltip content={<WinRateTooltip />} cursor={{ fill: '#27272a' }} />
                    <Bar dataKey="rate" fill={chartTheme.stroke} radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
