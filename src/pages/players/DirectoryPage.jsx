import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useAllPlayers, useGameOwners } from '../../hooks/usePlayers'
import { useCatalogSearch } from '../../hooks/useCatalog'

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ url, username, size = 'md' }) {
  const initials = (username ?? '?')[0].toUpperCase()
  const dim = size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  return (
    <div className={`${dim} rounded-full bg-amber-400/20 overflow-hidden flex items-center justify-center text-amber-400 font-bold shrink-0`}>
      {url
        ? <img src={url} alt={username} className="w-full h-full object-cover" />
        : <span>{initials}</span>}
    </div>
  )
}

// ── Players tab ───────────────────────────────────────────────────────────────

function PlayersTab() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const { data: players, isLoading, isError } = useAllPlayers(debouncedSearch)

  return (
    <div className="flex flex-col gap-3">
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
          placeholder="Rechercher un joueur…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
        />
      </div>

      {isLoading && <div className="flex justify-center py-10"><Spinner className="w-7 h-7" /></div>}
      {isError && <p className="text-center text-red-400 text-sm py-6">Erreur de chargement.</p>}

      {!isLoading && !isError && players?.length === 0 && (
        <p className="text-center text-zinc-500 text-sm py-10">
          {search ? `Aucun joueur pour « ${search} »` : 'Aucun joueur enregistré.'}
        </p>
      )}

      {!isLoading && players && players.length > 0 && (
        <div className="flex flex-col divide-y divide-zinc-800">
          {players.map((player) => (
            <Link
              key={player.id}
              to={`/players/${player.id}`}
              className="flex items-center gap-3 py-3 px-1 hover:bg-zinc-800/50 rounded-xl transition-colors"
            >
              <Avatar url={player.avatar_url} username={player.username} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">{player.username}</p>
                <p className="text-xs text-zinc-500">
                  {player.collectionCount > 0
                    ? `${player.collectionCount} jeu${player.collectionCount > 1 ? 'x' : ''} dans sa collection`
                    : 'Collection vide'}
                </p>
              </div>
              <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Game owners panel (inside Qui possède tab) ────────────────────────────────

function GameOwnersPanel({ game, onBack }) {
  const { data: owners, isLoading } = useGameOwners(game.id)

  return (
    <div className="flex flex-col gap-3">
      {/* Game header */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 self-start"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour
      </button>

      <div className="flex gap-3 items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
          {game.cover_url
            ? <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-lg">🎲</div>}
        </div>
        <div>
          <p className="font-semibold text-zinc-100 text-sm">{game.title}</p>
          {game.publisher && <p className="text-xs text-zinc-500">{game.publisher}</p>}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-6"><Spinner className="w-6 h-6" /></div>}

      {!isLoading && owners?.length === 0 && (
        <p className="text-center text-zinc-500 text-sm py-6">
          Personne dans l'annuaire ne possède ce jeu.
        </p>
      )}

      {!isLoading && owners && owners.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
            {owners.length} joueur{owners.length > 1 ? 's' : ''}
          </p>
          {owners.map((o) => (
            <Link
              key={o.user_id}
              to={`/players/${o.user_id}`}
              className="flex items-center gap-3 py-2.5 px-1 hover:bg-zinc-800/50 rounded-xl transition-colors"
            >
              <Avatar url={o.profile.avatar_url} username={o.profile.username} />
              <p className="flex-1 text-sm font-medium text-zinc-100 truncate">
                {o.profile.username}
              </p>
              <Badge status={o.status} />
              <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Qui possède tab ───────────────────────────────────────────────────────────

function WhoOwnsTab() {
  const [query, setQuery] = useState('')
  const [selectedGame, setSelectedGame] = useState(null)
  const debouncedQuery = useDebounce(query)

  const { data: results, isFetching } = useCatalogSearch(debouncedQuery)

  if (selectedGame) {
    return (
      <GameOwnersPanel
        game={selectedGame}
        onBack={() => { setSelectedGame(null); setQuery('') }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un jeu…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
        />
      </div>

      {debouncedQuery.length < 2 && (
        <p className="text-center text-zinc-600 text-sm py-8">
          Tape le nom d'un jeu pour voir qui le possède.
        </p>
      )}

      {isFetching && <div className="flex justify-center py-6"><Spinner className="w-6 h-6" /></div>}

      {!isFetching && debouncedQuery.length >= 2 && results?.length === 0 && (
        <p className="text-center text-zinc-500 text-sm py-6">
          Aucun jeu pour « {debouncedQuery} »
        </p>
      )}

      {!isFetching && results && results.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-800">
          {results.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                onClick={() => setSelectedGame(game)}
                className="w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-zinc-800/50 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                  {game.cover_url
                    ? <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-base">🎲</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{game.title}</p>
                  {game.publisher && <p className="text-xs text-zinc-500 truncate">{game.publisher}</p>}
                </div>
                <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'players', label: 'Joueurs' },
  { id: 'games', label: 'Qui possède ?' },
]

export default function DirectoryPage() {
  const [tab, setTab] = useState('players')

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 min-h-full">
      <h1 className="text-xl font-bold text-zinc-100">Annuaire</h1>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`pb-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'players' ? <PlayersTab /> : <WhoOwnsTab />}
    </div>
  )
}
