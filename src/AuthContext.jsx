import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

// Tracks the login_history row id for THIS browser tab's session, so the
// matching sign-out can fill in logout_at on the same row. sessionStorage
// survives page refreshes but clears when the tab/window is closed, so a
// refresh doesn't create a duplicate "login".
const LOGIN_ROW_KEY = 'crm_login_history_id'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error) setProfile(data)
    return data
  }

  async function recordLogin(userId) {
  if (sessionStorage.getItem(LOGIN_ROW_KEY)) return
  // Set a placeholder synchronously (before the await below) so that if
  // getSession().then() and onAuthStateChange both call recordLogin at
  // almost the same time, the second call sees this immediately and
  // bails out instead of inserting a duplicate row.
  sessionStorage.setItem(LOGIN_ROW_KEY, 'pending')
  const { data, error } = await supabase
    .from('login_history')
    .insert({ user_id: userId })
    .select('id')
    .single()
  if (!error && data) sessionStorage.setItem(LOGIN_ROW_KEY, data.id)
  else sessionStorage.removeItem(LOGIN_ROW_KEY)
}

  async function recordLogout() {
    const rowId = sessionStorage.getItem(LOGIN_ROW_KEY)
    if (!rowId) return
    sessionStorage.removeItem(LOGIN_ROW_KEY)
    await supabase.from('login_history').update({ logout_at: new Date().toISOString() }).eq('id', rowId)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        await loadProfile(session.user.id)
        await recordLogin(session.user.id)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (session?.user) {
          await loadProfile(session.user.id)
          if (event === 'SIGNED_IN') await recordLogin(session.user.id)
        } else {
          setProfile(null)
          if (event === 'SIGNED_OUT') await recordLogout()
        }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await recordLogout()
    await supabase.auth.signOut()
  }

  const value = { session, profile, loading, signOut, refreshProfile: () => session?.user && loadProfile(session.user.id) }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
