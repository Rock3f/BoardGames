import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export function BggDisambiguationModal({ open, ean, searchTitle, results, onSelect, onClose }) {
  const [selectedId, setSelectedId] = useState(null)

  if (!open) return null

  function handleContinue() {
    if (selectedId === '__manual__') {
      onSelect(null)
    } else {
      const game = results.find((r) => r.id === selectedId)
      if (game) onSelect(game)
    }
    setSelectedId(null)
  }

  function handleClose() {
    setSelectedId(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Quel jeu avez-vous scanné ?">
      <div className="flex flex-col gap-4">
        {/* Info banner */}
        <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
          {ean && <p className="text-xs text-zinc-500">Code-barres : {ean}</p>}
          <p className="text-xs text-zinc-400">
            Recherche pour :{' '}
            <span className="text-zinc-200 font-medium">"{searchTitle}"</span>
          </p>
        </div>

        {/* Results */}
        <div className="flex flex-col">
          {results.map((game) => {
            const active = selectedId === game.id
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => setSelectedId(game.id)}
                className={`flex items-center gap-3 py-3 px-2 text-left transition-colors rounded-xl ${
                  active ? 'bg-amber-400/10' : 'hover:bg-zinc-800/50'
                }`}
              >
                {/* Radio dot */}
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                    active ? 'border-amber-400 bg-amber-400' : 'border-zinc-600'
                  }`}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-zinc-100 truncate">
                    {game.name}
                  </span>
                  <span className="text-xs text-zinc-500 truncate block">
                    {[game.yearPublished, game.description].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            )
          })}

          {/* Manual / none option */}
          <button
            type="button"
            onClick={() => setSelectedId('__manual__')}
            className={`flex items-center gap-3 py-3 px-2 text-left transition-colors rounded-xl border-t border-zinc-800 mt-1 ${
              selectedId === '__manual__' ? 'bg-amber-400/10' : 'hover:bg-zinc-800/50'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                selectedId === '__manual__' ? 'border-amber-400 bg-amber-400' : 'border-zinc-600'
              }`}
            >
              {selectedId === '__manual__' && (
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
              )}
            </span>
            <span className="text-sm text-zinc-400 italic">
              Aucun de ces résultats — saisie manuelle
            </span>
          </button>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={handleContinue} disabled={!selectedId}>
            Continuer →
          </Button>
        </div>
      </div>
    </Modal>
  )
}
