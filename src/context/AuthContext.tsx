import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isManager: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data && !error) {
        setProfile(data)
        localStorage.setItem('wjs_profile', JSON.stringify(data))
        return
      }
    } catch {
      // network error — fall through to cached profile
    }
    const cached = localStorage.getItem('wjs_profile')
    if (cached) {
      try { setProfile(JSON.parse(cached)) } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    // 4-second timeout so the app doesn't hang indefinitely when offline
    const offlineTimer = setTimeout(() => {
      const cached = localStorage.getItem('wjs_profile')
      if (cached) {
        try { setProfile(JSON.parse(cached)) } catch { /* ignore */ }
      }
      setLoading(false)
    }, 4000)

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(offlineTimer)
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    }).catch(() => {
      clearTimeout(offlineTimer)
      const cached = localStorage.getItem('wjs_profile')
      if (cached) {
        try { setProfile(JSON.parse(cached)) } catch { /* ignore */ }
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    localStorage.removeItem('wjs_profile')
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id)
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'safety_officer'
  const isManager = profile?.role === 'manager'

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, isAdmin, isManager, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
