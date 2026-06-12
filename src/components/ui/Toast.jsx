import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

const typeStyles = {
  success: 'bg-emerald-900 border-emerald-700 text-emerald-100',
  error:   'bg-red-900 border-red-700 text-red-100',
  info:    'bg-zinc-800 border-zinc-700 text-zinc-100',
}

function ToastItem({ id, message, type, onRemove }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 shadow-lg text-sm animate-in ${typeStyles[type]}`}>
      <span className="flex-1">{message}</span>
      <button onClick={() => onRemove(id)} className="opacity-60 hover:opacity-100 shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => remove(id), 4000)
  }, [remove])

  const toast = {
    success: (msg) => add(msg, 'success'),
    error:   (msg) => add(msg, 'error'),
    info:    (msg) => add(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-20 sm:bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          {toasts.map((t) => (
            <ToastItem key={t.id} {...t} onRemove={remove} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
