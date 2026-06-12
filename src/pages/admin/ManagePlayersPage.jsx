import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  useAllProvisionedPlayers,
  useCreateProvisionedPlayer,
  useLinkProvisionedPlayer,
  useUnlinkProvisionedPlayer,
  useDeleteProvisionedPlayer,
  usePlayerSearch,
} from '../../hooks/usePlayers'
import { useToast } from '../../components/ui/Toast'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'

function useDebounce(value, delay = 350) {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t) }, [value, delay])
  return d
}

function PlayerInitials({ name }) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  return (
    <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-sm font-semibold shrink-0">
      {initials}
    </div>
  )
}

// ── Unlinked player card ──────────────────────────────────────────────────────

function UnlinkedCard({ player, isOwner, isLinking, linkQuery, setLinkQuery, searchResults, searchFetching, onStartLink, onCancelLink, onLink, onDelete, linkPending }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <PlayerInitials name={player.username} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{player.username}</p>
          <p className="text-xs text-zinc-500">Pas de compte associé</p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={isLinking ? onCancelLink : onStartLink}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                isLinking
                  ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  : 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
              }`}
            >
              {isLinking ? 'Annuler' : 'Lier →'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
              title="Supprimer ce profil"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {isLinking && (
        <div className="border-t border-zinc-800 p-4 flex flex-col gap-2 bg-zinc-800/40">
          <p className="text-xs text-zinc-400">Rechercher le compte à associer :</p>
          <div className="relative">
            <Input
              value={linkQuery}
              onChange={e => setLinkQuery(e.target.value)}
              placeholder="Pseudo du compte…"
              autoFocus
            />
            {linkQuery.length >= 2 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden max-h-44 overflow-y-auto">
                {searchFetching && <div className="flex justify-center py-3"><Spinner /></div>}
                {!searchFetching && searchResults.length === 0 && (
                  <p className="text-xs text-zinc-500 px-3 py-3">Aucun compte trouvé</p>
                )}
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onLink(u.id)}
                    disabled={linkPending}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0 overflow-hidden">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (u.username?.[0] ?? '?').toUpperCase()
                      }
                    </div>
                    <span className="text-sm text-zinc-100 truncate">{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-600">
            Une fois lié, ce joueur aura accès à l'historique des parties jouées sous ce profil.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Linked player card ────────────────────────────────────────────────────────

function LinkedCard({ player, isOwner, onUnlink, onDelete, unlinkPending }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
      <PlayerInitials name={player.username} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100 truncate">{player.username}</p>
        <p className="text-xs flex items-center gap-1">
          <span className="text-emerald-400">●</span>
          <span className="text-zinc-400">
            {player.linked_profile?.username
              ? `Lié à @${player.linked_profile.username}`
              : 'Lié à un compte'}
          </span>
        </p>
      </div>
      {isOwner && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onUnlink}
            disabled={unlinkPending}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            Délier
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-zinc-600 hover:text-red-400 transition-colors p-1"
            title="Supprimer ce profil"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagePlayersPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { session } = useAuth()
  const currentUserId = session?.user?.id

  const { data: players, isLoading } = useAllProvisionedPlayers()
  const createPlayer = useCreateProvisionedPlayer()
  const linkPlayer = useLinkProvisionedPlayer()
  const unlinkPlayer = useUnlinkProvisionedPlayer()
  const deletePlayer = useDeleteProvisionedPlayer()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameError, setNewNameError] = useState('')
  const [linkingId, setLinkingId] = useState(null)
  const [linkQuery, setLinkQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const dLinkQuery = useDebounce(linkQuery)
  const { data: searchData, isFetching: searchFetching } = usePlayerSearch(dLinkQuery)

  async function handleCreate() {
    const name = newName.trim()
    if (name.length < 2) { setNewNameError('Le pseudo doit faire au moins 2 caractères.'); return }
    if (name.length > 30) { setNewNameError('Le pseudo doit faire au plus 30 caractères.'); return }
    setNewNameError('')
    try {
      await createPlayer.mutateAsync({ username: name })
      setNewName('')
      setShowCreate(false)
      toast.success('Profil créé.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleLink(provisionedId, userId) {
    try {
      await linkPlayer.mutateAsync({ id: provisionedId, linkedUserId: userId })
      setLinkingId(null)
      setLinkQuery('')
      toast.success('Profil lié au compte.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleUnlink(id) {
    try {
      await unlinkPlayer.mutateAsync(id)
      toast.success('Lien supprimé.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDelete(id) {
    try {
      await deletePlayer.mutateAsync(id)
      setConfirmDeleteId(null)
      toast.success('Profil supprimé.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const unlinked = players?.filter(p => !p.linked_user_id) ?? []
  const linked = players?.filter(p => p.linked_user_id) ?? []

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-zinc-100 flex-1">Gestion des joueurs</h1>
        <button
          type="button"
          onClick={() => { setShowCreate(v => !v); setNewName(''); setNewNameError('') }}
          className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau
        </button>
      </div>

      {/* Explanation */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-500 leading-relaxed">
        Les profils sans compte permettent d'enregistrer des parties pour des joueurs qui n'ont pas encore créé de compte.
        Lorsqu'ils s'inscrivent, vous pouvez lier leur compte à leur profil pour qu'ils accèdent à leur historique.
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-zinc-900 border border-amber-400/30 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-zinc-200">Créer un profil sans compte</p>
          <Input
            label="Pseudo *"
            value={newName}
            onChange={e => { setNewName(e.target.value); setNewNameError('') }}
            placeholder="Prénom Nom ou pseudo"
            maxLength={30}
            error={newNameError}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => { setShowCreate(false); setNewName(''); setNewNameError('') }}
              disabled={createPlayer.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createPlayer.isPending || newName.trim().length < 2}
            >
              {createPlayer.isPending
                ? <span className="flex items-center gap-2"><Spinner className="w-4 h-4" />Création…</span>
                : 'Créer'}
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !players?.length && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
          <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <p className="text-sm">Aucun profil créé</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-sm text-amber-400 hover:underline"
          >
            Créer le premier profil
          </button>
        </div>
      )}

      {/* Unlinked players */}
      {unlinked.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-1">
            Sans compte — {unlinked.length}
          </p>
          {unlinked.map(player => (
            <UnlinkedCard
              key={player.id}
              player={player}
              isOwner={player.created_by === currentUserId}
              isLinking={linkingId === player.id}
              linkQuery={linkQuery}
              setLinkQuery={setLinkQuery}
              searchResults={searchData?.users ?? []}
              searchFetching={searchFetching}
              onStartLink={() => { setLinkingId(player.id); setLinkQuery('') }}
              onCancelLink={() => { setLinkingId(null); setLinkQuery('') }}
              onLink={userId => handleLink(player.id, userId)}
              onDelete={() => setConfirmDeleteId(player.id)}
              linkPending={linkPlayer.isPending}
            />
          ))}
        </div>
      )}

      {/* Linked players */}
      {linked.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-1">
            Liés à un compte — {linked.length}
          </p>
          {linked.map(player => (
            <LinkedCard
              key={player.id}
              player={player}
              isOwner={player.created_by === currentUserId}
              onUnlink={() => handleUnlink(player.id)}
              onDelete={() => setConfirmDeleteId(player.id)}
              unlinkPending={unlinkPlayer.isPending}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (() => {
        const target = players?.find(p => p.id === confirmDeleteId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4">
              <div>
                <p className="font-semibold text-zinc-100 mb-1">
                  Supprimer « {target?.username} » ?
                </p>
                <p className="text-xs text-zinc-400">
                  Ce profil sera définitivement supprimé. Les parties auxquelles il a participé
                  pourraient perdre l'affichage de ce joueur.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(confirmDeleteId)}
                  disabled={deletePlayer.isPending}
                >
                  {deletePlayer.isPending ? 'Suppression…' : 'Supprimer'}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
