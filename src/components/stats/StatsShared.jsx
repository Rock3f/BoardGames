export function StatCard({ label, value, sub }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-3xl font-bold text-zinc-100 tabular-nums">{value ?? '—'}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

export function formatTime(minutes) {
  if (!minutes) return '0h'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function formatHour(h) {
  if (h === undefined || h === null) return '—'
  const hStr = String(h).padStart(2, '0')
  return `${hStr}h–${String((h + 1) % 24).padStart(2, '0')}h`
}

export const chartTheme = {
  stroke: '#f59e0b',
  grid: '#27272a',
  text: '#71717a',
}

export function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="font-bold text-amber-400">{payload[0].value} partie{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

export function WinRateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1 truncate max-w-40">{label}</p>
      <p className="font-bold text-amber-400">{payload[0].value}% victoires</p>
    </div>
  )
}
