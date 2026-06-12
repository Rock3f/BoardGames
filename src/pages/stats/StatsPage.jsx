import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/ui/Spinner'

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-3xl font-bold text-zinc-100 tabular-nums">{value ?? '—'}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

function useMyStats() {
  const { session } = useAuth()
  const uid = session?.user?.id

  return useQuery({
    queryKey: ['my-stats', uid],
    queryFn: async () => {
      const [playsRes, collectionRes, winRes] = await Promise.all([
        supabase
          .from('plays')
          .select('id, duration_min, started_at')
          .not('ended_at', 'is', null)
          .eq('created_by', uid),
        supabase
          .from('collection_entries')
          .select('id, status')
          .eq('user_id', uid),
        supabase
          .from('play_participants')
          .select('id, is_winner')
          .eq('user_id', uid),
      ])

      if (playsRes.error) throw playsRes.error

      const plays = playsRes.data ?? []
      const collection = collectionRes.data ?? []
      const participations = winRes.data ?? []

      const totalPlays = plays.length
      const totalMinutes = plays.reduce((sum, p) => sum + (p.duration_min ?? 0), 0)
      const ownedGames = collection.filter(e => e.status === 'owned').length
      const wins = participations.filter(p => p.is_winner).length
      const winRate = participations.length ? Math.round((wins / participations.length) * 100) : null

      // Most played month
      const monthCounts = {}
      plays.forEach(p => {
        if (p.started_at) {
          const m = new Date(p.started_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
          monthCounts[m] = (monthCounts[m] ?? 0) + 1
        }
      })
      const bestMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]

      return { totalPlays, totalMinutes, ownedGames, wins, winRate, bestMonth }
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
        .map(([id, count]) => ({ id, count, game: gameInfo[id] }))
    },
    enabled: !!uid,
  })
}

export default function StatsPage() {
  const { data: stats, isLoading } = useMyStats()
  const { data: topGames } = useTopGames()

  function formatTime(minutes) {
    if (!minutes) return '0h'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}min`
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-100">Statistiques</h1>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>}

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Parties jouées" value={stats.totalPlays} />
            <StatCard label="Temps de jeu" value={formatTime(stats.totalMinutes)} />
            <StatCard label="Jeux possédés" value={stats.ownedGames} />
            <StatCard
              label="Taux de victoire"
              value={stats.winRate !== null ? `${stats.winRate}%` : '—'}
              sub={`${stats.wins} victoires`}
            />
          </div>

          {stats.bestMonth && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Mois le plus actif</p>
              <p className="text-zinc-100 font-semibold">{stats.bestMonth[0]}</p>
              <p className="text-xs text-zinc-500">{stats.bestMonth[1]} parties</p>
            </div>
          )}

          {topGames && topGames.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-zinc-300">Jeux les plus joués</h2>
              {topGames.map((entry, i) => (
                <div key={entry.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-bold text-zinc-500 w-5 text-center">{i + 1}</span>
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                    {entry.game?.cover_url
                      ? <img src={entry.game.cover_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">🎲</div>
                    }
                  </div>
                  <span className="flex-1 text-sm font-medium text-zinc-100 truncate">{entry.game?.title ?? '—'}</span>
                  <span className="text-sm font-semibold text-zinc-300 tabular-nums shrink-0">
                    {entry.count} partie{entry.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
