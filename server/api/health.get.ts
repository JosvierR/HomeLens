import { isSupabaseConfigured } from '../utils/supabase'
import { getRequestId } from '../utils/observability'

defineRouteMeta({
  openAPI: {
    tags: ['Health'],
    summary: 'Service health',
    description: 'Reports whether Supabase and the GPU inference worker are configured. Does not expose secrets.',
    responses: {
      200: { description: 'Process is up.' }
    }
  }
})

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  return {
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    hasSecretKey: Boolean(config.supabaseSecretKey),
    inferenceConfigured: Boolean(config.inferenceApiUrl && config.inferenceApiToken && config.inferenceCallbackSecret),
    requestId: getRequestId(event)
  }
})
