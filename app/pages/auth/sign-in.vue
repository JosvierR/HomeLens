<script setup lang="ts">
const email = ref('')
const sent = ref(false)
const { configured, loading, authError, signInWithOtp, user, refresh } = useAuth()

onMounted(() => { refresh() })

const submit = async () => {
  sent.value = false
  const ok = await signInWithOtp(email.value.trim())
  if (ok) sent.value = true
}
</script>

<template>
  <main class="auth-page page-container">
    <AppHeader />
    <section class="auth-card">
      <p class="brand-mark">HomeLens</p>
      <h1>Sign in to save real scans</h1>
      <p class="lede">
        The public demo stays available without an account. Sign in when you want private evidence,
        projects, and learning history.
      </p>

      <p v-if="!configured" class="notice" role="status">
        Persistence is not configured in this environment. You can still use Try demo.
      </p>

      <p v-else-if="user" class="notice" role="status">
        Signed in. <NuxtLink to="/projects">Open projects</NuxtLink>
      </p>

      <form v-else class="auth-form" @submit.prevent="submit">
        <label>
          Email
          <input v-model="email" type="email" required autocomplete="email" placeholder="you@example.com">
        </label>
        <button class="button" type="submit" :disabled="loading || !configured">
          {{ loading ? 'Sending…' : 'Email me a sign-in link' }}
        </button>
      </form>

      <p v-if="sent" class="notice" role="status">Check your email for the magic link.</p>
      <p v-if="authError" class="error" role="alert">{{ authError }}</p>

      <p class="secondary-links">
        <NuxtLink to="/analysis">Try demo</NuxtLink>
        ·
        <NuxtLink to="/">Back home</NuxtLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  padding-block: 40px 80px;
}
.auth-card {
  max-width: 420px;
  margin-top: 28px;
}
.brand-mark {
  margin: 0 0 8px;
  font-size: 0.85rem;
  font-weight: 650;
  letter-spacing: -0.02em;
}
h1 {
  margin: 0 0 10px;
  font-size: clamp(1.6rem, 3vw, 2rem);
  letter-spacing: -0.03em;
}
.lede, .notice, .secondary-links {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.5;
}
.auth-form {
  display: grid;
  gap: 12px;
  margin-top: 20px;
}
label {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
}
input {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.error { color: #9b2c2c; }
.secondary-links { margin-top: 24px; }
</style>
