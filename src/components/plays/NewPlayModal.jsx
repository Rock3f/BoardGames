import { useEffect, useRef, useState } from 'react'
import { Spinner } from '../ui/Spinner'
import { useCatalogSearch } from '../../hooks/useCatalog'
import { useAllUsers } from '../../hooks/usePlayers'
import { useMyCollection } from '../../hooks/useCollection'
import { useCreatePlay } from '../../hooks/usePlays'
import { useMyActiveChampionships } from '../../hooks/useChampionships'
import { useActivePlayCtx } from '../../context/ActivePlayContext'
import { useToast } from '../ui/Toast'

function useDebounce(value, delay = 300) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{children}</p>
}

function PlayerAvatar({ name, url, size = 'sm' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-xs'
  return (
    <div className={`${dim} rounded-full bg-zinc-700 flex items-center justify-center font-semibold text-zinc-200 shrink-0 overflow-hidden`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
    </div>
  )
}

// ── Game section ──────────────────────────────────────────────────────────────

function GameGalleryItem({ game, selected, inCollection, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center gap-1.5 shrink-0 w-[72px] transition-all ${
        selected ? 'opacity-100 scale-[1.03]' : 'opacity-55 hover:opacity-85'
      }`}>
      <div className={`relative w-[68px] h-[88px] rounded-xl overflow-hidden border-2 transition-all ${
        selected ? 'border-amber-400 shadow-md shadow-amber-400/30' : 'border-transparent'
      }`}>
        {game.cover_url
          ? <img src={game.cover_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-2xl">🎲</div>
        }
        {!inCollection && (
          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-zinc-950/80 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        )}
      </div>
      <p className={`text-[11px] font-medium text-center leading-tight line-clamp-2 w-full px-0.5 ${
        selected ? 'text-amber-400' : 'text-zinc-400'
      }`}>
        {game.title}
      </p>
    </button>
  )
}

function GameSection({ game, setGame }) {
  const { data: collection, isLoading: colLoading } = useMyCollection()
  const [query, setQuery] = useState('')
  const dq = useDebounce(query, 350)
  const { data: catalogResults, isFetching: catalogFetching } = useCatalogSearch(dq)

  const q = query.toLowerCase()
  const collectionGames = (collection ?? [])
    .filter(e => e.status !== 'wishlist' && e.game)
    .map(e => e.game)
  const collectionIds = new Set(collectionGames.map(g => g.id))

  const filteredCollection = q
    ? collectionGames.filter(g => g.title.toLowerCase().includes(q))
    : collectionGames

  const catalogOnly = dq.length >= 2
    ? (catalogResults ?? []).filter(g => !collectionIds.has(g.id))
    : []

  const showGallery = colLoading || filteredCollection.length > 0 || catalogOnly.length > 0 || catalogFetching
  const isEmpty = query && !colLoading && !catalogFetching && filteredCollection.length === 0 && catalogOnly.length === 0

  function toggle(g) {
    setGame(prev => prev?.id === g.id ? null : g)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Rechercher un jeu…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')}
            className="absolute inset-y-0 right-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Skeleton */}
      {colLoading && (
        <div className="flex gap-3 overflow-x-hidden pb-2 -mx-5 px-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]">
              <div className="w-[68px] h-[88px] rounded-xl bg-zinc-800 animate-pulse" />
              <div className="w-12 h-2.5 rounded bg-zinc-800 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Gallery */}
      {!colLoading && showGallery && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
          {filteredCollection.map(g => (
            <GameGalleryItem key={g.id} game={g} selected={game?.id === g.id} inCollection onClick={() => toggle(g)} />
          ))}
          {catalogOnly.map(g => (
            <GameGalleryItem key={g.id} game={g} selected={game?.id === g.id} inCollection={false} onClick={() => toggle(g)} />
          ))}
          {catalogFetching && (
            <div className="flex items-end pb-7 shrink-0 px-2 text-zinc-600">
              <Spinner className="w-5 h-5" />
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <p className="text-xs text-zinc-500 text-center py-2">
          Aucun jeu trouvé pour « {query} »
        </p>
      )}

      {/* No collection, no query */}
      {!colLoading && collectionGames.length === 0 && !query && (
        <p className="text-xs text-zinc-500 text-center py-2">
          Ta collection est vide · recherche un jeu ci-dessus
        </p>
      )}
    </div>
  )
}

// ── Win rule section ───────────────────────────────────────────────────────────

const WIN_RULES = [
  {
    value: 'highest_score',
    label: 'Plus grand score',
    desc: 'Le plus élevé gagne',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    value: 'lowest_score',
    label: 'Plus petit score',
    desc: 'Le plus bas gagne',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.306-4.307a11.95 11.95 0 015.814 5.519l2.74 1.22m0 0l-5.94 2.28m5.94-2.28l-2.28-5.941" />
      </svg>
    ),
  },
]

function WinRuleSection({ winRule, setWinRule }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {WIN_RULES.map(opt => {
        const active = winRule === opt.value
        return (
          <button key={opt.value} type="button" onClick={() => setWinRule(opt.value)}
            className={`flex flex-col gap-2.5 p-4 rounded-2xl border-2 text-left transition-all ${
              active ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
            }`}>
            <span className={active ? 'text-amber-400' : 'text-zinc-500'}>{opt.icon}</span>
            <div>
              <p className={`text-sm font-bold ${active ? 'text-amber-400' : 'text-zinc-300'}`}>{opt.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
            </div>
            {active && (
              <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center ml-auto -mt-1">
                <svg className="w-3 h-3 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Players section ────────────────────────────────────────────────────────────

function PlayerGalleryItem({ player, added, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center gap-1.5 shrink-0 w-16 transition-all ${
        added ? 'opacity-100 scale-[1.03]' : 'opacity-55 hover:opacity-85'
      }`}>
      <div className="relative">
        <div className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${
          added ? 'border-amber-400 shadow-md shadow-amber-400/30' : 'border-transparent'
        }`}>
          {player.avatar_url
            ? <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
            : (
              <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-200">
                {getInitials(player.username)}
              </div>
            )
          }
        </div>
        {added && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
            <svg className="w-3 h-3 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        )}
      </div>
      <p className={`text-[11px] font-medium text-center leading-tight line-clamp-2 w-full px-0.5 ${
        added ? 'text-amber-400' : 'text-zinc-400'
      }`}>
        {player.username}
      </p>
    </button>
  )
}

function PlayersSection({ game, participants, toggleParticipant, removeParticipant, teams }) {
  const { data: allUsers, isLoading: usersLoading } = useAllUsers()
  const [query, setQuery] = useState('')

  const q = query.toLowerCase()
  const allPlayers = [
    ...(allUsers?.users ?? []).map(u => ({ ...u, playerType: 'user' })),
    ...(allUsers?.provisioned ?? []).map(p => ({ ...p, playerType: 'provisioned' })),
  ]

  const filteredPlayers = q
    ? allPlayers.filter(p => p.username.toLowerCase().includes(q))
    : allPlayers

  const addedIds = new Set(participants.map(p => `${p.type}:${p.id}`))
  const isEmpty = query && !usersLoading && filteredPlayers.length === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionLabel>
          Joueurs
          {participants.length > 0 && (
            <span className="ml-2 text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-normal normal-case tracking-normal">
              {participants.length}
            </span>
          )}
        </SectionLabel>
        {game?.max_players && participants.length > game.max_players && (
          <span className="text-xs text-amber-400 font-medium">⚠ Max {game.max_players}</span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Rechercher un joueur…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')}
            className="absolute inset-y-0 right-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Skeleton */}
      {usersLoading && (
        <div className="flex gap-4 -mx-5 px-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
              <div className="w-12 h-12 rounded-full bg-zinc-800 animate-pulse" />
              <div className="w-10 h-2.5 rounded bg-zinc-800 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Gallery */}
      {!usersLoading && filteredPlayers.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
          {filteredPlayers.map(p => (
            <PlayerGalleryItem
              key={`${p.playerType}:${p.id}`}
              player={p}
              added={addedIds.has(`${p.playerType}:${p.id}`)}
              onClick={() => toggleParticipant(p.playerType, p.id, p.username, p.avatar_url)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <p className="text-xs text-zinc-500 text-center py-2">
          Aucun joueur trouvé pour « {query} » ·{' '}
          <span className="text-amber-400">Créez un profil dans l'administration</span>
        </p>
      )}

      {/* Selected players list */}
      {participants.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          {participants.map((p, i) => {
            const teamName = p.teamLocalId
              ? (teams.find(t => t.localId === p.teamLocalId)?.name || 'équipe')
              : null
            return (
              <div key={p.localId}
                className={`flex items-center gap-3 px-4 py-2.5 ${i < participants.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
                <PlayerAvatar name={p.name} url={p.avatarUrl} />
                <span className="flex-1 text-sm font-medium text-zinc-200 truncate">{p.name}</span>
                {teamName && (
                  <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full truncate max-w-24 shrink-0">
                    {teamName}
                  </span>
                )}
                {p.type === 'provisioned' && !teamName && (
                  <span className="text-xs text-zinc-600 shrink-0">profil</span>
                )}
                <button type="button" onClick={() => removeParticipant(p.localId)}
                  className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 ml-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Teams section ─────────────────────────────────────────────────────────────

function TeamsSection({ participants, teams, setTeams, setParticipants }) {
  const [open, setOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)

  function saveTeam() {
    if (!editingTeam || editingTeam.memberLocalIds.length < 2) return
    const team = editingTeam
    setTeams(prev => {
      const existing = prev.find(t => t.localId === team.localId)
      if (existing) return prev.map(t => t.localId === team.localId ? team : t)
      return [...prev, team]
    })
    setParticipants(prev => prev.map(p =>
      team.memberLocalIds.includes(p.localId) ? { ...p, teamLocalId: team.localId }
        : p.teamLocalId === team.localId && !team.memberLocalIds.includes(p.localId) ? { ...p, teamLocalId: null }
        : p
    ))
    setEditingTeam(null)
  }

  function removeTeam(localId) {
    setTeams(prev => prev.filter(t => t.localId !== localId))
    setParticipants(prev => prev.map(p => p.teamLocalId === localId ? { ...p, teamLocalId: null } : p))
  }

  if (participants.length < 2) return null

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-1">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <span className="font-medium">Équipes</span>
          {teams.length > 0 && (
            <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">{teams.length}</span>
          )}
          <span className="text-xs text-zinc-700">(optionnel)</span>
        </div>
        <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          {teams.map(team => {
            const members = participants.filter(p => p.teamLocalId === team.localId)
            return (
              <div key={team.localId} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200">{team.name || 'Équipe'}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{members.map(m => m.name).join(', ')}</p>
                </div>
                <button type="button" onClick={() => removeTeam(team.localId)}
                  className="text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}

          {editingTeam ? (
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 flex flex-col gap-3">
              <input type="text"
                placeholder="Nom de l'équipe (optionnel)"
                value={editingTeam.name}
                onChange={e => setEditingTeam(t => ({ ...t, name: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Membres</p>
                <div className="flex flex-wrap gap-2">
                  {participants.map(p => {
                    const inThis = editingTeam.memberLocalIds.includes(p.localId)
                    const inOther = p.teamLocalId && p.teamLocalId !== editingTeam.localId
                    if (inOther) return null
                    return (
                      <button key={p.localId} type="button"
                        onClick={() => setEditingTeam(t => ({
                          ...t,
                          memberLocalIds: inThis
                            ? t.memberLocalIds.filter(id => id !== p.localId)
                            : [...t.memberLocalIds, p.localId],
                        }))}
                        className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          inThis
                            ? 'bg-amber-400 text-zinc-950 border-amber-400'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                        }`}>
                        <PlayerAvatar name={p.name} url={p.avatarUrl} />
                        {p.name}
                      </button>
                    )
                  })}
                </div>
                {editingTeam.memberLocalIds.length < 2 && (
                  <p className="text-xs text-zinc-600">Sélectionne au moins 2 membres</p>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setEditingTeam(null)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                  Annuler
                </button>
                <button type="button" onClick={saveTeam}
                  disabled={editingTeam.memberLocalIds.length < 2}
                  className="px-4 py-2 text-sm bg-amber-400 text-zinc-950 rounded-xl font-bold hover:bg-amber-300 disabled:opacity-40 transition-all">
                  Créer l'équipe
                </button>
              </div>
            </div>
          ) : (
            <button type="button"
              onClick={() => setEditingTeam({ localId: crypto.randomUUID(), name: '', memberLocalIds: [] })}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-zinc-700 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouvelle équipe
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Championship section ──────────────────────────────────────────────────────

function ChampionshipSection({ championshipId, setChampionshipId }) {
  const { data: championships } = useMyActiveChampionships()

  if (!championships?.length) return null

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Championnat (optionnel)</SectionLabel>
      {championships.map(c => {
        const selected = championshipId === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setChampionshipId(prev => prev === c.id ? null : c.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
              selected
                ? 'border-amber-400 bg-amber-400/10'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              selected ? 'bg-amber-400/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'
            }`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5M7.5 18.75v-4.5M3 5.25h18M5.25 5.25v7.5a6.75 6.75 0 0013.5 0v-7.5" />
              </svg>
            </div>
            <span className={`flex-1 text-sm font-medium truncate ${selected ? 'text-amber-400' : 'text-zinc-200'}`}>
              {c.name}
            </span>
            {selected && (
              <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function NewPlayModal({ open, onClose, defaultChampionshipId = null }) {
  const toast = useToast()
  const createPlay = useCreatePlay()
  const { notifyPlayStarted } = useActivePlayCtx()

  const [game, setGame] = useState(null)
  const [winRule, setWinRule] = useState('highest_score')
  const [participants, setParticipants] = useState([])
  const [teams, setTeams] = useState([])
  const [championshipId, setChampionshipId] = useState(null)

  useEffect(() => {
    if (open) setChampionshipId(defaultChampionshipId)
  }, [open, defaultChampionshipId])

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  function reset() {
    setGame(null)
    setWinRule('highest_score')
    setParticipants([])
    setTeams([])
    setChampionshipId(null)
  }

  function handleClose() { reset(); onClose() }

  function toggleParticipant(type, id, name, avatarUrl) {
    const existing = participants.find(p => p.type === type && p.id === id)
    if (existing) {
      removeParticipant(existing.localId)
    } else {
      setParticipants(prev => [...prev, {
        localId: crypto.randomUUID(),
        type,
        id,
        name,
        avatarUrl: avatarUrl ?? null,
        teamLocalId: null,
      }])
    }
  }

  function removeParticipant(localId) {
    setParticipants(prev => prev.filter(p => p.localId !== localId))
    setTeams(prev => prev.map(t => ({
      ...t,
      memberLocalIds: t.memberLocalIds.filter(id => id !== localId),
    })))
  }

  async function handleStart() {
    if (!game || participants.length === 0) return
    try {
      const play = await createPlay.mutateAsync({
        gameId: game.id,
        winRule,
        championshipId,
        participants,
        teams,
      })
      notifyPlayStarted({ ...play, game })
      toast.success(`Partie de ${game.title} démarrée !`)
      handleClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (!open) return null

  const canStart = !!game && participants.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full sm:max-w-md flex flex-col bg-zinc-950 rounded-t-3xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl max-h-[92dvh]">

        {/* Handle (mobile) */}
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Nouvelle partie</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Choisis un jeu et tes joueurs</p>
          </div>
          <button type="button" onClick={handleClose}
            className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 flex flex-col gap-7">

          <section className="flex flex-col gap-3">
            <SectionLabel>Jeu</SectionLabel>
            <GameSection game={game} setGame={setGame} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Règle de victoire</SectionLabel>
            <WinRuleSection winRule={winRule} setWinRule={setWinRule} />
          </section>

          <PlayersSection
            game={game}
            participants={participants}
            toggleParticipant={toggleParticipant}
            removeParticipant={removeParticipant}
            teams={teams}
          />

          <TeamsSection
            participants={participants}
            teams={teams}
            setTeams={setTeams}
            setParticipants={setParticipants}
          />

          <ChampionshipSection
            championshipId={championshipId}
            setChampionshipId={setChampionshipId}
          />

          <div className="h-1" />
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-4 border-t border-zinc-800/80 shrink-0">
          {!canStart && (
            <p className="text-xs text-zinc-600 text-center mb-3">
              {!game
                ? 'Sélectionne un jeu pour continuer'
                : participants.length === 0
                  ? 'Ajoute au moins un joueur'
                  : ''}
            </p>
          )}
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart || createPlay.isPending}
            className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-base transition-all ${
              canStart && !createPlay.isPending
                ? 'bg-amber-400 text-zinc-950 hover:bg-amber-300 shadow-lg shadow-amber-400/20 active:scale-[0.98]'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {createPlay.isPending ? (
              <>
                <Spinner className="w-5 h-5" />
                Démarrage…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5.14v14l11-7-11-7z" />
                </svg>
                Démarrer la partie
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
