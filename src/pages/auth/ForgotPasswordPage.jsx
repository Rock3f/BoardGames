import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

export default function ForgotPasswordPage() {
  const { resetPasswordEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await resetPasswordEmail(email)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-amber-400 mb-8 text-center tracking-tight">
          BoardGames
        </h1>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="text-3xl">📬</div>
              <p className="text-zinc-100 font-semibold">Email envoyé</p>
              <p className="text-sm text-zinc-400">
                Un lien de réinitialisation a été envoyé à <span className="text-zinc-200">{email}</span>.
                Vérifie ta boîte mail.
              </p>
              <Link to="/login" className="text-sm text-amber-400 hover:underline mt-2">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">Mot de passe oublié</h2>
              <p className="text-sm text-zinc-500 mb-6">
                Saisis ton adresse email pour recevoir un lien de réinitialisation.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  required
                  autoComplete="email"
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm">
                <Link to="/login" className="text-zinc-500 hover:text-amber-400 transition-colors">
                  ← Retour à la connexion
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
