import { useState } from 'react'
import { useCreateChampionship } from '../../hooks/useChampionships'
import { usePlayerSearch } from '../../hooks/usePlayers'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ui/Toast'
import { DatePicker } from '../ui/DatePicker'

// ── Étape 1 – Informations ─────────────────────────────────────────────────────

function StepInfos({ data, onChange }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-300">
          Nom du championnat <span className="text-amber-400">*</span>
        </label>
        <input
          autoFocus
          type="text"
          value={data.name}
          onChange={e => onChange({ ...data, name: e.target.value })}
          placeholder="Ex : Saison été 2025"
          maxLength={80}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-300">
          Description <span className="text-zinc-600 font-normal text-xs">(facultatif)</span>
        </label>
        <textarea
          value={data.description}
          onChange={e => onChange({ ...data, description: e.target.value })}
          rows={3}
          maxLength={500}
          placeholder="Objectif, règles spéciales, format…"
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-colors"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-zinc-300">
          Période <span className="text-zinc-600 font-normal text-xs">(facultatif)</span>
        </label>
        <DatePicker
          label="Début"
          value={data.startsAt}
          onChange={v => onChange({ ...data, startsAt: v })}
          placeholder="Sélectionner une date de début"
        />
        <DatePicker
          label="Fin"
          value={data.endsAt}
          onChange={v => onChange({ ...data, endsAt: v })}
          placeholder="Sélectionner une date de fin"
        />
      </div>
    </div>
  )
}

// ── Étape 2 – Grille de points ─────────────────────────────────────────────────

const MODES = [
  {
    value: 'by_result',
    label: 'Par résultat',
    icon: '🏆',
    desc: 'Points fixes selon victoire, nul ou défaite',
  },
  {
    value: 'by_rank',
    label: 'Par classement',
    icon: '📊',
    desc: 'Points selon la position finale à chaque partie',
  },
]

