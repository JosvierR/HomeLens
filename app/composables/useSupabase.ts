import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export const useSupabase = () => {
  const config = useRuntimeConfig()
  const configured = Boolean(config.public.supabaseUrl && config.public.supabasePublishableKey)

  const getClient = () => {
    if (!configured) {
      throw new Error('Supabase is not configured. Set NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
    }
    if (import.meta.server) {
      return createBrowserClient(
        config.public.supabaseUrl,
        config.public.supabasePublishableKey
      )
    }
    browserClient ??= createBrowserClient(
      config.public.supabaseUrl,
      config.public.supabasePublishableKey
    )
    return browserClient
  }

  return {
    configured,
    getClient
  }
}
