export function Spinner({ className = '' }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400 w-5 h-5 ${className}`}
    />
  )
}
