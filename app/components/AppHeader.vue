<script setup lang="ts">
const route = useRoute()
const { configured, user, refresh } = useAuth()
onMounted(() => { if (configured) refresh() })
</script>

<template>
  <header class="app-header">
    <div class="page-container header-inner">
      <NuxtLink to="/" class="brand" aria-label="HomeLens home">
        <svg class="brand-mark" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M7.5 14.5 18 7l10.5 7.5v14H7.5z" />
          <path d="M12 17.5h12M18 12v12" />
        </svg>
        <span>HomeLens</span>
      </NuxtLink>

      <nav class="header-nav" aria-label="Primary">
        <NuxtLink v-if="configured" to="/projects" class="header-action">Projects</NuxtLink>
        <NuxtLink v-if="configured && !user" to="/auth/sign-in" class="header-action">Sign in</NuxtLink>
        <NuxtLink v-if="route.path !== '/scan'" to="/scan" class="header-action">New scan</NuxtLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  border-bottom: 1px solid var(--border);
  background: var(--canvas);
}

.header-inner {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 620;
  letter-spacing: -0.015em;
}

.brand-mark {
  width: 22px;
  height: 22px;
}

.brand-mark path:first-child {
  fill: var(--text-primary);
  stroke: none;
}

.brand-mark path:nth-child(2) {
  fill: none;
  stroke: var(--canvas);
  stroke-linecap: round;
  stroke-width: 1;
}

.header-nav {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.header-action {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  color: var(--text-secondary);
  font-size: 0.84rem;
  transition: color 140ms ease;
}

.header-action:hover {
  color: var(--text-primary);
}
</style>