function ScoringByResult({ scoring, onChange }) {
  const br = scoring.by_result ?? { win: 3, draw: 1, loss: 0 }
  const set = (field, val) => onChange({ ...scoring, by_result: { ...br, [field]: val === '' ? '' : Number(val) } })

  return (
    <div className="grid grid-cols-3 gap-3 mt-1">
      {[
        { key: 'win', label: 'Victoire', color: 'text-amber-400' },
        { key: 'draw', label: 'Nul', color: 'text-zinc-400' },
        { key: 'loss', label: 'Défaite', color: 'text-zinc-500' },
      ].map(({ key, label, color }) => (
        <div key={key} className="flex flex-col items-center gap-2 bg-zinc-800 rounded-xl p-3">
          <span className={`text-xs font-medium ${color}`}>{label}</span>
          <input
            type="number"
            min={0}
            value={br[key] ?? 0}
            onChange={e => set(key, e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 text-center focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <span className="text-xs text-zinc-600">pts</span>
        </div>
      ))}
    </div>
  )
}

function ScoringByRank({ scoring, onChange }) {
  const ranks = scoring.by_rank?.length
    ? scoring.by_rank
    : [{ rank: 1, points: 3 }, { rank: 2, points: 2 }, { rank: 3, points: 1 }]

  function addRank() {
    onChange({ ...scoring, by_rank: [...ranks, { rank: ranks.length + 1, points: 0 }] })
  }
  function setPoints(idx, points) {
    onChange({ ...scoring, by_rank: ranks.map((r, i) => i === idx ? { ...r, points: points === '' ? '' : Number(points) } : r) })
  }
  function removeRank(idx) {
    const updated = ranks.filter((_, i) => i !== idx).map((r, i) => ({ ...r, rank: i + 1 }))
    onChange({ ...scoring, by_rank: updated })
  }

  return (
    <div className="flex flex-col gap-2 mt-1">
      {ranks.map((r, idx) => (
        <div key={idx} className="flex items-center gap-3 bg-zinc-800 rounded-xl px-3 py-2.5">
          <span className="text-sm font-medium text-zinc-400 w-6 text-center">{r.rank}</span>
          <span className="text-sm text-zinc-500 flex-1">
            {r.rank === 1 ? '1ère place' : `${r.rank}e place`}
          </span>
          <input
            type="number"
            min={0}
            value={r.points}
            onChange={e => setPoints(idx, e.target.value)}
            className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-xs text-zinc-600">pts</span>
          {ranks.length > 1 && (
            <button
              type="button"
              onClick={() => removeRank(idx)}
              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRank}
        className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors py-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Ajouter une place
      </button>
    </div>
  )
}

const WIN_CONDITIONS = [
  { value: 'highest', icon: '🏆', label: 'Le plus de points', desc: 'Classique' },
  { value: 'lowest',  icon: '⛳', label: 'Le moins de points', desc: 'Ex : golf' },
]

function StepPoints({ data, onChange }) {
  const setMode = (mode) => onChange({ ...data, scoring: { ...data.scoring, mode } })
  const setScoring = (scoring) => onChange({ ...data, scoring })
  const setWinCondition = (win_condition) => onChange({ ...data, scoring: { ...data.scoring, win_condition } })
  const winCondition = data.scoring.win_condition ?? 'highest'

  return (
    <div className="flex flex-col gap-5">
      {/* Mode d'attribution des points */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Attribution des points</p>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                data.scoring.mode === m.value
                  ? 'border-amber-400 bg-amber-400/10 shadow-amber-400/10 shadow-md'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
              }`}
            >
              <span className="text-xl">{m.icon}</span>
              <span className={`text-sm font-semibold ${data.scoring.mode === m.value ? 'text-amber-400' : 'text-zinc-200'}`}>
                {m.label}
              </span>
              <span className="text-xs text-zinc-500 leading-snug">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {data.scoring.mode === 'by_result' && (
        <ScoringByResult scoring={data.scoring} onChange={setScoring} />
      )}
      {data.scoring.mode === 'by_rank' && (
        <ScoringByRank scoring={data.scoring} onChange={setScoring} />
      )}

      {/* Condition de victoire au championnat */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Remporte le championnat</p>
        <div className="grid grid-cols-2 gap-3">
          {WIN_CONDITIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWinCondition(opt.value)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                winCondition === opt.value
                  ? 'border-amber-400 bg-amber-400/10'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${winCondition === opt.value ? 'text-amber-400' : 'text-zinc-200'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-zinc-500">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Étape 3 – Départage ────────────────────────────────────────────────────────

const TIEBREAK_OPTIONS = [
  { value: 'wins', label: 'Nombre de victoires', desc: 'Le joueur avec le plus de victoires passe devant' },
  { value: 'score_sum', label: 'Total des scores', desc: 'Somme de tous les scores de jeu' },
  { value: 'head_to_head', label: 'Confrontations directes', desc: 'Résultat des parties entre les joueurs à égalité' },
  { value: 'points_diff', label: 'Différence de points', desc: 'Écart entre points pour et contre' },
]

function StepDepartage({ data, onChange }) {
  const order = data.tiebreakOrder

  function toggle(val) {
    onChange({
      ...data,
      tiebreakOrder: order.includes(val) ? order.filter(v => v !== val) : [...order, val],
    })
  }

  function moveUp(val) {
    const idx = order.indexOf(val)
    if (idx <= 0) return
    const next = [...order]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange({ ...data, tiebreakOrder: next })
  }

  function moveDown(val) {
    const idx = order.indexOf(val)
    if (idx < 0 || idx >= order.length - 1) return
    const next = [...order]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange({ ...data, tiebreakOrder: next })
  }

  // Show selected first (in order), then unselected
  const sorted = [
    ...order.filter(v => TIEBREAK_OPTIONS.find(o => o.value === v)),
    ...TIEBREAK_OPTIONS.filter(o => !order.includes(o.value)).map(o => o.value),
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">
        En cas d'égalité de points, ces critères sont appliqués dans l'ordre de priorité.
      </p>

      {sorted.map((val) => {
        const opt = TIEBREAK_OPTIONS.find(o => o.value === val)
        if (!opt) return null
        const selected = order.includes(val)
        const idx = order.indexOf(val)

        return (
          <div
            key={val}
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-all ${
              selected ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-800 bg-zinc-900/50 opacity-50'
            }`}
          >
            {/* Priority badge */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              selected ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-700 text-zinc-500'
            }`}>
              {selected ? idx + 1 : '–'}
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${selected ? 'text-zinc-100' : 'text-zinc-500'}`}>{opt.label}</p>
              <p className="text-xs text-zinc-600 truncate">{opt.desc}</p>
            </div>

            {/* Reorder buttons (only when selected) */}
            {selected && (
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveUp(val)}
                  disabled={idx === 0}
                  className="p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(val)}
                  disabled={idx === order.length - 1}
                  className="p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
            )}

            {/* Toggle */}
            <button
              type="button"
              onClick={() => toggle(val)}
              className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${
                selected ? 'bg-amber-400' : 'bg-zinc-700'
              }`}
              aria-label={selected ? 'Désactiver' : 'Activer'}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                selected ? 'left-4' : 'left-0.5'
              }`} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Étape 4 – Participants ─────────────────────────────────────────────────────

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ name, url, size = 'w-8 h-8' }) {
  return (
    <div className={`${size} rounded-full bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center text-xs font-semibold text-zinc-300`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
    </div>
  )
}

function StepParticipants({ data, onChange, profile }) {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const { data: searchResults } = usePlayerSearch(query)

  const added = data.participants
  const addedKeys = new Set(added.map(p => `${p.type}:${p.id}`))
  const creatorKey = profile?.id ? `user:${profile.id}` : null

  function addParticipant(user) {
    const key = `${user.type}:${user.id}`
    if (addedKeys.has(key) || key === creatorKey) return
    onChange({ ...data, participants: [...added, user] })
    setQuery('')
    setShowResults(false)
  }

  function removeParticipant(type, id) {
    onChange({ ...data, participants: added.filter(p => !(p.type === type && p.id === id)) })
  }

  const allResults = searchResults
    ? [
        ...(searchResults.users ?? []).map(u => ({ ...u, type: 'user' })),
        ...(searchResults.provisioned ?? []).map(u => ({ ...u, type: 'provisioned' })),
      ].filter(u => {
        const key = `${u.type}:${u.id}`
        return key !== creatorKey && !addedKeys.has(key)
      })
    : []

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500">
        Vous êtes automatiquement inclus en tant qu'organisateur. Ajoutez les autres participants.
      </p>

      {/* Créateur (non supprimable) */}
      {profile && (
        <div className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5">
          <Avatar name={profile.username} url={profile.avatar_url} />
          <span className="flex-1 text-sm font-medium text-zinc-100 truncate">{profile.username}</span>
          <span className="text-xs text-amber-400 font-medium shrink-0">Organisateur</span>
        </div>
      )}

      {/* Participants ajoutés */}
      {added.map(p => (
        <div key={`${p.type}:${p.id}`} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
          <Avatar name={p.username} url={p.avatar_url} />
          <span className="flex-1 text-sm text-zinc-100 truncate">{p.username}</span>
          {p.type === 'provisioned' && <span className="text-xs text-zinc-500 shrink-0">profil</span>}
          <button
            type="button"
            onClick={() => removeParticipant(p.type, p.id)}
            className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 p-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Recherche */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowResults(true) }}
          onFocus={() => setShowResults(true)}
          placeholder="Rechercher un joueur…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setShowResults(false) }}
            className="absolute inset-y-0 right-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Résultats */}
        {showResults && query.length >= 2 && (
          <div className="absolute z-20 top-full mt-1.5 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
            {allResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-500">Aucun résultat pour « {query} »</p>
            ) : (
              allResults.map(u => (
                <button
                  key={`${u.type}:${u.id}`}
                  type="button"
                  onMouseDown={() => addParticipant(u)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                >
                  <Avatar name={u.username} url={u.avatar_url} size="w-7 h-7" />
                  <span className="text-sm text-zinc-100 truncate flex-1">{u.username}</span>
                  {u.type === 'provisioned' && <span className="text-xs text-zinc-500 shrink-0">profil</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {added.length === 0 && (
        <p className="text-center text-xs text-zinc-600 py-2">
          Vous pouvez aussi ajouter des participants plus tard depuis l'onglet Règles.
        </p>
      )}
    </div>
  )
}

// ── Indicateur d'étapes ────────────────────────────────────────────────────────

const STEPS = ['Infos', 'Points', 'Départage', 'Joueurs']

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < current
                ? 'bg-amber-400/30 text-amber-400'
                : i === current
                  ? 'bg-amber-400 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-600'
            }`}>
              {i < current ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs transition-colors ${
              i === current ? 'text-zinc-300' : 'text-zinc-600'
            }`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-px mb-4 transition-colors ${i < current ? 'bg-amber-400/40' : 'bg-zinc-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  scoring: {
    mode: 'by_result',
    win_condition: 'highest',
    by_result: { win: 3, draw: 1, loss: 0 },
    by_rank: [{ rank: 1, points: 3 }, { rank: 2, points: 2 }, { rank: 3, points: 1 }],
    bonus_rules: [],
  },
  tiebreakOrder: ['wins', 'score_sum', 'head_to_head'],
  participants: [],
}

export function NewChampionshipModal({ open, onClose, onCreated }) {
  const toast = useToast()
  const { profile } = useAuth()
  const createChampionship = useCreateChampionship()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(DEFAULT_FORM)

  if (!open) return null

  function handleClose() {
    onClose()
    // reset après fermeture (délai pour éviter le flash)
    setTimeout(() => { setStep(0); setForm(DEFAULT_FORM) }, 300)
  }

  const canNext = step === 0 ? form.name.trim().length > 0 : true

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error('Le nom est obligatoire.'); return }
    try {
      const champ = await createChampionship.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        scoring: form.scoring,
        tiebreakOrder: form.tiebreakOrder,
        participants: form.participants,
      })
      toast.success('Championnat créé !')
      handleClose()
      onCreated?.(champ)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto">

        {/* Drag handle (mobile) — sticky en haut */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden sticky top-0 bg-zinc-900 z-10">
          <div className="w-9 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* Header — sticky */}
        <div className="flex items-center justify-between px-4 pt-2 pb-3 sticky top-0 sm:top-0 bg-zinc-900 z-10">
          <h2 className="text-base font-semibold text-zinc-100">Nouveau championnat</h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-4 pb-2">
          <StepIndicator current={step} />
        </div>

        <div className="h-px bg-zinc-800" />

        {/* Step content — grandit librement, pas de scroll interne */}
        <div className="px-4 py-5">
          {step === 0 && <StepInfos data={form} onChange={setForm} />}
          {step === 1 && <StepPoints data={form} onChange={setForm} />}
          {step === 2 && <StepDepartage data={form} onChange={setForm} />}
          {step === 3 && <StepParticipants data={form} onChange={setForm} profile={profile} />}
        </div>

        {/* Footer navigation — sticky en bas */}
        <div className="px-4 py-4 border-t border-zinc-800 flex gap-3 sticky bottom-0 bg-zinc-900">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Précédent
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Annuler
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 text-zinc-950 text-sm font-semibold hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createChampionship.isPending}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 text-zinc-950 text-sm font-semibold hover:bg-amber-300 transition-colors disabled:opacity-60"
            >
              {createChampionship.isPending ? 'Création…' : 'Créer le championnat'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
