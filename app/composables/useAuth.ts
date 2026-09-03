import type { User, Session } from '@supabase/supabase-js'

export const useAuth = () => {
  const { configured, getClient } = useSupabase()
  const user = useState<User | null>('auth-user', () => null)
  const session = useState<Session | null>('auth-session', () => null)
  const loading = useState('auth-loading', () => false)
  const authError = useState<string | null>('auth-error', () => null)

  const refresh = async () => {
    if (!configured) {
      user.value = null
      session.value = null
      return null
    }
    loading.value = true
    authError.value = null
    try {
      const supabase = getClient()
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      session.value = data.session
      user.value = data.session?.user ?? null
      return data.session
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Authentication failed.'
      user.value = null
      session.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  /** Silent demo session so the camera flow works without a login screen. */
  const ensureGuestSession = async () => {
    if (!configured) return null
    const existing = await refresh()
    if (existing?.user) return existing
    loading.value = true
    authError.value = null
    try {
      const supabase = getClient()
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      session.value = data.session
      user.value = data.session?.user ?? data.user ?? null
      return data.session
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Could not start the demo session.'
      return null
    } finally {
      loading.value = false
    }
  }

  const signInWithPassword = async (email: string, password: string) => {
    if (!configured) throw new Error('Supabase is not configured.')
    loading.value = true
    authError.value = null
    try {
      const supabase = getClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      session.value = data.session
      user.value = data.session?.user ?? data.user ?? null
      return Boolean(data.session)
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Could not sign in.'
      return false
    } finally {
      loading.value = false
    }
  }

  const signUpWithPassword = async (email: string, password: string) => {
    if (!configured) throw new Error('Supabase is not configured.')
    loading.value = true
    authError.value = null
    try {
      const supabase = getClient()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      session.value = data.session
      user.value = data.session?.user ?? data.user ?? null
      if (data.session) return { ok: true as const, needsConfirmation: false }
      return { ok: true as const, needsConfirmation: true }
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Could not create the account.'
      return { ok: false as const, needsConfirmation: false }
    } finally {
      loading.value = false
    }
  }

  const signOut = async () => {
    if (!configured) return
    const supabase = getClient()
    await supabase.auth.signOut()
    user.value = null
    session.value = null
  }

  if (import.meta.client && configured) {
    const supabase = getClient()
    supabase.auth.onAuthStateChange((_event, next) => {
      session.value = next
      user.value = next?.user ?? null
    })
  }

  return {
    configured,
    user,
    session,
    loading,
    authError,
    refresh,
    ensureGuestSession,
    signInWithPassword,
    signUpWithPassword,
    signOut
  }
}
