import { useNavigate, useLocation } from 'react-router-dom'
import { useActivePlayCtx } from '../../context/ActivePlayContext'

function formatElapsed(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ActivePlayBanner() {
  const { activePlay, elapsed } = useActivePlayCtx()
  const navigate = useNavigate()
  const location = useLocation()

  if (!activePlay) return null
  if (location.pathname === '/play/active') return null

  return (
    <button
      type="button"
      onClick={() => navigate('/play/active')}
      className="w-full bg-amber-400 text-zinc-950 px-4 py-2.5 flex items-center gap-3 hover:bg-amber-300 transition-colors shrink-0 text-left"
    >
      <span className="text-lg shrink-0">🎲</span>
      <span className="font-semibold text-sm truncate flex-1">
        {activePlay.game?.title ?? 'Partie en cours'}
      </span>
      <span className="font-mono text-sm shrink-0 tabular-nums">
        {formatElapsed(elapsed)}
      </span>
      <span className="text-xs font-bold bg-zinc-950/20 px-2.5 py-1 rounded-lg shrink-0">
        Scores →
      </span>
    </button>
  )
}
