import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const CALENDAR_WIDTH = 280
const CALENDAR_HEIGHT = 340 // estimation max

function formatDisplay(value) {
  if (!value) return null
  const [y, m, d] = value.split('-')
  return `${parseInt(d)} ${MONTHS_FR[parseInt(m) - 1]} ${y}`
}

function getCalendarDays(year, month) {
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function CalendarPanel({ triggerRect, value, onChange, onClose }) {
  const panelRef = useRef(null)

  // Position : en dessous du trigger par défaut, au-dessus si manque de place
  const spaceBelow = window.innerHeight - triggerRect.bottom
  const openAbove = spaceBelow < CALENDAR_HEIGHT + 8 && triggerRect.top > CALENDAR_HEIGHT + 8

  let top = openAbove
    ? triggerRect.top - CALENDAR_HEIGHT - 8
    : triggerRect.bottom + 8

  // Alignement horizontal : calé à gauche du trigger, décalé si ça déborde à droite
  let left = triggerRect.left
  if (left + CALENDAR_WIDTH > window.innerWidth - 8) {
    left = window.innerWidth - CALENDAR_WIDTH - 8
  }

  // Fermer au clic extérieur
  useEffect(() => {
    function handleDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [onClose])

  // Fermer à l'Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const today = new Date()
  const parsed = value ? value.split('-').map(Number) : null

  const [viewYear, setViewYear] = useState(parsed?.[0] ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.[1] ?? today.getMonth() + 1)

  const cells = getCalendarDays(viewYear, viewMonth)
  const todayInView = today.getFullYear() === viewYear && today.getMonth() + 1 === viewMonth
  const selInView = parsed && parsed[0] === viewYear && parsed[1] === viewMonth

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  function selectDay(day) {
    const m = String(viewMonth).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
    onClose()
  }
  function goToday() {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
    onClose()
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top, left, width: CALENDAR_WIDTH, zIndex: 9999 }}
      className="bg-zinc-800 border border-zinc-700 rounded-2xl p-3 shadow-2xl"
    >
      {/* Navigation mois */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-100 capitalize select-none">
          {MONTHS_FR[viewMonth - 1]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_FR.map(d => (
          <div key={d} className="text-center text-xs text-zinc-600 font-medium py-1 select-none">{d}</div>
        ))}
      </div>

      {/* Grille des jours */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isSelected = selInView && day === parsed[2]
          const isToday = todayInView && day === today.getDate()
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectDay(day)}
              className={`w-full aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-amber-400 text-zinc-950 font-bold'
                  : isToday
                    ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                    : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Raccourci aujourd'hui */}
      <div className="mt-2 pt-2 border-t border-zinc-700 flex justify-center">
        <button type="button" onClick={goToday}
          className="text-xs text-zinc-500 hover:text-amber-400 transition-colors py-0.5">
          Aujourd'hui
        </button>
      </div>
    </div>,
    document.body
  )
}

// value: 'YYYY-MM-DD' | ''
// onChange: (value: string) => void
export function DatePicker({ label, value, onChange, placeholder = 'Choisir une date' }) {
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [triggerRect, setTriggerRect] = useState(null)

  function handleOpen() {
    if (open) { setOpen(false); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) { setTriggerRect(rect); setOpen(true) }
  }

  function clear(e) {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-zinc-400">{label}</label>}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition-colors ${
          open
            ? 'border-amber-400 bg-zinc-800'
            : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
        }`}
      >
        <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
        </svg>
        <span className={`flex-1 ${value ? 'text-zinc-100' : 'text-zinc-600'}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <span role="button" onClick={clear}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>

      {open && triggerRect && (
        <CalendarPanel
          triggerRect={triggerRect}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
