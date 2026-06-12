import { useMemo, useState } from 'react'
import { usePlayDetails, useUpdatePlay, calcWinners } from '../../hooks/usePlays'
import { Spinner } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function ScoreInput({ label, avatarUrl, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-zinc-700 shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold text-zinc-200">
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          : getInitials(label)
        }
      </div>
      <span className="flex-1 text-sm text-zinc-200 truncate">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-24 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-right font-mono text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
      />
    </div>
  )
}

export function EditPlayModal({ play, onClose }) {
  const toast = useToast()
  const { data: details, isLoading } = usePlayDetails(play?.id)
  const updatePlay = useUpdatePlay()

  const hasTeams = (details?.play_teams?.length ?? 0) > 0
  const entities = useMemo(() => {
    if (!details) return []
    return hasTeams
      ? details.play_teams ?? []
      : (details.play_participants ?? []).filter(p => !p.play_team_id)
  }, [details, hasTeams])

  const [scores, setScores] = useState(null)
  const [comment, setComment] = useState(null)

  // Initialize scores from details once loaded
  if (details && scores === null) {
    const init = {}
    entities.forEach(e => { init[e.id] = e.score !== null && e.score !== undefined ? String(e.score) : '' })
    setScores(init)
    setComment(details.comment ?? '')
  }

  function getLabel(e) {
    if (hasTeams) {
      const members = details?.play_participants?.filter(p => p.play_team_id === e.id) ?? []
      return e.name ? `${e.name} (${members.map(m => m.displayName).join(', ')})` : members.map(m => m.displayName).join(', ') || 'Équipe'
    }
    return e.displayName ?? '?'
  }

  const standings = useMemo(() => {
    if (!details || !scores) return []
    const arr = entities.map(e => ({ ...e, score: scores[e.id] !== '' && scores[e.id] !== undefined ? Number(scores[e.id]) : null }))
    return calcWinners(arr, details.win_rule).sort((a, b) =>
      details.win_rule === 'lowest_score' ? (a.score ?? Infinity) - (b.score ?? Infinity) : (b.score ?? -Infinity) - (a.score ?? -Infinity)
    )
  }, [entities, scores, details])

  async function handleSave() {
    if (!details) return
    try {
      const participantScores = hasTeams
        ? (details.play_participants ?? []).map(p => ({ id: p.id, score: null }))
        : entities.map(e => ({ id: e.id, score: scores?.[e.id] }))
      const teamScores = hasTeams
        ? entities.map(e => ({ id: e.id, score: scores?.[e.id] }))
        : []
      await updatePlay.mutateAsync({ playId: details.id, participantScores, teamScores, comment })
      toast.success('Partie mise à jour')
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (!play) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col">
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Modifier la partie</h2>
            {details?.game?.title && (
              <p className="text-xs text-zinc-500 mt-0.5">{details.game.title}</p>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 p-1 rounded-md hover:bg-zinc-800 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading || scores === null ? (
          <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div>
        ) : (
          <div className="overflow-y-auto p-5 flex flex-col gap-5 flex-1">
            {/* Rule indicator */}
            <p className="text-xs text-zinc-500">
              Règle : {details.win_rule === 'highest_score' ? 'Plus grand score gagne' : 'Plus petit score gagne'}
            </p>

            {/* Score inputs */}
            <div className="flex flex-col gap-3">
              {entities.map(e => (
                <ScoreInput
                  key={e.id}
                  label={getLabel(e)}
                  avatarUrl={!hasTeams ? (e.avatarUrl ?? null) : null}
                  value={scores?.[e.id]}
                  onChange={v => setScores(prev => ({ ...prev, [e.id]: v }))}
                />
              ))}
            </div>

            {/* Live standings preview */}
            {standings.some(e => e.score !== null) && (
              <div className="bg-zinc-800 rounded-2xl p-3 flex flex-col gap-2">
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1">Classement</p>
                {standings.map((e, idx) => (
                  <div key={e.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-5 text-xs font-bold shrink-0 ${idx === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                      {idx === 0 ? '🏆' : `${idx + 1}`}
                    </span>
                    <span className={`flex-1 truncate ${e.is_winner ? 'text-amber-400 font-semibold' : 'text-zinc-300'}`}>
                      {getLabel(e)}
                    </span>
                    <span className={`tabular-nums font-bold ${e.is_winner ? 'text-amber-400' : 'text-zinc-400'}`}>
                      {e.score ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Comment */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Commentaire</label>
              <textarea
                value={comment ?? ''}
                onChange={e => setComment(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Notes sur la partie…"
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
              <Button onClick={handleSave} disabled={updatePlay.isPending} className="flex-1">
                {updatePlay.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
