const statusStyles = {
  owned:    'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  lent:     'bg-orange-900/50 text-orange-400 border-orange-800',
  borrowed: 'bg-purple-900/50 text-purple-400 border-purple-800',
  wishlist: 'bg-blue-900/50 text-blue-400 border-blue-800',
  sold:     'bg-zinc-800 text-zinc-400 border-zinc-700',
}

const statusLabels = {
  owned:    'Possédé',
  lent:     'Prêté',
  borrowed: 'Emprunté',
  wishlist: 'Wishlist',
  sold:     'Vendu',
}

export function Badge({ status, children, className = '' }) {
  const style = statusStyles[status] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
  const label = children ?? statusLabels[status] ?? status

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  )
}
