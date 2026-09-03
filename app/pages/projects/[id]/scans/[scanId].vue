<script setup lang="ts">
const route = useRoute()
const { user, refresh } = useAuth()
const scanId = computed(() => String(route.params.scanId))
const payload = ref<Record<string, unknown> | null>(null)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  await refresh()
  if (!user.value) return
  try {
    payload.value = await $fetch<Record<string, unknown>>(`/api/scans/${scanId.value}` as string)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not load scan.'
  }
})
</script>

<template>
  <main class="page-container" style="padding:28px 0 80px">
    <AppHeader />
    <h1>Saved scan</h1>
    <p v-if="!user"><NuxtLink to="/auth/sign-in">Sign in</NuxtLink> to restore this scan.</p>
    <p v-else-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <pre v-else-if="payload" style="overflow:auto;font-size:0.8rem;background:var(--surface);padding:16px;border:1px solid var(--border);border-radius:8px">{{ JSON.stringify(payload, null, 2) }}</pre>
    <p v-else>Loading persisted scan state…</p>
  </main>
</template>
