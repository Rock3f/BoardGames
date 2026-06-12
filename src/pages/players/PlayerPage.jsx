import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import { usePlayerProfile, usePlayerCollection } from '../../hooks/usePlayers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPlayers(game) {
  if (!game?.min_players && !game?.max_players) return null
  if (game.min_players === game.max_players) return `${game.min_players}j`
  return `${game.min_players}–${game.max_players}j`
}

function formatDuration(game) {
  if (!game?.min_duration_min) return null
  if (!game.max_duration_min || game.max_duration_min === game.min_duration_min)
    return `${game.min_duration_min} min`
  return `${game.min_duration_min}–${game.max_duration_min} min`
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ url, username }) {
  const initials = (username ?? '?')[0].toUpperCase()
  return (
    <div className="w-16 h-16 rounded-full bg-amber-400/20 overflow-hidden flex items-center justify-center text-amber-400 text-2xl font-bold shrink-0">
      {url
        ? <img src={url} alt={username} className="w-full h-full object-cover" />
        : <span>{initials}</span>}
    </div>
  )
}

// ── Game card (read-only) ─────────────────────────────────────────────────────

function PlayerGameCard({ entry }) {
  const { game, status } = entry
  const players = formatPlayers(game)
  const duration = formatDuration(game)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col hover:border-zinc-600 transition-colors group">
      <div className="aspect-square overflow-hidden">
        {game?.cover_url
          ? (
            <img
              src={game.cover_url}
              alt={game.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          )
          : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
          )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-tight">
            {game?.title}
            {game?.year_published && (
              <span className="font-normal text-zinc-500"> ({game.year_published})</span>
            )}
          </p>
          {game?.publisher && (
            <p className="text-xs text-zinc-500 truncate mt-0.5">{game.publisher}</p>
          )}
        </div>
        {(players || duration) && (
          <div className="flex gap-1.5 flex-wrap">
            {players && <span className="text-xs text-zinc-400 bg-zinc-800 rounded-full px-2 py-0.5">👥 {players}</span>}
            {duration && <span className="text-xs text-zinc-400 bg-zinc-800 rounded-full px-2 py-0.5">⏱ {duration}</span>}
          </div>
        )}
        <Badge status={status} />
      </div>
    </div>
  )
}

// ── Status filter tabs ────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: null, label: 'Tous' },
  { value: 'owned', label: 'Possédé' },
  { value: 'lent', label: 'Prêté' },
  { value: 'borrowed', label: 'Emprunté' },
  { value: 'wishlist', label: 'Wishlist' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlayerPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const isOwnProfile = session?.user?.id === id

  const [activeStatus, setActiveStatus] = useState(null)
  const [search, setSearch] = useState('')

  const { data: profile, isLoading: profileLoading } = usePlayerProfile(id)
  const { data: collection, isLoading: collectionLoading } = usePlayerCollection(id)

  const filtered = useMemo(() => {
    if (!collection) return []
    let items = collection
    if (activeStatus) items = items.filter((e) => e.status === activeStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter((e) => e.game?.title?.toLowerCase().includes(q))
    }
    return items
  }, [collection, activeStatus, search])

  if (profileLoading) {
    return <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>
  }

  if (!profile) {
    return (
      <div className="p-6 text-center text-zinc-500">
        <p>Joueur introuvable.</p>
        <Link to="/directory" className="text-amber-400 text-sm hover:underline mt-2 inline-block">
          Retour à l'annuaire
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 min-h-full">
      {/* Back */}
      <Link
        to="/directory"
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 self-start"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Annuaire
      </Link>

      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} username={profile.username} />
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{profile.username}</h1>
          <p className="text-sm text-zinc-500">
            {collection
              ? `${collection.length} jeu${collection.length > 1 ? 'x' : ''} dans sa collection`
              : '…'}
            {isOwnProfile && (
              <Link to="/profile" className="ml-2 text-amber-400 hover:underline text-xs">
                Modifier mon profil
              </Link>
            )}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
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
          placeholder="Rechercher dans la collection…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
        />
      </div>

      {/* Content */}
      {collectionLoading && (
        <div className="flex justify-center py-10"><Spinner className="w-7 h-7" /></div>
      )}

      {!collectionLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
          <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <p className="text-sm">
            {search || activeStatus ? 'Aucun jeu correspondant.' : 'La collection est vide.'}
          </p>
        </div>
      )}

      {!collectionLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((entry) => (
            <PlayerGameCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
