<script setup lang="ts">
const email = ref('')
const password = ref('')
const mode = ref<'signin' | 'signup'>('signin')
const notice = ref<string | null>(null)
const router = useRouter()
const {
  configured,
  loading,
  authError,
  signInWithPassword,
  signUpWithPassword,
  user,
  refresh
} = useAuth()

onMounted(async () => {
  await refresh()
})

watch(user, (next) => {
  if (next) router.replace('/projects')
})

const submit = async () => {
  notice.value = null
  const cleanEmail = email.value.trim().toLowerCase()
  const cleanPassword = password.value
  if (cleanPassword.length < 6) {
    notice.value = 'Use at least 6 characters for the password.'
    return
  }

  if (mode.value === 'signin') {
    const ok = await signInWithPassword(cleanEmail, cleanPassword)
    if (ok) await router.replace('/projects')
    return
  }

  const result = await signUpWithPassword(cleanEmail, cleanPassword)
  if (!result.ok) return
  if (result.needsConfirmation) {
    notice.value = 'Account created. If email confirmation is enabled, open the email then sign in here with the same password.'
    mode.value = 'signin'
    return
  }
  await router.replace('/projects')
}
</script>

<template>
  <main class="auth-page page-container">
    <AppHeader />
    <section class="auth-card">
      <p class="brand-mark">HomeLens</p>
      <h1>{{ mode === 'signin' ? 'Sign in' : 'Create account' }}</h1>
      <p class="lede">
        Demo login with email and password. No magic link. The public demo still works without an account.
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
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
          >
        </label>
        <label>
          Password
          <input
            v-model="password"
            type="password"
            required
            minlength="6"
            autocomplete="current-password"
            placeholder="At least 6 characters"
          >
        </label>
        <button class="button" type="submit" :disabled="loading || !configured">
          {{ loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account' }}
        </button>
        <button
          type="button"
          class="text-button"
          :disabled="loading"
          @click="mode = mode === 'signin' ? 'signup' : 'signin'; notice = null"
        >
          {{ mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in' }}
        </button>
      </form>

      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
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
.text-button {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.text-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
