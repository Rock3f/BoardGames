import { useMemo, useState } from 'react'
import { useMyCollection, useMyPlayCounts } from '../../hooks/useCollection'
import { GameCard } from '../../components/collection/GameCard'
import { GameEntryModal } from '../../components/collection/GameEntryModal'
import { AddGameModal } from '../../components/collection/AddGameModal'
import { Spinner } from '../../components/ui/Spinner'

const STATUS_TABS = [
  { value: null, label: 'Tous' },
  { value: 'owned', label: 'Possédé' },
  { value: 'loaned', label: 'Prêté' },
  { value: 'borrowed', label: 'Emprunté' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'sold', label: 'Vendu' },
]

const PLAYER_OPTIONS = [
  { value: null, label: 'Joueurs' },
  { value: 2, label: '2+' },
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
  { value: 5, label: '5+' },
]

const DURATION_OPTIONS = [
  { value: null, label: 'Durée' },
  { value: 30, label: '≤ 30 min' },
  { value: 60, label: '≤ 1h' },
  { value: 90, label: '≤ 1h30' },
  { value: 120, label: '≤ 2h' },
]

export default function CollectionPage() {
  const [activeStatus, setActiveStatus] = useState(null)
  const [search, setSearch] = useState('')
  const [minPlayers, setMinPlayers] = useState(null)
  const [maxDuration, setMaxDuration] = useState(null)
  const [editEntry, setEditEntry] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading, isError } = useMyCollection(activeStatus)
  const { data: playCounts } = useMyPlayCounts()

  const filtered = useMemo(() => {
    if (!data) return []
    let entries = data
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      entries = entries.filter((e) => e.game?.title?.toLowerCase().includes(q))
    }
    if (minPlayers) {
      entries = entries.filter((e) => (e.game?.max_players ?? 0) >= minPlayers)
    }
    if (maxDuration) {
      entries = entries.filter(
        (e) => !e.game?.min_duration_min || e.game.min_duration_min <= maxDuration
      )
    }
    return entries
  }, [data, search, minPlayers, maxDuration])

  const collectionGameIds = useMemo(
    () => new Set((data ?? []).map((e) => e.game_id)),
    [data]
  )

  const hasActiveFilters = minPlayers !== null || maxDuration !== null

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Ma collection</h1>
        <span className="text-sm text-zinc-500">{data?.length ?? 0} jeux</span>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={label}
            onClick={() => setActiveStatus(value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeStatus === value
                ? 'bg-amber-400 text-zinc-950 border-amber-400'
                : 'text-zinc-400 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher dans ma collection…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
        />
      </div>

      {/* Advanced filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={minPlayers ?? ''}
          onChange={(e) => setMinPlayers(e.target.value ? Number(e.target.value) : null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            minPlayers ? 'border-amber-400 text-amber-400' : 'border-zinc-700 text-zinc-400'
          }`}
        >
          {PLAYER_OPTIONS.map(({ value, label }) => (
            <option key={label} value={value ?? ''}>{label}</option>
          ))}
        </select>
        <select
          value={maxDuration ?? ''}
          onChange={(e) => setMaxDuration(e.target.value ? Number(e.target.value) : null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            maxDuration ? 'border-amber-400 text-amber-400' : 'border-zinc-700 text-zinc-400'
          }`}
        >
          {DURATION_OPTIONS.map(({ value, label }) => (
            <option key={label} value={value ?? ''}>{label}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => { setMinPlayers(null); setMaxDuration(null) }}
            className="px-3 py-1.5 rounded-full text-xs text-zinc-500 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      )}

      {isError && (
        <p className="text-center text-red-400 py-8 text-sm">
          Erreur de chargement. Vérifie ta connexion.
        </p>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
          <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <p className="text-sm">
            {search ? `Aucun jeu correspondant à « ${search} »` : 'Ta collection est vide'}
          </p>
          {!search && (
            <button
              onClick={() => setAddOpen(true)}
              className="text-sm text-amber-400 hover:underline"
            >
              Ajouter ton premier jeu
            </button>
          )}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((entry) => (
            <GameCard
              key={entry.id}
              entry={entry}
              onClick={setEditEntry}
              playCount={playCounts?.[entry.catalog_game_id] ?? 0}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Ajouter un jeu"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 rounded-full bg-amber-400 text-zinc-950 shadow-lg hover:bg-amber-300 transition-colors flex items-center justify-center z-30"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Modals */}
      <GameEntryModal
        entry={editEntry}
        onClose={() => setEditEntry(null)}
      />
      <AddGameModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        collectionGameIds={collectionGameIds}
      />
    </div>
  )
}
