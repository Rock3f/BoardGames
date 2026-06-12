import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateChampionship } from '../../hooks/useChampionships'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

const MODES = [
  { value: 'by_result', label: 'Par résultat', desc: 'Points selon victoire / nul / défaite' },
  { value: 'by_rank', label: 'Par classement', desc: 'Points selon la position finale' },
]

// ── French date picker (three selects: jour / mois / année) ──────────────────

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const THIS_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => String(THIS_YEAR - 1 + i))

function FrenchDateInput({ label, value, onChange }) {
  // value is 'YYYY-MM-DD' or '' — local state manages partial selection
  const split = (value || '').split('-')
  const [y, setY] = useState(split[0] || '')
  const [mo, setMo] = useState(split[1] || '')
  const [dy, setDy] = useState(split[2] || '')

  const daysInMonth = mo && y ? new Date(Number(y), Number(mo), 0).getDate() : 31

  function emit(newY, newMo, newDy) {
    onChange({ target: { value: newY && newMo && newDy ? `${newY}-${newMo}-${newDy}` : '' } })
  }

  function changeDay(v) {
    setDy(v)
    emit(y, mo, v)
  }

  function changeMonth(v) {
    // If the current day is out of range for the new month, reset it
    const maxDays = v && y ? new Date(Number(y), Number(v), 0).getDate() : 31
    const safeDy = dy && Number(dy) > maxDays ? '' : dy
    if (safeDy !== dy) setDy(safeDy)
    setMo(v)
    emit(y, v, safeDy)
  }

  function changeYear(v) {
    // Handle leap-year edge case for Feb 29
    const maxDays = mo && v ? new Date(Number(v), Number(mo), 0).getDate() : 31
    const safeDy = dy && Number(dy) > maxDays ? '' : dy
    if (safeDy !== dy) setDy(safeDy)
    setY(v)
    emit(v, mo, safeDy)
  }

  const selectCls =
    'rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 ' +
    'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent'

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-zinc-300">{label}</label>}
      <div className="flex gap-1.5">
        {/* Jour */}
        <select
          value={dy}
          onChange={e => changeDay(e.target.value)}
          className={`w-[52px] ${selectCls}`}
        >
          <option value="">J</option>
          {Array.from({ length: daysInMonth }, (_, i) => {
            const v = String(i + 1).padStart(2, '0')
            return <option key={v} value={v}>{i + 1}</option>
          })}
        </select>

        {/* Mois */}
        <select
          value={mo}
          onChange={e => changeMonth(e.target.value)}
          className={`flex-1 min-w-0 ${selectCls}`}
        >
          <option value="">Mois</option>
          {MONTHS_FR.map((name, i) => {
            const v = String(i + 1).padStart(2, '0')
            return <option key={v} value={v}>{name}</option>
          })}
        </select>

        {/* Année */}
        <select
          value={y}
          onChange={e => changeYear(e.target.value)}
          className={`w-[84px] ${selectCls}`}
        >
          <option value="">Année</option>
          {YEAR_OPTIONS.map(yr => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── Scoring sub-components ────────────────────────────────────────────────────

function ScoringByResult({ scoring, onChange }) {
  const br = scoring.by_result ?? { win: 3, draw: 1, loss: 0 }
  const set = (field, val) => onChange({ ...scoring, by_result: { ...br, [field]: Number(val) } })
  return (
    <div className="grid grid-cols-3 gap-3">
      {[['win', 'Victoire'], ['draw', 'Match nul'], ['loss', 'Défaite']].map(([k, label]) => (
        <div key={k} className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">{label}</label>
          <input
            type="number"
            min={0}
            value={br[k] ?? 0}
            onChange={e => set(k, e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 text-center focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
      ))}
    </div>
  )
}

function ScoringByRank({ scoring, onChange }) {
  const ranks = scoring.by_rank ?? []

  function addRank() {
    const next = ranks.length + 1
    onChange({ ...scoring, by_rank: [...ranks, { rank: next, points: Math.max(0, 4 - next) }] })
  }

  function setRankPoints(idx, points) {
    const updated = ranks.map((r, i) => i === idx ? { ...r, points: Number(points) } : r)
    onChange({ ...scoring, by_rank: updated })
  }

  function removeRank(idx) {
    const updated = ranks.filter((_, i) => i !== idx).map((r, i) => ({ ...r, rank: i + 1 }))
    onChange({ ...scoring, by_rank: updated })
  }

  return (
    <div className="flex flex-col gap-2">
      {ranks.map((r, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-sm text-zinc-400 w-16">Place {r.rank}</span>
          <input
            type="number"
            min={0}
            value={r.points}
            onChange={e => setRankPoints(idx, e.target.value)}
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 text-center focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <span className="text-sm text-zinc-500">pts</span>
          <button onClick={() => removeRank(idx)} className="text-zinc-600 hover:text-red-400 transition-colors ml-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addRank}
        className="text-sm text-amber-400 hover:underline text-left"
      >
        + Ajouter une place
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DEFAULT_SCORING = {
  mode: 'by_result',
  by_result: { win: 3, draw: 1, loss: 0 },
  by_rank: [],
  bonus_rules: [],
}

export default function NewChampionshipPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createChampionship = useCreateChampionship()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [scoring, setScoring] = useState(DEFAULT_SCORING)
  const [tiebreakOrder, setTiebreakOrder] = useState(['wins', 'score_sum', 'head_to_head'])

  const TIEBREAK_OPTIONS = [
    { value: 'wins', label: 'Nombre de victoires' },
    { value: 'score_sum', label: 'Total des scores de jeu' },
    { value: 'head_to_head', label: 'Confrontations directes' },
    { value: 'points_diff', label: 'Différence de points' },
  ]

  function toggleTiebreak(val) {
    setTiebreakOrder(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Le nom est obligatoire.'); return }
    try {
      const champ = await createChampionship.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        scoring,
        tiebreakOrder,
      })
      toast.success('Championnat créé !')
      navigate(`/championships/${champ.id}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/championships')}
          className="text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-zinc-100">Nouveau championnat</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section Général */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-300">Informations générales</h2>
          <Input
            label="Nom *"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex : Saison 2025"
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-300">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Objectif, règles spéciales…"
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FrenchDateInput
              label="Date de début"
              value={startsAt}
              onChange={e => setStartsAt(e.target.value)}
            />
            <FrenchDateInput
              label="Date de fin"
              value={endsAt}
              onChange={e => setEndsAt(e.target.value)}
            />
          </div>
        </section>

        {/* Section Grille de points */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-300">Grille de points</h2>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setScoring(prev => ({ ...prev, mode: m.value }))}
                className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors ${
                  scoring.mode === m.value
                    ? 'border-amber-400 bg-amber-400/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <span className={`text-sm font-medium ${scoring.mode === m.value ? 'text-amber-400' : 'text-zinc-200'}`}>{m.label}</span>
                <span className="text-xs text-zinc-500">{m.desc}</span>
              </button>
            ))}
          </div>

          {scoring.mode === 'by_result' && (
            <ScoringByResult scoring={scoring} onChange={setScoring} />
          )}
          {scoring.mode === 'by_rank' && (
            <ScoringByRank scoring={scoring} onChange={setScoring} />
          )}
        </section>

        {/* Section Départages */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-300">Critères de départage (en cas d'égalité)</h2>
          <p className="text-xs text-zinc-500">Sélectionnez et réordonnez selon votre priorité.</p>
          <div className="flex flex-col gap-2">
            {TIEBREAK_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tiebreakOrder.includes(opt.value)}
                  onChange={() => toggleTiebreak(opt.value)}
                  className="w-4 h-4 accent-amber-400 rounded"
                />
                <span className="text-sm text-zinc-200">{opt.label}</span>
                {tiebreakOrder.includes(opt.value) && (
                  <span className="text-xs text-zinc-500 ml-auto">
                    Priorité {tiebreakOrder.indexOf(opt.value) + 1}
                  </span>
                )}
              </label>
            ))}
          </div>
        </section>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate('/championships')}>
            Annuler
          </Button>
          <Button type="submit" disabled={createChampionship.isPending}>
            {createChampionship.isPending ? 'Création…' : 'Créer le championnat'}
          </Button>
        </div>
      </form>
    </div>
  )
}
