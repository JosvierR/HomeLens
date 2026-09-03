import type { H3Event } from 'h3'
import type { User } from '@supabase/supabase-js'
import { createUserSupabaseClient, isSupabaseConfigured } from './supabase'
import { ApiContractError } from './api-contract'

export const requireUser = async (event: H3Event): Promise<{ user: User, supabase: ReturnType<typeof createUserSupabaseClient> }> => {
  if (!isSupabaseConfigured()) {
    throw new ApiContractError(503, 'SERVICE_UNAVAILABLE', 'Persistence is not configured on this environment.')
  }
  const supabase = createUserSupabaseClient(event)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new ApiContractError(401, 'UNAUTHORIZED', 'Sign in to continue.')
  }
  return { user: data.user, supabase }
}

export const optionalUser = async (event: H3Event) => {
  if (!isSupabaseConfigured()) return null
  try {
    const supabase = createUserSupabaseClient(event)
    const { data } = await supabase.auth.getUser()
    return data.user ?? null
  } catch {
    return null
  }
}
