import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Spinner } from '../ui/Spinner'
import { useCatalogSearch, useCreateGame } from '../../hooks/useCatalog'
import { useAddToCollection } from '../../hooks/useCollection'
import { useToast } from '../ui/Toast'
import { supabase } from '../../lib/supabase'
import {
  cleanTitle,
  lookupUpc,
  lookupPhilibert,
  searchBgg,
  fetchBggThing,
  downloadBggCover,
} from '../../hooks/useGameEnrichment'
import { BarcodeScannerModal } from './BarcodeScannerModal'
import { BggDisambiguationModal } from './BggDisambiguationModal'

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

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Search tab ──────────────────────────────────────────────────────────────

function SearchTab({ collectionGameIds, onClose }) {
  const toast = useToast()
  const addToCollection = useAddToCollection()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('owned')
  const debouncedQuery = useDebounce(query)

  const { data: results, isFetching } = useCatalogSearch(debouncedQuery)

  async function handleAdd() {
    try {
      await addToCollection.mutateAsync({ gameId: selected.id, status })
      toast.success(`${selected.title} ajouté à ta collection`)
      onClose()
    } catch (err) {
      if (err.code === '23505') toast.error('Ce jeu est déjà dans ta collection.')
      else toast.error(err.message)
    }
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </button>

        <div className="flex gap-4 items-center">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
            {selected.cover_url ? (
              <img src={selected.cover_url} alt={selected.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-2xl">🎲</div>
            )}
          </div>
          <div>
            <p className="font-semibold text-zinc-100">{selected.title}</p>
            {selected.publisher && <p className="text-xs text-zinc-500">{selected.publisher}</p>}
            {selected.year_published && <p className="text-xs text-zinc-500">{selected.year_published}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Statut</label>
          <StatusSelector value={status} onChange={setStatus} />
        </div>

        {collectionGameIds.has(selected.id) && (
          <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">
            Ce jeu est déjà dans ta collection.
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setSelected(null)}>Retour</Button>
          <Button
            onClick={handleAdd}
            disabled={addToCollection.isPending || collectionGameIds.has(selected.id)}
          >
            {addToCollection.isPending ? 'Ajout…' : 'Ajouter'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Rechercher un jeu…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {isFetching && <div className="flex justify-center py-4"><Spinner /></div>}

      {!isFetching && debouncedQuery.length >= 2 && results?.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-4">Aucun résultat pour « {debouncedQuery} »</p>
      )}

      {results && results.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-800">
          {results.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                onClick={() => setSelected(game)}
                className="w-full flex items-center gap-3 py-3 text-left hover:bg-zinc-800/50 rounded-xl px-2 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                  {game.cover_url ? (
                    <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-lg">🎲</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{game.title}</p>
                  <p className="text-xs text-zinc-500">
                    {[game.publisher, game.year_published].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {collectionGameIds.has(game.id) && (
                  <span className="text-xs text-zinc-500 shrink-0">Dans ta collection</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {debouncedQuery.length < 2 && (
        <p className="text-sm text-zinc-500 text-center py-4">Tape au moins 2 caractères pour rechercher</p>
      )}
    </div>
  )
}

// ─── Parent game selector ─────────────────────────────────────────────────────

function ParentGameSelector({ value, onChange }) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query)
  const { data: results, isFetching } = useCatalogSearch(debouncedQuery)

  if (value) {
    return (
      <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-zinc-700">
          {value.cover_url ? (
            <img src={value.cover_url} alt={value.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">🎲</div>
          )}
        </div>
        <span className="flex-1 min-w-0 text-sm text-zinc-100 truncate">{value.title}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors shrink-0"
          aria-label="Retirer le jeu de base"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Rechercher le jeu de base…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isFetching && debouncedQuery.length >= 2 && (
        <div className="flex justify-center py-2"><Spinner className="w-4 h-4" /></div>
      )}
      {!isFetching && debouncedQuery.length >= 2 && results?.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-1">Aucun résultat</p>
      )}
      {results && results.length > 0 && debouncedQuery.length >= 2 && (
        <ul className="flex flex-col divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
          {results.slice(0, 6).map((game) => (
            <li key={game.id}>
              <button
                type="button"
                onClick={() => { onChange(game); setQuery('') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/70 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                  {game.cover_url ? (
                    <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">🎲</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-100 truncate">{game.title}</p>
                  {game.year_published && <p className="text-xs text-zinc-500">{game.year_published}</p>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Create tab ───────────────────────────────────────────────────────────────

const EMPTY_FIELDS = {
  title: '', publisher: '', yearPublished: '',
  minPlayers: '', maxPlayers: '', minDuration: '', maxDuration: '', description: '',
}

const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

function CreateTab({ onClose }) {
  const toast = useToast()
  const createGame = useCreateGame()
  const fileRef = useRef(null)

  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [isExtension, setIsExtension] = useState(false)
  const [parentGame, setParentGame] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [status, setStatus] = useState('owned')

  // Scan + enrichment state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState(null)
  const [bggResults, setBggResults] = useState([])
  const [disambigOpen, setDisambigOpen] = useState(false)
  const [scannedEan, setScannedEan] = useState(null)
  const [searchedTitle, setSearchedTitle] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [fallbackTitle, setFallbackTitle] = useState('')
  const [showFallback, setShowFallback] = useState(false)

  function set(key) {
    return (e) => setFields((f) => ({ ...f, [key]: e.target.value }))
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fields.title.trim()) return
    try {
      await createGame.mutateAsync({ ...fields, coverFile, status, parentGameId: parentGame?.id ?? null })
      toast.success(`${fields.title} ajouté au catalogue et à ta collection`)
      onClose()
    } catch (err) {
      if (err.code === '23505') toast.error('Un jeu avec ce titre existe déjà dans le catalogue.')
      else toast.error(err.message)
    }
  }

  // ── Scan flow ──────────────────────────────────────────────────────────────

  async function runBggSearch(title) {
    setSearchedTitle(title)
    setEnriching(true)
    setEnrichError(null)

    try {
      const results = await searchBgg(title)
      setEnriching(false)
      if (results.length === 0) {
        setFields((f) => ({ ...f, title }))
        setEnrichError('Aucun résultat BGG pour ce titre. Le titre a été pré-rempli.')
        return
      }
      setBggResults(results)
      setDisambigOpen(true)
    } catch (err) {
      setEnriching(false)
      setEnrichError('Erreur BGG : ' + err.message)
    }
  }

  async function applyEnrichment(data) {
    setFields({
      title: data.name ?? '',
      publisher: '',
      yearPublished: data.yearPublished ? String(data.yearPublished) : '',
      minPlayers: data.minPlayers ? String(data.minPlayers) : '',
      maxPlayers: data.maxPlayers ? String(data.maxPlayers) : '',
      minDuration: data.minPlayTime ? String(data.minPlayTime) : '',
      maxDuration: data.maxPlayTime ? String(data.maxPlayTime) : '',
      description: data.description ?? '',
    })
    if (data.image) {
      try {
        const file = await downloadBggCover(data.image)
        setCoverFile(file)
        setCoverPreview(URL.createObjectURL(file))
      } catch {}
    }
    if (data.name) {
      const { data: existing } = await supabase
        .from('game_catalog')
        .select('id, title')
        .ilike('title', data.name)
        .limit(1)
      if (existing?.length > 0) setDuplicateWarning(existing[0])
    }
  }

  async function handleScan(ean) {
    setScannerOpen(false)
    setScannedEan(ean)
    setShowFallback(false)
    setFallbackTitle('')
    setEnriching(true)
    setEnrichError(null)
    setDuplicateWarning(null)

    try {
      // 1. Philibert en priorité : EAN → page produit directe, pas de désambiguïsation
      const philibert = await lookupPhilibert(ean)
      if (philibert) {
        await applyEnrichment(philibert)
        setEnriching(false)
        return
      }

      // 2. Fallback : UPCitemdb → titre → Wikidata
      const rawTitle = await lookupUpc(ean)
      const cleaned = cleanTitle(rawTitle)
      if (!cleaned) {
        setEnriching(false)
        setShowFallback(true)
        return
      }
      setEnriching(false)
      await runBggSearch(cleaned)
    } catch {
      setEnriching(false)
      setShowFallback(true)
    }
  }

  async function handleFallbackSearch() {
    const title = fallbackTitle.trim()
    if (!title) return
    setShowFallback(false)
    await runBggSearch(title)
  }

  async function handleSelectBgg(game) {
    setDisambigOpen(false)

    if (!game) {
      // "Aucun" selected — pre-fill title from UPC if we have it
      if (searchedTitle) setFields((f) => ({ ...f, title: searchedTitle }))
      return
    }

    setEnriching(true)
    setEnrichError(null)

    try {
      // Wikidata : identité du jeu (nom canonique, année)
      const thing = await fetchBggThing(game.id)

      // Philibert : données produit plus complètes (description FR, joueurs, durée, image boîte)
      const philibert = await lookupPhilibert(thing.name || game.name)

      // Fusion : Philibert en priorité pour les données produit, Wikidata en fallback
      const enriched = {
        name: thing.name || game.name,
        yearPublished: thing.yearPublished,
        minPlayers: philibert?.minPlayers ?? thing.minPlayers,
        maxPlayers: philibert?.maxPlayers ?? thing.maxPlayers,
        minPlayTime: philibert?.minPlayTime ?? thing.minPlayTime,
        maxPlayTime: philibert?.maxPlayTime ?? thing.maxPlayTime,
        description: philibert?.description || thing.description,
        image: philibert?.image || thing.image,
      }

      await applyEnrichment(enriched)
    } catch (err) {
      setEnrichError('Erreur : ' + err.message)
    } finally {
      setEnriching(false)
    }
  }

  function openScanner() {
    setEnrichError(null)
    setDuplicateWarning(null)
    setFallbackTitle('')
    if (!isTouchDevice) {
      // Desktop : pas de caméra de scan, passer directement à la saisie BGG
      setShowFallback(true)
      return
    }
    setShowFallback(false)
    setScannerOpen(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Scan button */}
        <button
          type="button"
          onClick={openScanner}
          disabled={enriching}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-zinc-700 text-sm font-medium text-zinc-300 hover:border-amber-400/50 hover:text-amber-400 hover:bg-amber-400/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enriching ? (
            <>
              <Spinner className="w-4 h-4" />
              Recherche en cours…
            </>
          ) : isTouchDevice ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              Scanner un code-barres
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Rechercher sur BGG
            </>
          )}
        </button>

        {/* Fallback: EAN not in UPCitemdb → manual BGG search */}
        {showFallback && (
          <div className="flex flex-col gap-2 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
            <p className="text-xs text-zinc-400">
              {isTouchDevice
                ? 'Code-barre non reconnu — saisis le titre du jeu pour rechercher sur BGG :'
                : 'Recherche sur BGG par titre :'}
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={fallbackTitle}
                onChange={(e) => setFallbackTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFallbackSearch()}
                placeholder="Ex: Catan, Wingspan…"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors"
              />
              <Button type="button" onClick={handleFallbackSearch} disabled={!fallbackTitle.trim()}>
                Rechercher
              </Button>
            </div>
          </div>
        )}

        {/* Enrich feedback */}
        {enrichError && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            {enrichError}
          </p>
        )}
        {duplicateWarning && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            Ce jeu existe peut-être déjà dans le catalogue :{' '}
            <strong className="text-amber-300">{duplicateWarning.title}</strong>. Vérifie avant de créer.
          </p>
        )}

        <Input label="Titre *" value={fields.title} onChange={set('title')} placeholder="Nom du jeu" required autoFocus={!fields.title} />
        <Input label="Éditeur" value={fields.publisher} onChange={set('publisher')} placeholder="Ravensburger, Days of Wonder…" />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-300">Couverture</label>
          <div className="flex gap-3 items-center">
            {coverPreview ? (
              <img src={coverPreview} alt="preview" className="w-16 h-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18" />
                </svg>
              </div>
            )}
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              {coverPreview ? 'Changer' : 'Choisir une image'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Joueurs min *" type="number" min={1} max={20} placeholder="2" value={fields.minPlayers} onChange={set('minPlayers')} required />
          <Input label="Joueurs max *" type="number" min={1} max={20} placeholder="6" value={fields.maxPlayers} onChange={set('maxPlayers')} required />
          <Input label="Durée min (min)" type="number" min={1} placeholder="30" value={fields.minDuration} onChange={set('minDuration')} />
          <Input label="Durée max (min)" type="number" min={1} placeholder="90" value={fields.maxDuration} onChange={set('maxDuration')} />
          <Input label="Année" type="number" placeholder="2024" value={fields.yearPublished} onChange={set('yearPublished')} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-300">Description</label>
          <textarea
            value={fields.description}
            onChange={set('description')}
            rows={2}
            maxLength={2000}
            placeholder="Résumé du jeu…"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none transition-colors"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={isExtension}
              onChange={(e) => {
                setIsExtension(e.target.checked)
                if (!e.target.checked) setParentGame(null)
              }}
              className="rounded border-zinc-600 bg-zinc-800 text-amber-400 focus:ring-amber-400"
            />
            C'est une extension d'un autre jeu
          </label>
          {isExtension && (
            <div className="pl-6">
              <p className="text-xs text-zinc-500 mb-1.5">Jeu de base</p>
              <ParentGameSelector value={parentGame} onChange={setParentGame} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Statut dans ta collection</label>
          <StatusSelector value={status} onChange={setStatus} />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button
            type="submit"
            disabled={createGame.isPending || !fields.title.trim() || !fields.minPlayers || !fields.maxPlayers}
          >
            {createGame.isPending ? 'Création…' : 'Créer et ajouter'}
          </Button>
        </div>
      </form>

      {/* Scan modals — rendered outside the form to avoid z-index conflicts */}
      <BarcodeScannerModal
        open={scannerOpen}
        onScan={handleScan}
        onClose={() => setScannerOpen(false)}
      />

      <BggDisambiguationModal
        open={disambigOpen}
        ean={scannedEan}
        searchTitle={searchedTitle}
        results={bggResults}
        onSelect={handleSelectBgg}
        onClose={() => setDisambigOpen(false)}
      />
    </>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AddGameModal({ open, onClose, collectionGameIds = new Set() }) {
  const [tab, setTab] = useState('search')

  function handleClose() {
    setTab('search')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Ajouter un jeu">
      <div className="flex border-b border-zinc-800 mb-4 -mx-4 px-4">
        {[
          { id: 'search', label: 'Catalogue' },
          { id: 'create', label: 'Nouveau jeu' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`pb-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'search' ? (
        <SearchTab collectionGameIds={collectionGameIds} onClose={handleClose} />
      ) : (
        <CreateTab onClose={handleClose} />
      )}
    </Modal>
  )
}
