import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useChampionship,
  useChampionshipStandings,
  useChampionshipAvailableGames,
  useTransitionChampionship,
  useAddChampionshipPlayer,
  useRemoveChampionshipPlayer,
  useSuggestGame,
  useManageGame,
} from '../../hooks/useChampionships'
import { usePlayerSearch } from '../../hooks/usePlayers'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../context/AuthContext'
import { NewPlayModal } from '../../components/plays/NewPlayModal'

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const TABS = ['Classement', 'Jeux', 'Règles']

// ─── Standings tab ────────────────────────────────────────────────────────────

function StandingsTab({ championship }) {
  const { data: standings, isLoading } = useChampionshipStandings(championship.id)

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

function GamesTab({ championship }) {
  const toast = useToast()
  const { session } = useAuth()
  const suggestGame = useSuggestGame()
  const manageGame = useManageGame()
  const isOwner = championship.created_by === session?.user?.id
  const existingGames = championship.championship_games ?? []
  const suggestedIds = new Set(existingGames.map(g => g.catalog_game_id))

  const { data: availableGames, isLoading: gamesLoading } = useChampionshipAvailableGames(championship)
  const [query, setQuery] = useState('')

  const filteredAvailable = (query
    ? (availableGames ?? []).filter(g => g.title.toLowerCase().includes(query.toLowerCase()))
    : (availableGames ?? [])
  ).filter(g => !suggestedIds.has(g.id))

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

  const hasParticipants = (championship.championship_players ?? []).some(p => p.user_id)

  return (
    <div className="flex flex-col gap-5">
      {championship.status !== 'closed' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Suggérer un jeu
          </p>

          {!hasParticipants && (
            <p className="text-sm text-zinc-500 py-4 text-center">
              Ajoutez des participants pour pouvoir suggérer des jeux.
            </p>
          )}

          {hasParticipants && (
            <>
              {/* Filter input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filtrer les jeux des participants…"
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

              {/* Available games gallery */}
              {gamesLoading && (
                <div className="flex gap-3 overflow-x-hidden pb-2 -mx-4 px-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]">
                      <div className="w-[68px] h-[88px] rounded-xl bg-zinc-800 animate-pulse" />
                      <div className="w-12 h-2.5 rounded bg-zinc-800 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {!gamesLoading && filteredAvailable.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
                  {filteredAvailable.map(game => (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => handleSuggest(game)}
                      disabled={suggestGame.isPending}
                      className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] opacity-80 hover:opacity-100 hover:scale-[1.03] transition-all"
                    >
                      <div className="w-[68px] h-[88px] rounded-xl overflow-hidden border-2 border-transparent hover:border-amber-400/60 bg-zinc-800">
                        {game.cover_url
                          ? <img src={game.cover_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-2xl">🎲</div>
                        }
                      </div>
                      <p className="text-[11px] font-medium text-center leading-tight line-clamp-2 w-full px-0.5 text-zinc-400">
                        {game.title}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {!gamesLoading && filteredAvailable.length === 0 && (availableGames ?? []).length > 0 && query && (
                <p className="text-sm text-zinc-500 text-center py-4">
                  Aucun jeu pour « {query} »
                </p>
              )}

              {!gamesLoading && (availableGames ?? []).length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-4">
                  Aucun jeu dans les collections des participants.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Already suggested / approved / rejected */}
      {existingGames.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Jeux du championnat ({existingGames.length})
          </p>
          {existingGames.map(cg => {
            const cfg = gameStatusConfig[cg.status] ?? gameStatusConfig.suggested
            return (
              <div key={cg.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                  {cg.game?.cover_url
                    ? <img src={cg.game.cover_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">🎲</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{cg.game?.title ?? '—'}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                {isOwner && cg.status === 'suggested' && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleStatus(cg.id, championship.id, 'approved')}
                      className="w-7 h-7 flex items-center justify-center text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                      title="Approuver"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleStatus(cg.id, championship.id, 'rejected')}
                      className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
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
      )}

      {existingGames.length === 0 && championship.status === 'closed' && (
        <p className="text-sm text-zinc-500 text-center py-8">Aucun jeu enregistré.</p>
      )}
    </div>
  )
}

// ─── Rules tab ────────────────────────────────────────────────────────────────

function ScoringDisplay({ scoring }) {
  if (!scoring) return null
  const mode = scoring.mode ?? 'by_result'
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        Grille de points ({mode === 'by_result' ? 'par résultat' : 'par classement'})
      </p>
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

  async function handleTransition(newStatus) {
    try {
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
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
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
        {tab === 'Classement' && <StandingsTab championship={championship} />}
        {tab === 'Jeux' && <GamesTab championship={championship} />}
        {tab === 'Règles' && <RulesTab championship={championship} />}
      </div>

      {/* New play modal pre-linked to this championship */}
      <NewPlayModal
        open={startPlayOpen}
        onClose={() => setStartPlayOpen(false)}
        defaultChampionshipId={championship.id}
      />
    </div>
  )
}
