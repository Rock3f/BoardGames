import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useChampionship,
  useChampionshipStandings,
  useChampionshipAvailableGames,
  useTransitionChampionship,
  useApproveAllPendingGames,
  useAddChampionshipPlayer,
  useRemoveChampionshipPlayer,
  useSuggestGame,
  useManageGame,
} from '../../hooks/useChampionships'
import { useChampionshipPlays } from '../../hooks/usePlays'
import { usePlayerSearch } from '../../hooks/usePlayers'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../context/AuthContext'
import { NewPlayModal } from '../../components/plays/NewPlayModal'

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Standings tab ────────────────────────────────────────────────────────────

function StandingsTab({ championship }) {
  const { data: rawStandings, isLoading } = useChampionshipStandings(championship.id)
  const winCondition = championship.scoring?.win_condition ?? 'highest'

  const standings = useMemo(() => {
    if (!rawStandings?.length) return rawStandings
    if (winCondition === 'highest') return rawStandings

    // lowest: re-trier par total_points croissant et recalculer les rangs
    const sorted = [...rawStandings].sort((a, b) => a.total_points - b.total_points)
    let rank = 1
    return sorted.map((row, i) => {
      if (i > 0 && sorted[i].total_points !== sorted[i - 1].total_points) rank = i + 1
      return { ...row, rank }
    })
  }, [rawStandings, winCondition])

  if (isLoading) return <div className="flex justify-center py-10"><Spinner className="w-7 h-7" /></div>

  if (!standings?.length) {
    return (
      <div className="flex flex-col items-center py-12 text-zinc-500 gap-2">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5M7.5 18.75v-4.5M3 5.25h18M5.25 5.25v7.5a6.75 6.75 0 0013.5 0v-7.5" />
        </svg>
        <p className="text-sm">Aucun résultat pour l'instant.</p>
        <p className="text-xs text-zinc-600">Le classement sera calculé au fil des parties.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {standings.map((row, i) => (
        <div
          key={row.player_id ?? i}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
            row.rank === 1 ? 'border-amber-400/40 bg-amber-400/5' : 'border-zinc-800 bg-zinc-900'
          }`}
        >
          <span className={`text-lg font-bold w-7 text-center ${row.rank === 1 ? 'text-amber-400' : 'text-zinc-500'}`}>
            {row.rank === 1 ? '🏆' : row.rank}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate">{row.display_name ?? '—'}</p>
            <p className="text-xs text-zinc-500">
              {row.games_played} partie{row.games_played !== 1 ? 's' : ''} · {row.wins}V {row.draws}N {row.losses}D
            </p>
          </div>
          <span className="text-lg font-bold text-zinc-100 tabular-nums">{row.total_points} pts</span>
        </div>
      ))}
    </div>
  )
}

// ─── Games tab ────────────────────────────────────────────────────────────────

const gameStatusConfig = {
  suggested: { label: 'En attente', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  approved:  { label: 'Approuvé',   cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  rejected:  { label: 'Refusé',     cls: 'text-zinc-500 bg-zinc-800 border-zinc-700' },
}

const DURATION_FILTERS = [
  { key: 'all',    label: 'Toutes' },
  { key: 'quick',  label: '< 30 min',  max: 30 },
  { key: 'short',  label: '30–60 min', min: 30,  max: 60 },
  { key: 'medium', label: '1–2 h',     min: 60,  max: 120 },
  { key: 'long',   label: '2 h+',      min: 120 },
]

const PLAYERS_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: '2',   label: '2' },
  { key: '3',   label: '3' },
  { key: '4',   label: '4' },
  { key: '5+',  label: '5+' },
]

const GAME_LIMIT = 12

function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(opt => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
            value === opt.key
              ? 'bg-amber-400 text-zinc-950 border-amber-400'
              : 'bg-transparent text-zinc-500 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500'
          }`}
        >
          {opt.label}
          {opt.count != null && (
            <span className={`ml-1 ${value === opt.key ? 'opacity-60' : 'text-zinc-600'}`}>{opt.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function GamesTab({ championship }) {
  const toast = useToast()
  const { session } = useAuth()
  const suggestGame = useSuggestGame()
  const manageGame = useManageGame()
  const isOwner = championship.created_by === session?.user?.id
  const existingGames = championship.championship_games ?? []
  const suggestedIds = new Set(existingGames.map(g => g.catalog_game_id))
  const players = championship.championship_players ?? []
  const userPlayers = players.filter(p => p.user_id)

  const { data: champPlays } = useChampionshipPlays(championship.id)
  const playCountsByGame = useMemo(() => {
    const counts = {}
    for (const p of champPlays ?? []) {
      counts[p.catalog_game_id] = (counts[p.catalog_game_id] ?? 0) + 1
    }
    return counts
  }, [champPlays])

  const { data: availableGames, isLoading: gamesLoading } = useChampionshipAvailableGames(championship)

  // Map user_id → displayName for suggesters
  const playerMap = useMemo(() =>
    Object.fromEntries(players.filter(p => p.user_id).map(p => [p.user_id, p.displayName])),
    [players]
  )

  // Filters — existing championship games
  const [statusFilter, setStatusFilter] = useState('all')
  const [cgOwnerFilter, setCgOwnerFilter] = useState('all')
  const [suggestByFilter, setSuggestByFilter] = useState('all')
  const [cgPlayersFilter, setCgPlayersFilter] = useState('all')
  const [cgDurationFilter, setCgDurationFilter] = useState('all')

  // Filters — available games to suggest
  const [query, setQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState(null)
  const [playersFilter, setPlayersFilter] = useState('all')
  const [durationFilter, setDurationFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)

  // Detect available metadata for conditional filter display
  const hasPlayersData = useMemo(() =>
    (availableGames ?? []).some(g => g.min_players != null || g.max_players != null),
    [availableGames]
  )
  const hasDurationData = useMemo(() =>
    (availableGames ?? []).some(g => g.min_duration_min != null || g.max_duration_min != null),
    [availableGames]
  )

  // Status counts for filter chips
  const statusCounts = useMemo(() => ({
    all:       existingGames.length,
    approved:  existingGames.filter(g => g.status === 'approved').length,
    suggested: existingGames.filter(g => g.status === 'suggested').length,
    rejected:  existingGames.filter(g => g.status === 'rejected').length,
  }), [existingGames])

  const statusOptions = useMemo(() => [
    { key: 'all',       label: 'Tous',        count: statusCounts.all },
    { key: 'approved',  label: 'Approuvés',   count: statusCounts.approved },
    { key: 'suggested', label: 'En attente',  count: statusCounts.suggested },
    { key: 'rejected',  label: 'Refusés',     count: statusCounts.rejected },
  ].filter(o => o.key === 'all' || o.count > 0), [statusCounts])

  // Unique suggesters (only when >1 distinct person suggested)
  const uniqueSuggesters = useMemo(() => {
    const ids = [...new Set(existingGames.map(g => g.suggested_by).filter(Boolean))]
    return ids.length > 1 ? ids : []
  }, [existingGames])

  const suggestByOptions = useMemo(() => [
    { key: 'all', label: 'Tous' },
    ...uniqueSuggesters.map(uid => ({ key: uid, label: playerMap[uid] ?? '?' })),
  ], [uniqueSuggesters, playerMap])

  // catalog_game_id → ownerIds[], built from availableGames (which already has ownerIds)
  const cgOwnerMap = useMemo(() =>
    Object.fromEntries((availableGames ?? []).map(g => [g.id, g.ownerIds ?? []])),
    [availableGames]
  )

  // Owner filter options for championship games (real user players only)
  const cgOwnerOptions = useMemo(() => [
    { key: 'all', label: 'Tous' },
    ...userPlayers.map(p => ({ key: p.user_id, label: p.displayName, avatarUrl: p.avatarUrl })),
  ], [userPlayers])

  const cgHasPlayersData = useMemo(() =>
    existingGames.some(g => g.game?.min_players != null || g.game?.max_players != null),
    [existingGames]
  )
  const cgHasDurationData = useMemo(() =>
    existingGames.some(g => g.game?.min_duration_min != null || g.game?.max_duration_min != null),
    [existingGames]
  )

  // Filtered existing games
  const filteredExisting = useMemo(() => {
    return existingGames
      .filter(g => statusFilter === 'all' || g.status === statusFilter)
      .filter(g => cgOwnerFilter === 'all' || (cgOwnerMap[g.catalog_game_id] ?? []).includes(cgOwnerFilter))
      .filter(g => suggestByFilter === 'all' || g.suggested_by === suggestByFilter)
      .filter(g => {
        if (cgPlayersFilter === 'all') return true
        const min = g.game?.min_players ?? 1
        const max = g.game?.max_players ?? 99
        if (cgPlayersFilter === '5+') return max >= 5
        const n = parseInt(cgPlayersFilter)
        return min <= n && max >= n
      })
      .filter(g => {
        if (cgDurationFilter === 'all') return true
        const t = g.game?.min_duration_min ?? g.game?.max_duration_min
        if (t == null) return true
        const f = DURATION_FILTERS.find(d => d.key === cgDurationFilter)
        if (!f) return true
        return (f.min == null || t >= f.min) && (f.max == null || t < f.max)
      })
  }, [existingGames, statusFilter, cgOwnerFilter, cgOwnerMap, suggestByFilter, cgPlayersFilter, cgDurationFilter])

  // Filtered available games
  const filteredAvailable = useMemo(() => {
    return (availableGames ?? [])
      .filter(g => !suggestedIds.has(g.id))
      .filter(g => !query || g.title.toLowerCase().includes(query.toLowerCase()))
      .filter(g => !ownerFilter || (g.ownerIds ?? []).includes(ownerFilter))
      .filter(g => {
        if (playersFilter === 'all') return true
        if (playersFilter === '5+') return (g.max_players ?? 99) >= 5
        const n = parseInt(playersFilter)
        return (g.min_players ?? 1) <= n && (g.max_players ?? 99) >= n
      })
      .filter(g => {
        if (durationFilter === 'all') return true
        const t = g.min_duration_min ?? g.max_duration_min
        if (t == null) return true
        const f = DURATION_FILTERS.find(d => d.key === durationFilter)
        if (!f) return true
        return (f.min == null || t >= f.min) && (f.max == null || t < f.max)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableGames, query, ownerFilter, playersFilter, durationFilter, suggestedIds.size])

  const displayedAvailable = showAll ? filteredAvailable : filteredAvailable.slice(0, GAME_LIMIT)

  // L'organisateur est toujours dans championship_players — on l'exclut du seuil
  const hasParticipants = players.some(p =>
    p.provisioned_player_id || (p.user_id && p.user_id !== session?.user?.id)
  )

  async function handleSuggest(game) {
    try {
      await suggestGame.mutateAsync({ championshipId: championship.id, catalogGameId: game.id })
      toast.success(`${game.title} suggéré !`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleStatus(cgId, champId, status) {
    try {
      await manageGame.mutateAsync({ id: cgId, championshipId: champId, status })
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Reset showAll when filters change
  const handleQuery = (v) => { setQuery(v); setShowAll(false) }
  const handleOwner = (v) => { setOwnerFilter(v); setShowAll(false) }
  const handlePlayers = (v) => { setPlayersFilter(v); setShowAll(false) }
  const handleDuration = (v) => { setDurationFilter(v); setShowAll(false) }

  const [openChamp, setOpenChamp] = useState(true)
  const [openSuggest, setOpenSuggest] = useState(true)

  return (
    <div className="flex flex-col gap-4">

      {/* ── Jeux du championnat ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-0 border border-zinc-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenChamp(v => !v)}
          className="flex items-center justify-between w-full px-4 py-3.5 bg-zinc-900 hover:bg-zinc-800/60 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Jeux du championnat
            </p>
            {existingGames.length > 0 && (
              <span className="text-xs text-zinc-600 tabular-nums bg-zinc-800 px-1.5 py-0.5 rounded-full">{existingGames.length}</span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${openChamp ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {openChamp && <div className="flex flex-col gap-3 px-4 pb-4 pt-3">

        {existingGames.length > 1 && (
          <div className="flex flex-col gap-2">
            <FilterChips options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
            {userPlayers.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-600">Propriétaire</span>
                <div className="flex gap-1.5 flex-wrap">
                  {cgOwnerOptions.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setCgOwnerFilter(opt.key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        cgOwnerFilter === opt.key
                          ? 'bg-amber-400 text-zinc-950 border-amber-400'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500'
                      }`}
                    >
                      {opt.avatarUrl && (
                        <img src={opt.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {uniqueSuggesters.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-600">Suggéré par</span>
                <FilterChips options={suggestByOptions} value={suggestByFilter} onChange={v => { setSuggestByFilter(v) }} />
              </div>
            )}
            {cgHasPlayersData && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-600">Joueurs</span>
                <FilterChips options={PLAYERS_FILTERS} value={cgPlayersFilter} onChange={setCgPlayersFilter} />
              </div>
            )}
            {cgHasDurationData && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-600">Durée</span>
                <FilterChips options={DURATION_FILTERS} value={cgDurationFilter} onChange={setCgDurationFilter} />
              </div>
            )}
          </div>
        )}

        {filteredExisting.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredExisting.map(cg => {
              const cfg = gameStatusConfig[cg.status] ?? gameStatusConfig.suggested
              const playCount = playCountsByGame[cg.catalog_game_id] ?? 0
              return (
                <div key={cg.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-3 transition-colors hover:border-zinc-700">
                  <div className="w-10 h-[52px] rounded-xl overflow-hidden shrink-0 bg-zinc-800">
                    {cg.game?.cover_url
                      ? <img src={cg.game.cover_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-lg">🎲</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">{cg.game?.title ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                      {cg.status === 'approved' && (
                        <span className="text-xs text-zinc-500">
                          {playCount > 0
                            ? `${playCount} partie${playCount > 1 ? 's' : ''} jouée${playCount > 1 ? 's' : ''}`
                            : 'Pas encore joué'}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOwner && cg.status === 'suggested' && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleStatus(cg.id, championship.id, 'approved')}
                        className="w-8 h-8 flex items-center justify-center text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-colors"
                        title="Approuver"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleStatus(cg.id, championship.id, 'rejected')}
                        className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                        title="Refuser"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : existingGames.length > 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="text-sm text-zinc-600">Aucun jeu ne correspond à ces filtres.</p>
            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setCgOwnerFilter('all'); setSuggestByFilter('all'); setCgPlayersFilter('all'); setCgDurationFilter('all') }}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : championship.status === 'closed' ? (
          <p className="text-sm text-zinc-500 text-center py-8">Aucun jeu enregistré.</p>
        ) : (
          <p className="text-sm text-zinc-600 text-center py-4">
            Aucun jeu pour l'instant — suggérez-en ci-dessous.
          </p>
        )}
        </div>}
      </section>

      {/* ── Suggérer un jeu ─────────────────────────────────────────────── */}
      {championship.status !== 'closed' && (
        <section className="flex flex-col gap-0 border border-zinc-800 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenSuggest(v => !v)}
            className="flex items-center justify-between w-full px-4 py-3.5 bg-zinc-900 hover:bg-zinc-800/60 transition-colors"
          >
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Suggérer un jeu
            </p>
            <svg
              className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${openSuggest ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {openSuggest && <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
          {!hasParticipants ? (
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4">
              <span className="text-xl">👥</span>
              <p className="text-sm text-zinc-400">
                Ajoutez des participants pour voir leurs collections et suggérer des jeux.
              </p>
            </div>
          ) : (
            <>
              {/* Filtre propriétaire */}
              {userPlayers.length > 0 && (availableGames?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-zinc-600">Propriétaire</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleOwner(null)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        !ownerFilter
                          ? 'bg-amber-400 text-zinc-950 border-amber-400'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500'
                      }`}
                    >
                      Tous
                    </button>
                    {userPlayers.map(p => (
                      <button
                        key={p.user_id}
                        type="button"
                        onClick={() => handleOwner(ownerFilter === p.user_id ? null : p.user_id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                          ownerFilter === p.user_id
                            ? 'bg-amber-400 text-zinc-950 border-amber-400'
                            : 'bg-transparent text-zinc-500 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500'
                        }`}
                      >
                        {p.avatarUrl && (
                          <img src={p.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                        )}
                        {p.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Filtre nombre de joueurs */}
              {hasPlayersData && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-zinc-600">Nombre de joueurs</span>
                  <FilterChips options={PLAYERS_FILTERS} value={playersFilter} onChange={handlePlayers} />
                </div>
              )}

              {/* Filtre durée */}
              {hasDurationData && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-zinc-600">Durée de partie</span>
                  <FilterChips options={DURATION_FILTERS} value={durationFilter} onChange={handleDuration} />
                </div>
              )}

              {/* Recherche */}
              <div className="relative">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={e => handleQuery(e.target.value)}
                  placeholder="Rechercher un jeu…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                />
                {query && (
                  <button type="button" onClick={() => handleQuery('')}
                    className="absolute inset-y-0 right-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Grille de jeux — pas de scroll horizontal */}
              {gamesLoading ? (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <div className="w-full aspect-[3/4] rounded-xl bg-zinc-800 animate-pulse" />
                      <div className="w-3/4 h-2.5 rounded bg-zinc-800 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : filteredAvailable.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                    {displayedAvailable.map(game => (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => handleSuggest(game)}
                        disabled={suggestGame.isPending}
                        className="flex flex-col items-center gap-1.5 group disabled:opacity-50"
                      >
                        <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 border-2 border-transparent group-hover:border-amber-400/60 group-active:scale-95 transition-all">
                          {game.cover_url
                            ? <img src={game.cover_url} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-2xl">🎲</div>
                          }
                        </div>
                        {(game.min_players || game.max_players || game.min_duration_min) && (
                          <div className="flex gap-1 flex-wrap justify-center">
                            {(game.min_players || game.max_players) && (
                              <span className="text-[9px] text-zinc-600 bg-zinc-800 rounded px-1 py-0.5 leading-none">
                                {game.min_players === game.max_players
                                  ? `${game.min_players}J`
                                  : `${game.min_players ?? '?'}–${game.max_players ?? '?'}J`}
                              </span>
                            )}
                            {game.min_duration_min && (
                              <span className="text-[9px] text-zinc-600 bg-zinc-800 rounded px-1 py-0.5 leading-none">
                                {game.min_duration_min < 60
                                  ? `${game.min_duration_min}min`
                                  : `${Math.round(game.min_duration_min / 60)}h`}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full text-zinc-400 group-hover:text-zinc-200 transition-colors">
                          {game.title}
                        </p>
                      </button>
                    ))}
                  </div>

                  {filteredAvailable.length > GAME_LIMIT && (
                    <button
                      type="button"
                      onClick={() => setShowAll(s => !s)}
                      className="text-sm text-amber-400 hover:text-amber-300 transition-colors py-1 text-center"
                    >
                      {showAll
                        ? 'Voir moins'
                        : `Voir les ${filteredAvailable.length - GAME_LIMIT} autres jeux`}
                    </button>
                  )}
                </>
              ) : (availableGames ?? []).length > 0 ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <p className="text-sm text-zinc-500">Aucun jeu ne correspond à ces filtres.</p>
                  <button
                    type="button"
                    onClick={() => { setOwnerFilter(null); setPlayersFilter('all'); setDurationFilter('all'); setQuery('') }}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 text-center py-6">
                  Aucun jeu dans les collections des participants.
                </p>
              )}
            </>
          )}
          </div>}
        </section>
      )}
    </div>
  )
}

// ─── Plays tab ────────────────────────────────────────────────────────────────

function formatDurationMin(min) {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function PlaysTab({ championship }) {
  const { data: plays, isLoading } = useChampionshipPlays(championship.id)

  if (isLoading) return <div className="flex justify-center py-10"><Spinner className="w-7 h-7" /></div>

  if (!plays?.length) {
    return (
      <div className="flex flex-col items-center py-12 text-zinc-500 gap-2">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">Aucune partie enregistrée.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {plays.map(play => {
        const participants = play.play_participants ?? []
        const teams = play.play_teams ?? []
        const hasTeams = teams.length > 0
        const entities = hasTeams
          ? teams
          : participants.filter(p => !p.play_team_id)

        return (
          <div key={play.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                {play.game?.cover_url
                  ? <img src={play.game.cover_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">🎲</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">{play.game?.title ?? '—'}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(play.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {play.duration_min && ` · ${formatDurationMin(play.duration_min)}`}
                </p>
              </div>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1.5">
              {entities.map(e => {
                const label = hasTeams
                  ? (e.name || `Équipe (${participants.filter(p => p.play_team_id === e.id).map(p => p.displayName).join(', ')})`)
                  : (e.displayName ?? '?')
                return (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <span className={e.is_winner ? 'text-amber-400 font-medium' : 'text-zinc-400'}>
                      {e.is_winner && '🏆 '}{label}
                    </span>
                    <div className="flex items-center gap-3">
                      {e.score !== null && e.score !== undefined && (
                        <span className="tabular-nums text-zinc-400">{e.score}</span>
                      )}
                      {/* championship_points from first participant in team or from individual */}
                      {(() => {
                        const pts = hasTeams
                          ? participants.find(p => p.play_team_id === e.id)?.championship_points
                          : e.championship_points
                        return pts !== null && pts !== undefined
                          ? <span className="text-xs text-amber-400 font-semibold tabular-nums">{pts} pts</span>
                          : null
                      })()}
                    </div>
                  </div>
                )
              })}
              {play.comment && (
                <p className="text-xs text-zinc-500 italic mt-1">« {play.comment} »</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Rules tab ────────────────────────────────────────────────────────────────

function ScoringDisplay({ scoring }) {
  if (!scoring) return null
  const mode = scoring.mode ?? 'by_result'
  const winCondition = scoring.win_condition ?? 'highest'
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        Grille de points ({mode === 'by_result' ? 'par résultat' : 'par classement'})
      </p>
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
        winCondition === 'lowest'
          ? 'border-zinc-700 bg-zinc-800'
          : 'border-zinc-800 bg-zinc-900'
      }`}>
        <span className="text-base">{winCondition === 'lowest' ? '⛳' : '🏆'}</span>
        <div>
          <p className="text-sm font-medium text-zinc-200">
            Vainqueur : {winCondition === 'lowest' ? 'le moins de points' : 'le plus de points'}
          </p>
          <p className="text-xs text-zinc-500">
            {winCondition === 'lowest' ? 'Classement croissant (ex : golf)' : 'Classement décroissant (standard)'}
          </p>
        </div>
      </div>
      {mode === 'by_result' && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['win', 'Victoire', 'text-emerald-400'], ['draw', 'Match nul', 'text-zinc-300'], ['loss', 'Défaite', 'text-red-400']].map(([k, label, cls]) => (
            <div key={k} className="bg-zinc-800 rounded-xl p-3">
              <p className={`text-2xl font-bold ${cls}`}>{scoring.by_result?.[k] ?? 0}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
      {mode === 'by_rank' && (
        <div className="flex flex-col gap-2">
          {(scoring.by_rank ?? []).map(r => (
            <div key={r.rank} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-2.5">
              <span className="text-sm text-zinc-300">Place {r.rank}</span>
              <span className="text-sm font-semibold text-zinc-100">{r.points} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RulesTab({ championship }) {
  const { session } = useAuth()
  const toast = useToast()
  const isOwner = championship.created_by === session?.user?.id
  const addPlayer = useAddChampionshipPlayer()
  const removePlayer = useRemoveChampionshipPlayer()
  const [playerQuery, setPlayerQuery] = useState('')
  const { data: searchResults } = usePlayerSearch(playerQuery)
  const players = championship.championship_players ?? []

  const tiebreakLabels = {
    wins: 'Nombre de victoires',
    score_sum: 'Total des scores',
    head_to_head: 'Confrontations directes',
    points_diff: 'Différence de points',
  }

  async function handleAddPlayer(user) {
    const alreadyIn = players.some(p =>
      (user.type === 'user' && p.user_id === user.id) ||
      (user.type === 'provisioned' && p.provisioned_player_id === user.id)
    )
    if (alreadyIn) { toast.error('Ce joueur est déjà dans le championnat.'); return }
    try {
      const row = user.type === 'provisioned'
        ? { championshipId: championship.id, provisionedPlayerId: user.id }
        : { championshipId: championship.id, userId: user.id }
      await addPlayer.mutateAsync(row)
      setPlayerQuery('')
      toast.success(`${user.username} ajouté !`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleRemovePlayer(cp) {
    try {
      await removePlayer.mutateAsync({ id: cp.id, championshipId: championship.id })
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Participants */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Participants ({players.length})
        </p>

        {isOwner && championship.status !== 'closed' && (
          <div className="relative">
            <input
              type="text"
              value={playerQuery}
              onChange={e => setPlayerQuery(e.target.value)}
              placeholder="Ajouter un joueur…"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
            {searchResults && playerQuery.length >= 2 && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                {[
                  ...(searchResults.users ?? []).map(u => ({ ...u, type: 'user' })),
                  ...(searchResults.provisioned ?? []).map(u => ({ ...u, type: 'provisioned' })),
                ].map(u => (
                  <button
                    key={`${u.type}-${u.id}`}
                    type="button"
                    onMouseDown={() => handleAddPlayer(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center text-xs font-semibold text-zinc-300">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        : getInitials(u.username)
                      }
                    </div>
                    <span className="text-sm text-zinc-100 truncate">{u.username}</span>
                    {u.type === 'provisioned' && <span className="text-xs text-zinc-500 ml-auto shrink-0">profil</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {players.map(cp => (
            <div key={cp.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center text-xs font-semibold text-zinc-200">
                {cp.avatarUrl
                  ? <img src={cp.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : getInitials(cp.displayName)
                }
              </div>
              <span className="flex-1 text-sm text-zinc-200 truncate">{cp.displayName}</span>
              {cp.user_id
                ? <span className="text-xs text-zinc-600 shrink-0">compte</span>
                : <span className="text-xs text-zinc-600 shrink-0">profil</span>
              }
              {isOwner && championship.status !== 'closed' && (
                <button
                  onClick={() => handleRemovePlayer(cp)}
                  className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-sm text-zinc-600 text-center py-4">Aucun participant</p>
          )}
        </div>
      </div>

      {/* Scoring */}
      <ScoringDisplay scoring={championship.scoring} />

      {/* Tiebreak */}
      {championship.tiebreak_order?.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Critères de départage</p>
          <ol className="flex flex-col gap-1.5 list-none">
            {championship.tiebreak_order.map((key, i) => (
              <li key={key} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-500 text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                {tiebreakLabels[key] ?? key}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const statusConfig = {
  draft:  { label: 'En préparation', cls: 'bg-zinc-700 text-zinc-300' },
  active: { label: 'En cours',       cls: 'bg-emerald-900/60 text-emerald-400' },
  closed: { label: 'Terminé',        cls: 'bg-zinc-800 text-zinc-500' },
}

export default function ChampionshipDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { session } = useAuth()
  const { data: championship, isLoading } = useChampionship(id)
  const transition = useTransitionChampionship()
  const approveAll = useApproveAllPendingGames()
  const [tab, setTab] = useState('Classement')
  const [startPlayOpen, setStartPlayOpen] = useState(false)

  if (isLoading) {
    return <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>
  }

  if (!championship) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-2">
        <p>Championnat introuvable.</p>
        <button onClick={() => navigate('/championships')} className="text-amber-400 text-sm hover:underline">Retour</button>
      </div>
    )
  }

  const isOwner = championship.created_by === session?.user?.id
  const cfg = statusConfig[championship.status] ?? statusConfig.draft

  // Classement et Parties masqués tant que le championnat n'est pas lancé
  const visibleTabs = championship.status === 'draft'
    ? ['Jeux', 'Règles']
    : ['Classement', 'Jeux', 'Parties', 'Règles']
  const activeTab = visibleTabs.includes(tab) ? tab : visibleTabs[0]

  async function handleTransition(newStatus) {
    try {
      if (newStatus === 'active') {
        await approveAll.mutateAsync(championship.id)
      }
      await transition.mutateAsync({ id: championship.id, status: newStatus })
      toast.success(
        newStatus === 'active' ? 'Championnat lancé !'
        : newStatus === 'closed' ? 'Championnat clôturé.'
        : 'Statut mis à jour.'
      )
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/championships')}
          className="text-zinc-400 hover:text-zinc-100 transition-colors mt-0.5 shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-zinc-100 truncate">{championship.name}</h1>
            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
          </div>
          {championship.description && (
            <p className="text-sm text-zinc-400 mt-1">{championship.description}</p>
          )}
          {(championship.starts_at || championship.ends_at) && (
            <p className="text-xs text-zinc-500 mt-1">
              {[championship.starts_at, championship.ends_at].filter(Boolean)
                .map(d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }))
                .join(' → ')}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {championship.status === 'active' && (
          <button
            type="button"
            onClick={() => setStartPlayOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-zinc-950 text-sm font-bold hover:bg-amber-300 active:scale-[0.98] transition-all shadow-md shadow-amber-400/20"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
            Démarrer une partie
          </button>
        )}
        {isOwner && championship.status === 'draft' && (
          <Button onClick={() => handleTransition('active')} disabled={transition.isPending}>
            Lancer le championnat
          </Button>
        )}
        {isOwner && championship.status === 'active' && (
          <Button variant="danger" onClick={() => handleTransition('closed')} disabled={transition.isPending}>
            Clôturer
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {visibleTabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'Classement' && <StandingsTab championship={championship} />}
        {activeTab === 'Jeux' && <GamesTab championship={championship} />}
        {activeTab === 'Parties' && <PlaysTab championship={championship} />}
        {activeTab === 'Règles' && <RulesTab championship={championship} />}
      </div>

      {/* New play modal pre-linked to this championship */}
      <NewPlayModal
        open={startPlayOpen}
        onClose={() => setStartPlayOpen(false)}
        defaultChampionshipId={championship.id}
        approvedGames={
          (championship.championship_games ?? [])
            .filter(cg => cg.status === 'approved' && cg.game)
            .map(cg => cg.game)
        }
      />
    </div>
  )
}
