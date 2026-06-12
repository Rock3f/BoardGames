import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { usePlayDetails, useSaveScores, calcWinners } from '../../hooks/usePlays'
import { useActivePlayCtx } from '../../context/ActivePlayContext'
import { useToast } from '../../components/ui/Toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function sumRounds(rounds, entityId) {
  return rounds.reduce((sum, r) => {
    const v = r.scores?.[entityId]
    return sum + (v !== '' && v !== undefined && v !== null ? Number(v) : 0)
  }, 0)
}

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Standings ─────────────────────────────────────────────────────────────────

function Standings({ standings, play, getLabel }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Classement</p>
        <p className="text-xs text-zinc-600">
          {play?.win_rule === 'highest_score' ? 'Plus grand score gagne' : 'Plus petit score gagne'}
        </p>
      </div>
      <div className="divide-y divide-zinc-800/60">
        {standings.map((e, idx) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`text-xs w-5 shrink-0 tabular-nums font-bold ${
              idx === 0 ? 'text-amber-400' : 'text-zinc-600'
            }`}>
              {idx === 0 ? '🏆' : `${idx + 1}`}
            </span>
            <span className={`flex-1 text-sm truncate ${e.is_winner ? 'font-semibold text-amber-400' : 'text-zinc-200'}`}>
              {getLabel(e)}
            </span>
            <span className={`text-sm font-mono tabular-nums font-bold ${e.is_winner ? 'text-amber-400' : 'text-zinc-400'}`}>
              {e.score}
            </span>
          </div>
        ))}
        {standings.length === 0 && (
          <p className="px-4 py-4 text-sm text-zinc-600 text-center">Aucun participant</p>
        )}
      </div>
    </div>
  )
}

// ── Score stepper row ─────────────────────────────────────────────────────────

function ScoreRow({ entity, value, onChange, shortLabel, avatarUrl, step }) {
  const num = value !== '' && value !== undefined && value !== null && !isNaN(Number(value))
    ? Number(value) : 0

  return (
    <div className="flex items-center gap-3 py-1">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-zinc-700 shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold text-zinc-200">
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          : getInitials(shortLabel)
        }
      </div>

      {/* Name */}
      <span className="flex-1 text-sm font-medium text-zinc-100 truncate min-w-0">
        {shortLabel}
      </span>

      {/* Stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onChange(String(num - step))}
          className="w-11 h-11 rounded-2xl bg-zinc-800 active:bg-zinc-700 active:scale-95 flex items-center justify-center text-zinc-300 text-xl font-bold transition-all select-none touch-manipulation"
          aria-label={`Enlever ${step}`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="w-[4.5rem] h-11 rounded-2xl border border-zinc-700 bg-zinc-900 text-center text-lg font-bold text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
        />
        <button
          type="button"
          onClick={() => onChange(String(num + step))}
          className="w-11 h-11 rounded-2xl bg-zinc-800 active:bg-zinc-700 active:scale-95 flex items-center justify-center text-zinc-300 text-xl font-bold transition-all select-none touch-manipulation"
          aria-label={`Ajouter ${step}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Current round card ────────────────────────────────────────────────────────

const STEPS = [1, 5, 10]

function CurrentRoundCard({ round, roundIdx, entities, getShortLabel, getAvatarUrl, onChange, onRemove, totalRounds }) {
  const [step, setStep] = useState(1)

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-amber-400/15">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-bold text-amber-400">Tour {roundIdx + 1}</p>
          <span className="text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
            en cours
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Step selector */}
          <div className="flex rounded-xl overflow-hidden border border-zinc-700">
            {STEPS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors select-none ${
                  step === s
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                ×{s}
              </button>
            ))}
          </div>
          {totalRounds > 1 && (
            <button
              type="button"
              onClick={() => onRemove(roundIdx)}
              className="text-zinc-700 hover:text-red-400 transition-colors p-1 rounded-lg"
              title="Supprimer ce tour"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Score rows */}
      <div className="px-4 pt-3 pb-4 flex flex-col gap-0.5">
        {entities.map(e => (
          <ScoreRow
            key={e.id}
            entity={e}
            value={round.scores?.[e.id] ?? ''}
            onChange={v => onChange(roundIdx, e.id, v)}
            shortLabel={getShortLabel(e)}
            avatarUrl={getAvatarUrl(e)}
            step={step}
          />
        ))}
      </div>
    </div>
  )
}

