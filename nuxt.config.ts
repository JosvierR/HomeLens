export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'HomeLens',
      meta: [
        {
          name: 'description',
          content: 'Confidence-aware home measurement and HVAC planning prototype.'
        }
      ]
    }
  },
  runtimeConfig: {
    public: {
      posthogKey: process.env.NUXT_PUBLIC_POSTHOG_KEY || '',
      posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
    }
  }
})
