import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyPlays, useDeletePlay } from '../../hooks/usePlays'
import { useActivePlayCtx } from '../../context/ActivePlayContext'
import { PlayCard } from '../../components/plays/PlayCard'
import { NewPlayModal } from '../../components/plays/NewPlayModal'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupByMonth(plays) {
  const groups = []
  const seen = new Map()
  for (const play of plays) {
    const d = new Date(play.started_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!seen.has(key)) {
      const arr = []
      seen.set(key, arr)
      groups.push({ key, label, plays: arr })
    }
    seen.get(key).push(play)
  }
  return groups
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function Tabs({ active, onChange, hasActivePlay, historyCount }) {
  return (
    <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1">
      <button
        type="button"
        onClick={() => onChange('active')}
        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
          active === 'active'
            ? 'bg-zinc-700 text-zinc-100 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        En cours
        {hasActivePlay && (
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onChange('history')}
        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
          active === 'history'
            ? 'bg-zinc-700 text-zinc-100 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        Historique
        {historyCount > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
            active === 'history'
              ? 'bg-zinc-600 text-zinc-300'
              : 'bg-zinc-700 text-zinc-500'
          }`}>
            {historyCount}
          </span>
        )}
      </button>
    </div>
  )
}

// ── Active tab ─────────────────────────────────────────────────────────────────

function ActiveTab({ activePlay, onNewPlay }) {
  const navigate = useNavigate()

  if (!activePlay) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-2xl opacity-50">
          🎲
        </div>
        <div className="text-center">
          <p className="text-zinc-300 font-medium mb-1">Aucune partie en cours</p>
          <p className="text-sm text-zinc-500">Lance une nouvelle partie pour commencer</p>
        </div>
        <button
          type="button"
          onClick={onNewPlay}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-zinc-950 rounded-xl font-semibold text-sm hover:bg-amber-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle partie
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => navigate('/play/active')}
      className="w-full flex items-center gap-4 bg-amber-400/10 border border-amber-400/40 rounded-2xl px-4 py-4 hover:bg-amber-400/15 transition-colors text-left"
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
        {activePlay.game?.cover_url
          ? <img src={activePlay.game.cover_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xl">🎲</div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-400 mb-0.5">Partie en cours</p>
        <p className="text-base font-bold text-zinc-100 truncate">{activePlay.game?.title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Démarrée le {formatDate(activePlay.started_at)}
        </p>
      </div>
      <span className="bg-amber-400 text-zinc-950 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0">
        Scores →
      </span>
    </button>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ plays, isLoading, onDelete }) {
  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
  }

  if (!plays?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
        <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">Aucune partie enregistrée</p>
      </div>
    )
  }

  const groups = groupByMonth(plays)

  return (
    <div className="flex flex-col gap-5">
      {groups.map(group => (
        <div key={group.key} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide capitalize">
              {group.label}
            </span>
            <span className="text-xs text-zinc-600">
              {group.plays.length} partie{group.plays.length !== 1 ? 's' : ''}
            </span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          {group.plays.map(play => (
            <PlayCard key={play.id} play={play} onDelete={onDelete} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlaysPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { activePlay } = useActivePlayCtx()
  const { data, isLoading } = useMyPlays()
  const deletePlay = useDeletePlay()

  const [tab, setTab] = useState(activePlay ? 'active' : 'history')
  const [newOpen, setNewOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function handleDelete(id) {
    try {
      await deletePlay.mutateAsync(id)
      toast.success('Partie supprimée')
      setConfirmDelete(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  function handleNewPlay() {
    if (activePlay) {
      navigate('/play/active')
    } else {
      setNewOpen(true)
    }
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Parties</h1>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        hasActivePlay={!!activePlay}
        historyCount={data?.length ?? 0}
      />

      {tab === 'active' && (
        <ActiveTab activePlay={activePlay} onNewPlay={() => setNewOpen(true)} />
      )}

      {tab === 'history' && (
        <HistoryTab plays={data} isLoading={isLoading} onDelete={id => setConfirmDelete(id)} />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4">
            <p className="text-zinc-100 text-sm">Supprimer cette partie ? Cette action est irréversible.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100">
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deletePlay.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
              >
                {deletePlay.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={handleNewPlay}
        aria-label="Nouvelle partie"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 rounded-full bg-amber-400 text-zinc-950 shadow-lg hover:bg-amber-300 transition-colors flex items-center justify-center z-30"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      <NewPlayModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}
