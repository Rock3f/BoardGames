import { useNavigate } from 'react-router-dom'
import { useMyChampionships } from '../../hooks/useChampionships'
import { ChampionshipCard } from '../../components/championships/ChampionshipCard'
import { Spinner } from '../../components/ui/Spinner'

export default function ChampionshipsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useMyChampionships()

  const drafts = data?.filter(c => c.status === 'draft') ?? []
  const active = data?.filter(c => c.status === 'active') ?? []
  const closed = data?.filter(c => c.status === 'closed') ?? []

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Championnats</h1>
        <span className="text-sm text-zinc-500">{data?.length ?? 0} au total</span>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>}

      {!isLoading && !data?.length && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
          <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5M7.5 18.75v-4.5M3 5.25h18M5.25 5.25v7.5a6.75 6.75 0 0013.5 0v-7.5" />
          </svg>
          <p className="text-sm">Aucun championnat</p>
          <button onClick={() => navigate('/championships/new')} className="text-sm text-amber-400 hover:underline">
            Créer le premier championnat
          </button>
        </div>
      )}

      {active.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">En cours</h2>
          {active.map(c => <ChampionshipCard key={c.id} championship={c} />)}
        </section>
      )}

      {drafts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">En préparation</h2>
          {drafts.map(c => <ChampionshipCard key={c.id} championship={c} />)}
        </section>
      )}

      {closed.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Terminés</h2>
          {closed.map(c => <ChampionshipCard key={c.id} championship={c} />)}
        </section>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/championships/new')}
        aria-label="Nouveau championnat"
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 rounded-full bg-amber-400 text-zinc-950 shadow-lg hover:bg-amber-300 transition-colors flex items-center justify-center z-30"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  )
}
