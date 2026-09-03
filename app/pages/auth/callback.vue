<script setup lang="ts">
const router = useRouter()
const { refresh } = useAuth()

onMounted(async () => {
  await refresh()
  await router.replace('/auth/sign-in')
})
</script>

<template>
  <main class="page-container" style="padding:48px 0">
    <p>Redirecting to sign in…</p>
  </main>
</template>
