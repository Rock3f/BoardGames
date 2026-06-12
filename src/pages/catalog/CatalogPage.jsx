import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { AddGameModal } from '../../components/collection/AddGameModal'
import { useAllGames, useUpdateGame, useGameExtensions, useAddExtension } from '../../hooks/useCatalog'
import { useMyCollection, useAddToCollection } from '../../hooks/useCollection'
import { useToast } from '../../components/ui/Toast'

// ── Utilities ─────────────────────────────────────────────────────────────────

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatPlayers(game) {
  if (!game.min_players && !game.max_players) return null
  if (game.min_players === game.max_players) return `${game.min_players}j`
  return `${game.min_players}–${game.max_players}j`
}

function formatDuration(game) {
  if (!game.min_duration_min) return null
  if (!game.max_duration_min || game.max_duration_min === game.min_duration_min)
    return `${game.min_duration_min} min`
  return `${game.min_duration_min}–${game.max_duration_min} min`
}

// ── Cover placeholder ─────────────────────────────────────────────────────────

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

// ── Catalog card ──────────────────────────────────────────────────────────────

function CatalogCard({ game, myEntry, extensionCount, onEdit, onAddToCollection }) {
  const players = formatPlayers(game)
  const duration = formatDuration(game)

  return (
    <div className="group bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-colors flex flex-col">
      {/* Cover */}
      <div className="aspect-square relative overflow-hidden">
        {game.cover_url
          ? (
            <img
              src={game.cover_url}
              alt={game.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          )
          : <CoverPlaceholder />}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Title */}
        <div>
          <p className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-tight">
            {game.title}
          </p>
          {(game.publisher || game.year_published) && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {[game.publisher, game.year_published].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Meta chips */}
        {(players || duration) && (
          <div className="flex gap-1.5 flex-wrap">
            {players && (
              <span className="text-xs text-zinc-400 bg-zinc-800 rounded-full px-2 py-0.5">
                👥 {players}
              </span>
            )}
            {duration && (
              <span className="text-xs text-zinc-400 bg-zinc-800 rounded-full px-2 py-0.5">
                ⏱ {duration}
              </span>
            )}
            {extensionCount > 0 && (
              <span className="text-xs text-zinc-400 bg-zinc-800 rounded-full px-2 py-0.5">
                📦 {extensionCount} ext.
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {game.description && (
          <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">
            {game.description}
          </p>
        )}

        {/* Push buttons to bottom */}
        <div className="flex-1" />

        {/* Collection badge */}
        {myEntry && (
          <div>
            <Badge status={myEntry.status} />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => onEdit(game)}
            title="Modifier le catalogue"
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
            Modifier
          </button>

          {myEntry ? (
            <span className="flex-1 flex items-center justify-center text-xs text-zinc-600 bg-zinc-800/50 rounded-lg px-2 py-1.5">
              Dans ta collection
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onAddToCollection(game)}
              title="Ajouter à ma collection"
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-950 bg-amber-400 hover:bg-amber-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Ajouter
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Status selector ───────────────────────────────────────────────────────────

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

// ── Add to collection modal ───────────────────────────────────────────────────

function AddToCollectionModal({ game, onClose }) {
  const toast = useToast()
  const addToCollection = useAddToCollection()
  const [status, setStatus] = useState('owned')

  async function handleAdd() {
    try {
      await addToCollection.mutateAsync({ gameId: game.id, status })
      toast.success(`${game.title} ajouté à ta collection`)
      onClose()
    } catch (err) {
      if (err.code === '23505') toast.error('Ce jeu est déjà dans ta collection.')
      else toast.error(err.message)
    }
  }

  return (
    <Modal open={!!game} onClose={onClose} title="Ajouter à ma collection">
      <div className="flex flex-col gap-5">
        <div className="flex gap-3 items-center">
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
            {game.cover_url
              ? <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xl">🎲</div>}
          </div>
          <div>
            <p className="font-semibold text-zinc-100">{game.title}</p>
            {game.publisher && <p className="text-xs text-zinc-500">{game.publisher}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Statut</label>
          <StatusSelector value={status} onChange={setStatus} />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleAdd} disabled={addToCollection.isPending}>
            {addToCollection.isPending ? 'Ajout…' : 'Ajouter'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add extension inline form ─────────────────────────────────────────────────

function AddExtensionForm({ parentGameId, onDone }) {
  const toast = useToast()
  const addExtension = useAddExtension()
  const fileRef = useRef(null)

  const [fields, setFields] = useState({
    title: '', publisher: '', minPlayers: '', maxPlayers: '',
    minDuration: '', maxDuration: '', yearPublished: '', description: '',
  })
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)

  function set(key) {
    return (e) => setFields((f) => ({ ...f, [key]: e.target.value }))
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Image requise.'); return }
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleCreate() {
    if (!fields.title.trim() || !fields.minPlayers || !fields.maxPlayers) {
      toast.error('Titre, joueurs min et max sont requis.')
      return
    }
    try {
      await addExtension.mutateAsync({ parentGameId, ...fields, coverFile })
      if (coverPreview) URL.revokeObjectURL(coverPreview)
      toast.success('Extension créée')
      onDone()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-3 border border-zinc-700 rounded-xl p-3">
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Nouvelle extension</p>

      {/* Cover */}
      <div
        className="relative aspect-video rounded-lg overflow-hidden bg-zinc-800 cursor-pointer group"
        onClick={() => fileRef.current?.click()}
      >
        {coverPreview
          ? <img src={coverPreview} alt="" className="w-full h-full object-cover" />
          : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-zinc-600">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18" />
              </svg>
              <span className="text-xs">Ajouter une image</span>
            </div>
          )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs font-medium">
            {coverPreview ? 'Remplacer' : 'Ajouter'}
          </span>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <Input label="Titre *" value={fields.title} onChange={set('title')} autoFocus />
      <Input label="Éditeur" value={fields.publisher} onChange={set('publisher')} />

      <div className="grid grid-cols-2 gap-2">
        <Input label="Joueurs min *" type="number" min={1} max={20} value={fields.minPlayers} onChange={set('minPlayers')} />
        <Input label="Joueurs max *" type="number" min={1} max={20} value={fields.maxPlayers} onChange={set('maxPlayers')} />
        <Input label="Durée min (min)" type="number" min={1} value={fields.minDuration} onChange={set('minDuration')} />
        <Input label="Durée max (min)" type="number" min={1} value={fields.maxDuration} onChange={set('maxDuration')} />
        <Input label="Année" type="number" min={1900} max={2030} value={fields.yearPublished} onChange={set('yearPublished')} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-300">Description</label>
        <textarea
          value={fields.description}
          onChange={set('description')}
          rows={2}
          maxLength={2000}
          placeholder="Résumé…"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-colors"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onDone} disabled={addExtension.isPending}>
          Annuler
        </Button>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={addExtension.isPending || !fields.title.trim() || !fields.minPlayers || !fields.maxPlayers}
        >
          {addExtension.isPending
            ? <span className="flex items-center gap-2"><Spinner className="w-4 h-4" />Création…</span>
            : "Créer l'extension"}
        </Button>
      </div>
    </div>
  )
}

// ── Extensions panel (inside edit modal) ──────────────────────────────────────

function ExtensionsPanel({ game, extensions, collectionMap, onEditExtension, onAddToCollection }) {
  const [showAddForm, setShowAddForm] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      {/* Existing extensions */}
      {extensions.length > 0 && (
        <div className="flex flex-col gap-2">
          {extensions.map((ext) => {
            const myEntry = collectionMap?.get(ext.id)
            return (
              <div key={ext.id} className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-2.5">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                  {ext.cover_url
                    ? <img src={ext.cover_url} alt={ext.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm">🎲</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{ext.title}</p>
                  {ext.publisher && <p className="text-xs text-zinc-500 truncate">{ext.publisher}</p>}
                </div>
                {myEntry
                  ? <Badge status={myEntry.status} />
                  : (
                    <button
                      type="button"
                      onClick={() => onAddToCollection(ext)}
                      className="shrink-0 text-xs font-medium text-zinc-950 bg-amber-400 hover:bg-amber-300 px-2 py-1 rounded-lg transition-colors"
                    >
                      + Ajouter
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => onEditExtension(ext)}
                  title="Modifier cette extension"
                  className="shrink-0 text-zinc-500 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {extensions.length === 0 && !showAddForm && (
        <p className="text-center text-zinc-500 text-sm py-6">
          Aucune extension enregistrée pour ce jeu.
        </p>
      )}

      {/* Add form or button */}
      {showAddForm
        ? <AddExtensionForm parentGameId={game.id} onDone={() => setShowAddForm(false)} />
        : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 border border-dashed border-zinc-700 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter une extension
          </button>
        )}
    </div>
  )
}

// ── Game edit modal ───────────────────────────────────────────────────────────

function GameEditModal({ game, onClose, onEditExtension, collectionMap, onAddToCollection }) {
  const toast = useToast()
  const updateGame = useUpdateGame()
  const fileRef = useRef(null)

  const isBaseGame = !game.parent_game_id
  const [activeTab, setActiveTab] = useState('info')

  const { data: extensions = [], isLoading: extLoading } = useGameExtensions(game.id)

  const [fields, setFields] = useState({
    title: game.title ?? '',
    publisher: game.publisher ?? '',
    minPlayers: game.min_players ?? '',
    maxPlayers: game.max_players ?? '',
    minDuration: game.min_duration_min ?? '',
    maxDuration: game.max_duration_min ?? '',
    yearPublished: game.year_published ?? '',
    description: game.description ?? '',
  })
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)

  function set(key) {
    return (e) => setFields((f) => ({ ...f, [key]: e.target.value }))
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Fichier image requis.'); return }
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fields.title.trim() || !fields.minPlayers || !fields.maxPlayers) return
    try {
      await updateGame.mutateAsync({
        id: game.id,
        title: fields.title,
        publisher: fields.publisher,
        minPlayers: fields.minPlayers,
        maxPlayers: fields.maxPlayers,
        minDuration: fields.minDuration || null,
        maxDuration: fields.maxDuration || null,
        yearPublished: fields.yearPublished || null,
        description: fields.description,
        coverFile: coverFile ?? null,
        currentCoverUrl: game.cover_url ?? null,
      })
      if (coverPreview) URL.revokeObjectURL(coverPreview)
      toast.success(`${fields.title} mis à jour`)
      onClose()
    } catch (err) {
      if (err.code === '23505') toast.error('Un jeu avec ce titre existe déjà dans le catalogue.')
      else toast.error(err.message)
    }
  }

  function handleClose() {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    onClose()
  }

  function handleEditExtension(ext) {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    onEditExtension(ext)
  }

  const coverSrc = coverPreview ?? game.cover_url

  const tabs = [
    { id: 'info', label: 'Informations' },
    { id: 'extensions', label: extLoading ? 'Extensions' : `Extensions${extensions.length ? ` (${extensions.length})` : ''}` },
  ]

  return (
    <Modal open={!!game} onClose={handleClose} title="Modifier le catalogue">
      {/* Tab bar — only for base games */}
      {isBaseGame && (
        <div className="flex gap-0 mb-4 border-b border-zinc-800 -mx-4 px-4 sm:-mx-6 sm:px-6">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`pb-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Informations tab */}
      {(activeTab === 'info' || !isBaseGame) && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Cover zone */}
          <div
            className="relative aspect-video rounded-xl overflow-hidden bg-zinc-800 cursor-pointer group"
            onClick={() => fileRef.current?.click()}
          >
            {coverSrc
              ? <img src={coverSrc} alt={fields.title} className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18" />
                  </svg>
                  <span className="text-sm">Cliquer pour ajouter une image</span>
                </div>
              )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {coverSrc ? "Remplacer l'image" : 'Ajouter une image'}
              </span>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          <Input label="Titre *" value={fields.title} onChange={set('title')} required autoFocus />
          <Input label="Éditeur" value={fields.publisher} onChange={set('publisher')} placeholder="Ravensburger, Days of Wonder…" />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Joueurs min *" type="number" min={1} max={20} value={fields.minPlayers} onChange={set('minPlayers')} required />
            <Input label="Joueurs max *" type="number" min={1} max={20} value={fields.maxPlayers} onChange={set('maxPlayers')} required />
            <Input label="Durée min (min)" type="number" min={1} value={fields.minDuration} onChange={set('minDuration')} />
            <Input label="Durée max (min)" type="number" min={1} value={fields.maxDuration} onChange={set('maxDuration')} />
            <Input label="Année" type="number" min={1900} max={2030} value={fields.yearPublished} onChange={set('yearPublished')} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Description</label>
            <textarea
              value={fields.description}
              onChange={set('description')}
              rows={3}
              maxLength={2000}
              placeholder="Résumé du jeu…"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-colors"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={updateGame.isPending}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={updateGame.isPending || !fields.title.trim() || !fields.minPlayers || !fields.maxPlayers}
            >
              {updateGame.isPending
                ? <span className="flex items-center gap-2"><Spinner className="w-4 h-4" />Enregistrement…</span>
                : 'Enregistrer'}
            </Button>
          </div>
        </form>
      )}

      {/* Extensions tab */}
      {activeTab === 'extensions' && isBaseGame && (
        extLoading
          ? <div className="flex justify-center py-10"><Spinner className="w-7 h-7" /></div>
          : (
            <ExtensionsPanel
              game={game}
              extensions={extensions}
              collectionMap={collectionMap}
              onEditExtension={handleEditExtension}
              onAddToCollection={onAddToCollection}
            />
          )
      )}
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const [search, setSearch] = useState('')
  const [editGame, setEditGame] = useState(null)
  const [addGame, setAddGame] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)

  const debouncedSearch = useDebounce(search)

  const { data: allGames, isLoading, isError } = useAllGames()
  const { data: collection } = useMyCollection()

  const collectionMap = useMemo(() => {
    const map = new Map()
    if (collection) {
      for (const entry of collection) map.set(entry.catalog_game_id, entry)
    }
    return map
  }, [collection])

  const collectionGameIds = useMemo(() => new Set(collectionMap.keys()), [collectionMap])

  // Split base games and extensions
  const baseGames = useMemo(() => allGames?.filter((g) => !g.parent_game_id) ?? [], [allGames])

  const extensionCountMap = useMemo(() => {
    const map = new Map()
    if (allGames) {
      for (const g of allGames) {
        if (g.parent_game_id) {
          map.set(g.parent_game_id, (map.get(g.parent_game_id) ?? 0) + 1)
        }
      }
    }
    return map
  }, [allGames])

  const totalExtensions = (allGames?.length ?? 0) - baseGames.length

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return baseGames
    const q = debouncedSearch.trim().toLowerCase()
    return baseGames.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        (g.publisher && g.publisher.toLowerCase().includes(q))
    )
  }, [baseGames, debouncedSearch])

  function handleEditExtension(ext) {
    setEditGame(ext)
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Catalogue</h1>
        <span className="text-sm text-zinc-500">
          {baseGames.length} jeu{baseGames.length !== 1 ? 'x' : ''}
          {totalExtensions > 0 && ` · ${totalExtensions} extension${totalExtensions > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par titre ou éditeur…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="w-8 h-8" />
        </div>
      )}

      {isError && (
        <p className="text-center text-red-400 py-8 text-sm">
          Erreur de chargement. Vérifie ta connexion.
        </p>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
          <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <p className="text-sm">
            {search ? `Aucun jeu pour « ${search} »` : 'Le catalogue est vide'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="text-sm text-amber-400 hover:underline"
            >
              Ajouter le premier jeu
            </button>
          )}
        </div>
      )}

      {/* Game grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((game) => (
            <CatalogCard
              key={game.id}
              game={game}
              myEntry={collectionMap.get(game.id)}
              extensionCount={extensionCountMap.get(game.id) ?? 0}
              onEdit={setEditGame}
              onAddToCollection={setAddGame}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        aria-label="Ajouter un jeu au catalogue"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 rounded-full bg-amber-400 text-zinc-950 shadow-lg hover:bg-amber-300 transition-colors flex items-center justify-center z-30"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Modals */}
      {editGame && (
        <GameEditModal
          key={editGame.id}
          game={editGame}
          onClose={() => setEditGame(null)}
          onEditExtension={handleEditExtension}
          collectionMap={collectionMap}
          onAddToCollection={setAddGame}
        />
      )}
      {addGame && (
        <AddToCollectionModal game={addGame} onClose={() => setAddGame(null)} />
      )}
      <AddGameModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        collectionGameIds={collectionGameIds}
      />
    </div>
  )
}
