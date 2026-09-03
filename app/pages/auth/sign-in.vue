<script setup lang="ts">
const email = ref('')
const code = ref('')
const step = ref<'email' | 'code'>('email')
const router = useRouter()
const {
  configured,
  loading,
  authError,
  signInWithOtp,
  verifyEmailOtp,
  user,
  refresh,
  pendingEmail
} = useAuth()

onMounted(async () => {
  await refresh()
  if (pendingEmail.value) {
    email.value = pendingEmail.value
    step.value = 'code'
  }
})

watch(user, (next) => {
  if (next) router.replace('/projects')
})

const sendCode = async () => {
  const ok = await signInWithOtp(email.value.trim())
  if (ok) {
    step.value = 'code'
    code.value = ''
  }
}

const verifyCode = async () => {
  const ok = await verifyEmailOtp(email.value.trim(), code.value.trim())
  if (ok) await router.replace('/projects')
}

const changeEmail = () => {
  step.value = 'email'
  code.value = ''
}
</script>

<template>
  <main class="auth-page page-container">
    <AppHeader />
    <section class="auth-card">
      <p class="brand-mark">HomeLens</p>
      <h1>Sign in to save real scans</h1>
      <p class="lede">
        We’ll email you a 6-digit code. The public demo still works without an account.
      </p>

      <p v-if="!configured" class="notice" role="status">
        Persistence is not configured in this environment. You can still use Try demo.
      </p>

      <p v-else-if="user" class="notice" role="status">
        Signed in. <NuxtLink to="/projects">Open projects</NuxtLink>
      </p>

      <form v-else-if="step === 'email'" class="auth-form" @submit.prevent="sendCode">
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
        <button class="button" type="submit" :disabled="loading || !configured">
          {{ loading ? 'Sending…' : 'Send sign-in code' }}
        </button>
      </form>

      <form v-else class="auth-form" @submit.prevent="verifyCode">
        <p class="notice" role="status">
          Enter the 6-digit code we sent to <strong>{{ email }}</strong>.
        </p>
        <label>
          Sign-in code
          <input
            v-model="code"
            class="code-input"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9 ]*"
            maxlength="8"
            required
            placeholder="123456"
            aria-describedby="code-hint"
          >
        </label>
        <p id="code-hint" class="hint">6-digit code from your email</p>
        <button class="button" type="submit" :disabled="loading || code.trim().length < 6">
          {{ loading ? 'Checking…' : 'Verify code' }}
        </button>
        <div class="secondary-actions">
          <button type="button" class="text-button" :disabled="loading" @click="sendCode">
            Resend code
          </button>
          <button type="button" class="text-button" :disabled="loading" @click="changeEmail">
            Use a different email
          </button>
        </div>
      </form>

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
.lede, .notice, .secondary-links, .hint {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.5;
}
.hint {
  margin: -4px 0 0;
  font-size: 0.82rem;
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
.code-input {
  letter-spacing: 0.28em;
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
}
.error { color: #9b2c2c; }
.secondary-links { margin-top: 24px; }
.secondary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.text-button {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}
.text-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
