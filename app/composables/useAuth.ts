import type { User, Session } from '@supabase/supabase-js'

export const useAuth = () => {
  const { configured, getClient } = useSupabase()
  const user = useState<User | null>('auth-user', () => null)
  const session = useState<Session | null>('auth-session', () => null)
  const loading = useState('auth-loading', () => false)
  const authError = useState<string | null>('auth-error', () => null)
  const pendingEmail = useState<string | null>('auth-pending-email', () => null)

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

  const signInWithOtp = async (email: string) => {
    if (!configured) throw new Error('Supabase is not configured.')
    loading.value = true
    authError.value = null
    try {
      const supabase = getClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true
        }
      })
      if (error) throw error
      pendingEmail.value = email
      return true
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Could not send sign-in code.'
      return false
    } finally {
      loading.value = false
    }
  }

  const verifyEmailOtp = async (email: string, token: string) => {
    if (!configured) throw new Error('Supabase is not configured.')
    loading.value = true
    authError.value = null
    try {
      const supabase = getClient()
      const cleaned = token.replace(/\s+/g, '')
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: cleaned,
        type: 'email'
      })
      if (error) throw error
      session.value = data.session
      user.value = data.session?.user ?? data.user ?? null
      pendingEmail.value = null
      return Boolean(data.session)
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'That code did not work. Try again.'
      return false
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
    pendingEmail.value = null
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
    pendingEmail,
    refresh,
    signInWithOtp,
    verifyEmailOtp,
    signOut
  }
}
