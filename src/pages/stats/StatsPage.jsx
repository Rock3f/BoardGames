import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Spinner } from '../../components/ui/Spinner'
import { useMyStats, useTopGames, useMonthlyPlays, useWinRateByGame, useTopOpponents } from '../../hooks/useStats'
import { StatCard, formatTime, formatHour, chartTheme, CustomTooltip, WinRateTooltip } from '../../components/stats/StatsShared'

export default function StatsPage() {
  const { data: stats, isLoading } = useMyStats()
  const { data: topGames } = useTopGames()
  const { data: monthly } = useMonthlyPlays()
  const { data: winRates } = useWinRateByGame()
  const { data: opponents } = useTopOpponents()

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-100">Statistiques</h1>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>}

      {stats && (
        <StatsContent
          stats={stats}
          topGames={topGames}
          monthly={monthly}
          winRates={winRates}
          opponents={opponents}
        />
      )}
    </div>
  )
}

const COLLECTION_SEGMENTS = [
  { key: 'owned',    label: 'Possédés',  color: 'bg-amber-500',  dot: 'bg-amber-500'  },
  { key: 'wishlist', label: 'Wishlist',  color: 'bg-blue-500',   dot: 'bg-blue-500'   },
  { key: 'lent',     label: 'Prêtés',   color: 'bg-purple-500', dot: 'bg-purple-500' },
  { key: 'borrowed', label: 'Empruntés', color: 'bg-green-500',  dot: 'bg-green-500'  },
  { key: 'for_sale', label: 'À vendre', color: 'bg-red-500',    dot: 'bg-red-500'    },
]

function CollectionBar({ breakdown }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  if (!total) return null
  const active = COLLECTION_SEGMENTS.filter(s => breakdown[s.key] > 0)
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs text-zinc-500">Collection ({total} jeux)</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {active.map(s => (
          <div
            key={s.key}
            className={`${s.color} transition-all`}
            style={{ flex: breakdown[s.key] }}
            title={`${s.label}: ${breakdown[s.key]}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {active.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
            <span className="text-xs text-zinc-400">{s.label}</span>
            <span className="text-xs font-semibold text-zinc-300">{breakdown[s.key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OpponentRow({ opponent, idx }) {
  const initials = (opponent.displayName ?? '?')[0].toUpperCase()
  return (
    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
      <span className="text-sm font-bold text-zinc-500 w-5 text-center">{idx + 1}</span>
      <div className="w-8 h-8 rounded-full bg-amber-400/15 overflow-hidden flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
        {opponent.avatarUrl
          ? <img src={opponent.avatarUrl} alt="" className="w-full h-full object-cover" />
          : <span>{initials}</span>
        }
      </div>
      <span className="flex-1 text-sm font-medium text-zinc-100 truncate">{opponent.displayName}</span>
      <span className="text-xs text-zinc-400 tabular-nums shrink-0">
        {opponent.plays} partie{opponent.plays !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

function DayTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="font-bold text-amber-400">{payload[0].value} partie{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

export function StatsContent({ stats, topGames, monthly, winRates, opponents }) {
  const hasCollection = stats.collectionBreakdown
    && Object.values(stats.collectionBreakdown).some(v => v > 0)

  const hasDayData = stats.dayOfWeekData?.some(d => d.count > 0)

  return (
    <>
      {/* Primary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Parties jouées" value={stats.totalPlays} />
        <StatCard
          label="Temps de jeu"
          value={formatTime(stats.totalMinutes)}
          sub={stats.avgDuration ? `~${formatTime(stats.avgDuration)} / partie` : undefined}
        />
        <StatCard label="Jeux possédés" value={stats.ownedGames} />
        <StatCard
          label="Taux de victoire"
          value={stats.winRate !== null ? `${stats.winRate}%` : '—'}
          sub={`${stats.wins} victoires`}
        />
      </div>

      {/* Diversity metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Jeux différents"
          value={stats.uniqueGamesPlayed || '—'}
          sub="jeux joués au moins 1 fois"
        />
        <StatCard
          label="Partie la plus longue"
          value={stats.longestSession ? formatTime(stats.longestSession) : '—'}
        />
        <StatCard
          label="Parties en championnat"
          value={stats.champPlaysCount || '—'}
        />
        <StatCard
          label="Victoires (30 j)"
          value={stats.recentWinRate !== null ? `${stats.recentWinRate}%` : '—'}
          sub={stats.recentPlaysCount >= 3
            ? `sur ${stats.recentPlaysCount} parties`
            : 'moins de 3 parties'
          }
        />
      </div>

      {/* Score stats (only if scores exist) */}
      {(stats.avgScore !== null || stats.bestScore !== null) && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Score moyen"
            value={stats.avgScore ?? '—'}
          />
          <StatCard
            label="Meilleur score"
            value={stats.bestScore ?? '—'}
          />
        </div>
      )}

      {/* Streaks + hour */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Série en cours"
          value={stats.ongoingStreak > 0 ? `🔥 ${stats.ongoingStreak}` : '—'}
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

      {/* Collection breakdown */}
      {hasCollection && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-300">Collection</h2>
          <CollectionBar breakdown={stats.collectionBreakdown} />
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

      {/* Day of week chart */}
      {hasDayData && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-300">Activité par jour de la semaine</h2>
          {stats.mostActiveDay && (
            <p className="text-xs text-zinc-500 -mt-1">
              Jour favori : <span className="text-zinc-300 font-medium">
                {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][Number(stats.mostActiveDay[0])]}
              </span> ({stats.mostActiveDay[1]} parties)
            </p>
          )}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={stats.dayOfWeekData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<DayTooltip />} cursor={{ fill: '#27272a' }} />
                <Bar dataKey="count" fill={chartTheme.stroke} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
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
              <BarChart data={winRates} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
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

      {/* Top opponents */}
      {opponents && opponents.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-300">Joueurs les plus fréquents</h2>
          {opponents.map((opp, i) => (
            <OpponentRow key={opp.user_id ?? opp.provisioned_player_id} opponent={opp} idx={i} />
          ))}
        </div>
      )}
    </>
  )
}
