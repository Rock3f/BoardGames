import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useUpdateCollectionEntry, useRemoveFromCollection } from '../../hooks/useCollection'
import { useToast } from '../ui/Toast'

const STATUSES = ['owned', 'lent', 'borrowed', 'wishlist', 'sold']
const STATUS_LABELS = {
  owned: 'Possédé', lent: 'Prêté', borrowed: 'Emprunté', wishlist: 'Wishlist', sold: 'Vendu',
}

function StatusSelector({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            value === s
              ? 'bg-amber-400 text-zinc-950 border-amber-400'
              : 'text-zinc-400 border-zinc-700 hover:border-zinc-500'
          }`}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  )
}

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          className={`text-2xl transition-colors ${n <= (value ?? 0) ? 'text-amber-400' : 'text-zinc-700 hover:text-zinc-500'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function GameEntryModal({ entry, onClose }) {
  const toast = useToast()
  const update = useUpdateCollectionEntry()
  const remove = useRemoveFromCollection()

  const [status, setStatus] = useState(entry?.status ?? 'owned')
  const [rating, setRating] = useState(entry?.personal_rating ?? null)
  const [note, setNote] = useState(entry?.notes ?? '')
  const [confirming, setConfirming] = useState(false)

  if (!entry) return null
  const { game } = entry

  async function handleSave() {
    try {
      await update.mutateAsync({ id: entry.id, status, personal_rating: rating, notes: note })
      toast.success('Mis à jour')
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleRemove() {
    try {
      await remove.mutateAsync(entry.id)
      toast.info(`${game.title} retiré de ta collection`)
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open onClose={onClose} title={game.title}>
      {confirming ? (
        <div className="flex flex-col gap-4">
          <p className="text-zinc-300 text-sm">
            Retirer <span className="font-semibold text-zinc-100">{game.title}</span> de ta collection ?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)} className="flex-1">Annuler</Button>
            <Button variant="danger" onClick={handleRemove} disabled={remove.isPending} className="flex-1">
              {remove.isPending ? 'Suppression…' : 'Retirer'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
              {game.cover_url ? (
                <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-3xl">🎲</div>
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="font-semibold text-zinc-100 leading-tight">{game.title}</p>
              {game.year_published && <p className="text-xs text-zinc-500">{game.year_published}</p>}
              {game.publisher && <p className="text-xs text-zinc-500">{game.publisher}</p>}
              {game.min_players && (
                <p className="text-xs text-zinc-500">
                  {game.min_players === game.max_players ? game.min_players : `${game.min_players}–${game.max_players}`} joueurs
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Statut</label>
            <StatusSelector value={status} onChange={setStatus} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Note personnelle</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Commentaire</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Avis, règles maison, contexte…"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-colors"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              className="text-red-400 hover:text-red-300 hover:bg-red-950"
            >
              Retirer
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
