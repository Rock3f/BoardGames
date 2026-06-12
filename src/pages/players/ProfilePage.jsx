import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

// Strip query string from a URL to get the clean storage path
function stripQuery(url) {
  try { return new URL(url).pathname.split('/user-avatars/')[1] ?? null } catch { return null }
}

async function uploadAvatar(userId, file, oldAvatarUrl) {
  const compress = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 400, useWebWorker: false })
  const ext = file.name.split('.').pop().toLowerCase() || 'jpg'
  const path = `${userId}.${ext}`

  // Remove previous avatar only if extension changed (clean up old file)
  if (oldAvatarUrl) {
    const oldPath = stripQuery(oldAvatarUrl)
    if (oldPath && oldPath !== path) {
      await supabase.storage.from('user-avatars').remove([oldPath])
    }
  }

  const { error } = await supabase.storage
    .from('user-avatars')
    .upload(path, compress, { upsert: true, contentType: compress.type || 'image/jpeg' })
  if (error) throw error

  const { data } = supabase.storage.from('user-avatars').getPublicUrl(path)
  // Return clean URL (no query string) — cache-busting is done at display time
  return data.publicUrl
}

function AvatarDisplay({ src, initials, cacheBust = 0, size = 'lg' }) {
  const dim = size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-12 h-12 text-lg'
  const displaySrc = src ? `${src}${cacheBust ? `?t=${cacheBust}` : ''}` : null
  return (
    <div className={`${dim} rounded-full bg-amber-400/20 overflow-hidden flex items-center justify-center text-amber-400 font-bold shrink-0`}>
      {displaySrc
        ? <img src={displaySrc} alt="Avatar" className="w-full h-full object-cover" />
        : <span>{initials}</span>
      }
    </div>
  )
}

export default function ProfilePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { session, profile, signOut, updateProfile } = useAuth()
  const fileRef = useRef(null)

  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  // Bump after successful avatar upload to force browser cache refresh
  const [avatarCacheBust, setAvatarCacheBust] = useState(0)

  const initials = (profile?.username ?? session?.user?.email ?? '?')[0].toUpperCase()

  function startEditing() {
    setUsername(profile?.username ?? '')
    setAvatarPreview(null)
    setAvatarFile(null)
    setUsernameError('')
    setEditing(true)
  }

  function cancelEditing() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(null)
    setAvatarFile(null)
    setEditing(false)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Fichier image requis.'); return }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarFile(file)
    e.target.value = ''
  }

  async function handleSave() {
    const trimmed = username.trim()
    if (trimmed.length < 2 || trimmed.length > 30) {
      setUsernameError('Le pseudo doit faire entre 2 et 30 caractères.')
      return
    }
    setUsernameError('')
    setSaving(true)
    try {
      let newAvatarUrl = undefined
      if (avatarFile) {
        newAvatarUrl = await uploadAvatar(session.user.id, avatarFile, profile?.avatar_url)
      }

      await updateProfile({
        username: trimmed,
        ...(newAvatarUrl !== undefined ? { avatarUrl: newAvatarUrl } : {}),
      })

      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
      setAvatarFile(null)
      setEditing(false)
      if (newAvatarUrl) setAvatarCacheBust(Date.now())
      toast.success('Profil mis à jour !')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto flex flex-col gap-5">
      <h1 className="text-xl font-bold text-zinc-100">Profil</h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-5">
        {!editing ? (
          /* ── View mode ── */
          <div className="flex items-center gap-4">
            <AvatarDisplay src={profile?.avatar_url} initials={initials} cacheBust={avatarCacheBust} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100 truncate text-lg">
                {profile?.username ?? 'Utilisateur'}
              </p>
              <p className="text-sm text-zinc-400 truncate">{session?.user?.email}</p>
            </div>
            <Button variant="secondary" onClick={startEditing}>
              Modifier
            </Button>
          </div>
        ) : (
          /* ── Edit mode ── */
          <div className="flex flex-col gap-5">
            {/* Avatar picker */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative group shrink-0"
                title="Changer l'avatar"
              >
                <AvatarDisplay
                  src={avatarPreview ?? profile?.avatar_url}
                  initials={initials}
                  cacheBust={avatarPreview ? 0 : avatarCacheBust}
                />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
              </button>
              <div className="min-w-0">
                <p className="text-sm text-zinc-300 font-medium">Photo de profil</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-amber-400 hover:underline mt-0.5"
                >
                  {avatarFile ? avatarFile.name : 'Choisir une image…'}
                </button>
                <p className="text-xs text-zinc-600 mt-0.5">JPG, PNG ou WebP · max 500 Ko</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Username */}
            <Input
              label="Pseudo *"
              value={username}
              onChange={e => { setUsername(e.target.value); setUsernameError('') }}
              placeholder="Entre 2 et 30 caractères"
              maxLength={30}
              error={usernameError}
            />

            {/* Email (read-only) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-400">E-mail</label>
              <p className="text-sm text-zinc-500 px-3 py-2 bg-zinc-800/50 rounded-xl border border-zinc-800">
                {session?.user?.email}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={cancelEditing} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? <span className="flex items-center gap-2"><Spinner className="w-4 h-4" />Enregistrement…</span>
                  : 'Enregistrer'
                }
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Administration */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-400">Administration</h2>
        <button
          type="button"
          onClick={() => navigate('/admin/players')}
          className="flex items-center gap-3 rounded-xl px-4 py-3 bg-zinc-800 hover:bg-zinc-700 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-100">Gestion des joueurs</p>
            <p className="text-xs text-zinc-500">Créer des profils et lier des comptes</p>
          </div>
          <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">Compte</h2>
        <Button variant="danger" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    </div>
  )
}
