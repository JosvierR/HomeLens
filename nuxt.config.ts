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
        {
          name: 'description',
          content: 'Decision confidence for physical-world measurements. HomeLens shows which uncertainty can change a downstream decision, then asks a human to verify only what matters.'
        }
      ]
    }
  },
  runtimeConfig: {
    // Server-only. Never expose via NUXT_PUBLIC_*.
    supabaseSecretKey: '',
    supabaseUrl: '',
    public: {
      supabaseUrl: '',
      supabasePublishableKey: '',
      posthogKey: '',
      posthogHost: 'https://us.i.posthog.com'
    }
  }
})
