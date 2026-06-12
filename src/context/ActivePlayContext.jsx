import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ActivePlayContext = createContext(null)

export function ActivePlayProvider({ children }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [activePlay, setActivePlay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return }
    fetchActivePlay()
  }, [session?.user?.id])

  // Timer
  useEffect(() => {
    clearInterval(intervalRef.current)
    if (!activePlay?.started_at) return
    const tick = () =>
      setElapsed(Math.floor((Date.now() - new Date(activePlay.started_at).getTime()) / 1000))
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => clearInterval(intervalRef.current)
  }, [activePlay?.started_at])

  async function fetchActivePlay() {
    try {
      const { data } = await supabase
        .from('plays')
        .select('id, created_by, catalog_game_id, started_at, win_rule, championship_id, game:game_catalog(id, title, cover_url)')
        .eq('created_by', session.user.id)
        .is('ended_at', null)
        .limit(1)
        .maybeSingle()
      setActivePlay(data ?? null)
    } catch (_e) {
      // silently fail — offline or RLS
    } finally {
      setLoading(false)
    }
  }

  const notifyPlayStarted = useCallback((play) => {
    setActivePlay(play)
    qc.invalidateQueries({ queryKey: ['plays'] })
  }, [qc])

  const clearActivePlay = useCallback(() => {
    setActivePlay(null)
    qc.invalidateQueries({ queryKey: ['plays'] })
    qc.invalidateQueries({ queryKey: ['active-play'] })
  }, [qc])

  return (
    <ActivePlayContext.Provider value={{
      activePlay,
      loading,
      elapsed,
      notifyPlayStarted,
      clearActivePlay,
    }}>
      {children}
    </ActivePlayContext.Provider>
  )
}

export function useActivePlayCtx() {
  return useContext(ActivePlayContext)
}
