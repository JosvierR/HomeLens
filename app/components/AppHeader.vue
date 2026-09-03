<script setup lang="ts">
const route = useRoute()

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Scan', to: '/scan' },
  { label: 'Analysis', to: '/analysis' }
]
</script>

<template>
  <header class="app-header">
    <div class="page-container header-inner">
      <NuxtLink to="/" class="brand" aria-label="HomeLens home">
        <svg class="brand-mark" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M7.5 14.5 18 7l10.5 7.5v14H7.5z" />
          <path d="M12 17.5h12M18 12v12" />
          <circle cx="18" cy="18" r="2.1" />
        </svg>
        <span>HomeLens</span>
      </NuxtLink>

      <nav class="main-nav" aria-label="Primary navigation">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ 'nav-link--active': route.path === item.to }"
          :aria-current="route.path === item.to ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <NuxtLink to="/scan" class="button button--small header-action">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
        <span class="header-action-label">New scan</span>
        <span class="header-action-short">Scan</span>
      </NuxtLink>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  z-index: 20;
  border-bottom: 1px solid var(--color-border);
  background: rgb(251 251 248 / 94%);
  backdrop-filter: blur(14px);
}

.header-inner {
  display: grid;
  min-height: 68px;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
}

.brand {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 10px;
  font-size: 0.98rem;
  font-weight: 720;
  letter-spacing: -0.02em;
}

.brand-mark {
  width: 31px;
  height: 31px;
}

.brand-mark path:first-child {
  fill: var(--color-ink);
  stroke: none;
}

.brand-mark path:nth-child(2) {
  fill: none;
  stroke: #fff;
  stroke-linecap: round;
  stroke-width: 1;
}

.brand-mark circle {
  fill: var(--color-accent-soft);
}

.main-nav {
  display: flex;
  align-items: center;
  gap: 3px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 3px;
  background: var(--color-canvas);
}

.nav-link {
  min-width: 70px;
  border-radius: 7px;
  padding: 7px 12px;
  color: var(--color-muted);
  font-size: 0.81rem;
  font-weight: 620;
  text-align: center;
  transition: background-color 160ms ease, color 160ms ease;
}

.nav-link:hover {
  color: var(--color-ink);
}

.nav-link--active {
  background: var(--color-surface-raised);
  box-shadow: 0 1px 3px rgb(24 32 31 / 8%);
  color: var(--color-ink);
}

.header-action {
  justify-self: end;
}

.header-action svg {
  width: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.5;
}

.header-action-short {
  display: none;
}

@media (max-width: 720px) {
  .header-inner {
    grid-template-columns: 1fr auto;
  }

  .main-nav {
    display: none;
  }
}

@media (max-width: 374px) {
  .header-action-label {
    display: none;
  }

  .header-action-short {
    display: inline;
  }
}
</style>
