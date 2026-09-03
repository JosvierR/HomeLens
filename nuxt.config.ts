const environment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env ?? {}

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devServer: {
    host: '127.0.0.1',
    port: 3000
  },
  app: {
    head: {
      title: 'HomeLens',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          name: 'description',
          content: 'HomeLens estimates room geometry from visual evidence and carries the uncertainty forward. It asks a human to verify only the measurement that can change the result.'
        }
      ]
    }
  },
  runtimeConfig: {
    // Server-only. Never expose via NUXT_PUBLIC_*.
    // Override with NUXT_SUPABASE_SECRET_KEY / NUXT_SUPABASE_URL, or SUPABASE_* aliases.
    supabaseSecretKey: environment.NUXT_SUPABASE_SECRET_KEY || environment.SUPABASE_SECRET_KEY || '',
    supabaseUrl: environment.NUXT_SUPABASE_URL || environment.SUPABASE_URL || '',
    inferenceApiUrl: environment.NUXT_INFERENCE_API_URL || environment.INFERENCE_API_URL || '',
    inferenceApiToken: environment.NUXT_INFERENCE_API_TOKEN || environment.INFERENCE_API_TOKEN || '',
    inferenceCallbackSecret: environment.NUXT_INFERENCE_CALLBACK_SECRET || environment.INFERENCE_CALLBACK_SECRET || '',
    publicSiteUrl: environment.NUXT_PUBLIC_SITE_URL || environment.PUBLIC_SITE_URL || '',
    public: {
      supabaseUrl: environment.NUXT_PUBLIC_SUPABASE_URL || '',
      supabasePublishableKey: environment.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
      posthogKey: '',
      posthogHost: 'https://us.i.posthog.com'
    }
  }
})
