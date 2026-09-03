import { isSupabaseConfigured } from '../utils/supabase'
import { getRequestId } from '../utils/observability'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  return {
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    hasSecretKey: Boolean(config.supabaseSecretKey),
    requestId: getRequestId(event)
  }
})