// ── Past rounds (compact, read-only) ─────────────────────────────────────────

function PastRoundsSection({ rounds, entities, getShortLabel, onRemove }) {
  const [open, setOpen] = useState(false)
  const pastRounds = rounds.slice(0, rounds.length - 1)
  if (pastRounds.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
      >
        <span className="font-semibold uppercase tracking-wide">
          Historique des tours ({pastRounds.length})
        </span>
        <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {[...pastRounds.keys()].reverse().map(idx => {
            const round = pastRounds[idx]
            return (
              <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    Tour {idx + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="text-zinc-700 hover:text-red-400 transition-colors p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
                  {entities.map(e => (
                    <span key={e.id} className="text-sm">
                      <span className="text-zinc-500 text-xs">{getShortLabel(e)} </span>
                      <span className="tabular-nums font-semibold text-zinc-300">
                        {round.scores?.[e.id] ?? '—'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActivePlayPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { activePlay, elapsed, clearActivePlay } = useActivePlayCtx()
  const { data: play, isLoading } = usePlayDetails(activePlay?.id)
  const saveScores = useSaveScores()

  const [rounds, setRounds] = useState(null)
  const [comment, setComment] = useState('')
  const [confirmEnd, setConfirmEnd] = useState(false)

  useEffect(() => {
    if (!activePlay) navigate('/plays', { replace: true })
  }, [activePlay])

  useEffect(() => {
    if (!play || rounds !== null) return
    const dbRounds = (play.rounds ?? []).map(r => ({ scores: r.scores ?? {} }))
    setRounds(dbRounds.length > 0 ? dbRounds : [{ scores: {} }])
    setComment(play.comment ?? '')
  }, [play?.id])

  const hasTeams = (play?.play_teams?.length ?? 0) > 0
  const entities = useMemo(() => {
    if (!play) return []
    return hasTeams
      ? (play.play_teams ?? [])
      : (play.play_participants ?? []).filter(p => !p.play_team_id)
  }, [play, hasTeams])

  function getLabel(e) {
    if (hasTeams) {
      const members = play?.play_participants?.filter(p => p.play_team_id === e.id) ?? []
      return e.name ? `${e.name} (${members.map(m => m.displayName).join(', ')})` : members.map(m => m.displayName).join(', ') || 'Équipe'
    }
    return e.displayName ?? '?'
  }

  function getShortLabel(e) {
    if (hasTeams) return e.name || 'Équipe'
    const name = e.displayName ?? '?'
    return name.split(' ')[0]
  }

  function getAvatarUrl(e) {
    if (hasTeams) return null
    return e.avatar_url ?? null
  }

  const totals = useMemo(() => {
    if (!rounds) return {}
    return Object.fromEntries(entities.map(e => [e.id, sumRounds(rounds, e.id)]))
  }, [rounds, entities])

  const standings = useMemo(() => {
    const arr = entities.map(e => ({ ...e, score: totals[e.id] ?? 0 }))
    const withWinners = play ? calcWinners(arr, play.win_rule) : arr
    return withWinners.sort((a, b) =>
      play?.win_rule === 'lowest_score' ? a.score - b.score : b.score - a.score
    )
  }, [entities, totals, play])

  function setScore(roundIdx, entityId, value) {
    setRounds(prev => prev.map((r, i) =>
      i === roundIdx ? { scores: { ...r.scores, [entityId]: value } } : r
    ))
  }

  function addRound() {
    setRounds(prev => [...prev, { scores: {} }])
  }

  function removeRound(idx) {
    setRounds(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function handleEnd() {
    if (!play || !rounds) return
    try {
      const participantScores = hasTeams
        ? (play.play_participants ?? []).map(p => ({ id: p.id, score: null }))
        : entities.map(e => ({ id: e.id, score: totals[e.id] ?? null }))

      const teamScores = hasTeams
        ? entities.map(e => ({ id: e.id, score: totals[e.id] ?? null }))
        : []

      await saveScores.mutateAsync({
        playId: play.id,
        participantScores,
        teamScores,
        comment,
        rounds,
        startedAt: play.started_at,
      })
      clearActivePlay()
      toast.success('Partie enregistrée !')
      navigate('/plays', { replace: true })
    } catch (err) {
      toast.error(err.message)
    }
    setConfirmEnd(false)
  }

  if (!activePlay) return null

  if (isLoading || rounds === null) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  const currentRoundIdx = rounds.length - 1
  const currentRound = rounds[currentRoundIdx]

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors shrink-0 p-1 -ml-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {play.game?.cover_url && (
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
            <img src={play.game.cover_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-100 truncate text-sm">{play.game?.title ?? '—'}</p>
          <p className="text-xs text-zinc-500">
            Tour {rounds.length} · {entities.length} joueur{entities.length !== 1 ? 's' : ''}
          </p>
        </div>

        <span className="font-mono text-sm text-amber-400 tabular-nums shrink-0">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 p-4 flex-1">

        {/* Standings */}
        <Standings standings={standings} play={play} getLabel={getLabel} />

        {/* Current round */}
        <CurrentRoundCard
          round={currentRound}
          roundIdx={currentRoundIdx}
          entities={entities}
          getShortLabel={getShortLabel}
          getAvatarUrl={getAvatarUrl}
          onChange={setScore}
          onRemove={removeRound}
          totalRounds={rounds.length}
        />

        {/* Add round */}
        <button
          type="button"
          onClick={addRound}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-zinc-700 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau tour
        </button>

        {/* Past rounds */}
        <PastRoundsSection
          rounds={rounds}
          entities={entities}
          getShortLabel={getShortLabel}
          onRemove={removeRound}
        />

        {/* Comment */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Commentaire (optionnel)
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Notes sur la partie…"
            className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-colors"
          />
        </div>

        {/* End game */}
        <div className="pb-4">
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-amber-400 text-zinc-950 text-base font-bold hover:bg-amber-300 active:scale-[0.98] transition-all shadow-lg shadow-amber-400/20"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Terminer la partie
          </button>
        </div>
      </div>

      {/* End confirmation */}
      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmEnd(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 w-full sm:max-w-sm flex flex-col gap-4">
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto sm:hidden" />
            <div>
              <p className="font-bold text-zinc-100 text-lg mb-1">Terminer la partie ?</p>
              <p className="text-sm text-zinc-400">
                {rounds.length > 1
                  ? `${rounds.length} tours seront enregistrés.`
                  : 'Les scores finaux seront enregistrés.'}
              </p>
            </div>

            {/* Final standings preview */}
            <div className="bg-zinc-800 rounded-2xl p-4 flex flex-col gap-2">
              {standings.map((e, idx) => (
                <div key={e.id} className="flex items-center gap-2.5 text-sm">
                  <span className={`w-5 text-xs font-bold shrink-0 ${idx === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                    {idx === 0 ? '🏆' : `${idx + 1}`}
                  </span>
                  <span className={`flex-1 truncate ${e.is_winner ? 'text-amber-400 font-semibold' : 'text-zinc-300'}`}>
                    {getLabel(e)}
                  </span>
                  <span className={`tabular-nums font-bold ${e.is_winner ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {e.score} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={() => setConfirmEnd(false)} className="flex-1">
                Continuer
              </Button>
              <Button onClick={handleEnd} disabled={saveScores.isPending} className="flex-1">
                {saveScores.isPending
                  ? <span className="flex items-center justify-center gap-2"><Spinner className="w-4 h-4" />Enregistrement…</span>
                  : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
