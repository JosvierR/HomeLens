import type { H3Event } from 'h3'
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { appendHeader, getHeader, setHeader } from 'h3'

export const isSupabaseConfigured = () => {
  const config = useRuntimeConfig()
  return Boolean(config.public.supabaseUrl && config.public.supabasePublishableKey)
}

export const createUserSupabaseClient = (event: H3Event): SupabaseClient => {
  const config = useRuntimeConfig()
  if (!config.public.supabaseUrl || !config.public.supabasePublishableKey) {
    throw createError({ statusCode: 503, statusMessage: 'Supabase is not configured.' })
  }

  return createServerClient(
    config.public.supabaseUrl,
    config.public.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(getHeader(event, 'cookie') ?? '')
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            appendHeader(event, 'Set-Cookie', serializeCookieHeader(name, value, options))
          }
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              setHeader(event, key, value)
            }
          }
        }
      }
    }
  )
}

/** Privileged client — only when SUPABASE_SECRET_KEY is set. Never ship to browser. */
export const createServiceSupabaseClient = (): SupabaseClient | null => {
  const config = useRuntimeConfig()
  const url = config.supabaseUrl || config.public.supabaseUrl
  const secret = config.supabaseSecretKey
  if (!url || !secret) return null
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
