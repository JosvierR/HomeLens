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
  const code = typeof route.query.code === 'string' ? route.query.code : null
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      status.value = error.message
      return
    }
  } else {
    await supabase.auth.getSession()
  }
  await router.replace('/projects')
})
</script>

<template>
  <main class="page-container" style="padding:48px 0">
    <p>{{ status }}</p>
  </main>
</template>
