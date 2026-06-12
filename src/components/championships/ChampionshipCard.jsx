import { useNavigate } from 'react-router-dom'

const statusConfig = {
  draft:   { label: 'En préparation', cls: 'bg-zinc-700 text-zinc-300' },
  active:  { label: 'En cours',       cls: 'bg-emerald-900/60 text-emerald-400' },
  closed:  { label: 'Terminé',        cls: 'bg-zinc-800 text-zinc-500' },
}

export function ChampionshipCard({ championship }) {
  const navigate = useNavigate()
  const { status, name, championship_players, championship_games } = championship

  const cfg = statusConfig[status] ?? statusConfig.draft
  const playerCount = championship_players?.length ?? 0
  const approvedGames = championship_games?.filter(g => g.status === 'approved').length ?? 0
  const pendingGames = championship_games?.filter(g => g.status === 'suggested').length ?? 0

  return (
    <button
      onClick={() => navigate(`/championships/${championship.id}`)}
      className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-600 transition-colors flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-100 truncate">{name}</p>
          {(championship.starts_at || championship.ends_at) && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {[championship.starts_at, championship.ends_at].filter(Boolean)
                .map(d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }))
                .join(' → ')}
            </p>
          )}
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex gap-4 text-xs text-zinc-500">
        <span>{playerCount} joueur{playerCount !== 1 ? 's' : ''}</span>
        <span>{approvedGames} jeu{approvedGames !== 1 ? 'x' : ''} approuvé{approvedGames !== 1 ? 's' : ''}</span>
        {pendingGames > 0 && (
          <span className="text-amber-400">{pendingGames} en attente</span>
        )}
      </div>

      {status === 'draft' && (
        <p className="text-xs text-amber-400">Continuer la configuration →</p>
      )}
    </button>
  )
}
