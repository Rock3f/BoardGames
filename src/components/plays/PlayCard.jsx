import { Badge } from '../ui/Badge'

function formatDuration(min) {
  if (!min) return null
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function PlayCard({ play, onDelete }) {
  const participants = play.play_participants ?? []
  const teams = play.play_teams ?? []

  const winners = participants.filter(p => p.is_winner && !p.play_team_id)
    .concat(teams.filter(t => t.is_winner))

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
          {play.game?.cover_url
            ? <img src={play.game.cover_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-zinc-600">🎲</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 truncate">{play.game?.title ?? '—'}</p>
          <p className="text-xs text-zinc-500">
            {formatDate(play.started_at)}
            {play.duration_min && ` · ${formatDuration(play.duration_min)}`}
          </p>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(play.id)}
            className="text-zinc-600 hover:text-red-400 transition-colors p-1"
            title="Supprimer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Participants */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {participants.filter(p => !p.play_team_id).map(p => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className={p.is_winner ? 'text-amber-400 font-medium' : 'text-zinc-400'}>
              {p.is_winner && '🏆 '}{p.displayName}
              {p.type === 'guest' && <span className="text-zinc-600 text-xs"> (invité)</span>}
            </span>
            <span className="text-zinc-400 tabular-nums">
              {p.score !== null ? p.score : '—'}
            </span>
          </div>
        ))}

        {teams.map(team => {
          const members = participants.filter(p => p.play_team_id === team.id)
          return (
            <div key={team.id} className="flex items-center justify-between text-sm">
              <span className={team.is_winner ? 'text-amber-400 font-medium' : 'text-zinc-400'}>
                {team.is_winner && '🏆 '}
                {team.name || 'Équipe'} ({members.map(m => m.displayName).join(', ')})
              </span>
              <span className="text-zinc-400 tabular-nums">{team.score !== null ? team.score : '—'}</span>
            </div>
          )
        })}

        {play.comment && (
          <p className="text-xs text-zinc-500 italic mt-1">« {play.comment} »</p>
        )}
      </div>
    </div>
  )
}
