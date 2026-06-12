import { Badge } from '../ui/Badge'

function CoverPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    </div>
  )
}

function StarRow({ rating }) {
  if (!rating) return null
  return (
    <span className="text-xs text-amber-400 leading-none">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function MetaChip({ children }) {
  return <span className="text-xs text-zinc-500">{children}</span>
}

export function GameCard({ entry, onClick, playCount }) {
  const { game, status, rating } = entry

  const players =
    game.min_players && game.max_players
      ? game.min_players === game.max_players
        ? `${game.min_players} joueurs`
        : `${game.min_players}–${game.max_players} joueurs`
      : null

  const duration =
    game.min_duration_min && game.max_duration_min
      ? game.min_duration_min === game.max_duration_min
        ? `${game.min_duration_min} min`
        : `${game.min_duration_min}–${game.max_duration_min} min`
      : null

  return (
    <button
      onClick={() => onClick(entry)}
      className="group flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-colors text-left w-full"
    >
      <div className="aspect-square relative overflow-hidden">
        {game.cover_url ? (
          <img
            src={game.cover_url}
            alt={game.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <CoverPlaceholder />
        )}
      </div>

      <div className="p-3 flex flex-col gap-2">
        <p className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-tight min-h-[2.5rem]">
          {game.title}
          {game.year_published && (
            <span className="font-normal text-zinc-500"> ({game.year_published})</span>
          )}
        </p>

        <div className="flex items-center justify-between gap-1">
          <Badge status={status} />
          <StarRow rating={rating} />
        </div>

        {(players || duration || playCount > 0) && (
          <div className="flex gap-2 flex-wrap">
            {players && <MetaChip>{players}</MetaChip>}
            {duration && <MetaChip>{duration}</MetaChip>}
            {playCount > 0 && <MetaChip>📊 {playCount}</MetaChip>}
          </div>
        )}
      </div>
    </button>
  )
}
