<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { configured, getClient } = useSupabase()
const status = ref('Completing sign-in…')

onMounted(async () => {
  if (!configured) {
    status.value = 'Supabase is not configured.'
    return
  }

  const supabase = getClient()

  try {
    const code = typeof route.query.code === 'string' ? route.query.code : null
    const tokenHash = typeof route.query.token_hash === 'string' ? route.query.token_hash : null
    const type = typeof route.query.type === 'string' ? route.query.type : 'email'

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
    } else if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'email' | 'magiclink' | 'signup' | 'invite' | 'recovery' | 'email_change'
      })
      if (error) throw error
    } else if (import.meta.client && window.location.hash.includes('access_token')) {
      // Implicit fragment fallback from older email links
      await supabase.auth.getSession()
    } else {
      await supabase.auth.getSession()
    }

    status.value = 'Signed in. Opening projects…'
    await router.replace('/projects')
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Sign-in failed.'
  }
})
</script>

<template>
  <main class="page-container" style="padding:48px 0">
    <p>{{ status }}</p>
    <p v-if="status !== 'Completing sign-in…' && status !== 'Signed in. Opening projects…'">
      <NuxtLink to="/auth/sign-in">Back to sign in</NuxtLink>
    </p>
  </main>
</template>
