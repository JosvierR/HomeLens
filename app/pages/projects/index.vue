<script setup lang="ts">
interface ProjectRow {
  id: string
  name: string
  status: string
  updated_at: string
}

const { configured, user, refresh, signOut } = useAuth()
const projects = ref<ProjectRow[]>([])
const name = ref('')
const errorMessage = ref<string | null>(null)
const loading = ref(false)

const load = async () => {
  await refresh()
  if (!user.value) return
  loading.value = true
  errorMessage.value = null
  try {
    projects.value = (await $fetch<{ projects: ProjectRow[] }>('/api/projects')).projects
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not load projects.'
  } finally {
    loading.value = false
  }
}

const createProject = async () => {
  errorMessage.value = null
  try {
    await $fetch('/api/projects', { method: 'POST', body: { name: name.value.trim() } })
    name.value = ''
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not create project.'
  }
}

onMounted(load)
</script>

<template>
  <main class="projects-page">
    <AppHeader />
    <div class="page-container">
      <header class="page-head">
        <div>
          <p class="section-label">Your workspace</p>
          <h1>Projects</h1>
          <p>Save real scans privately. The public demo remains available without signing in.</p>
        </div>
        <div class="head-actions">
          <NuxtLink to="/analysis" class="button button--secondary">Try demo</NuxtLink>
          <button v-if="user" type="button" class="button button--secondary" @click="signOut">Sign out</button>
          <NuxtLink v-else to="/auth/sign-in" class="button">Sign in</NuxtLink>
        </div>
      </header>

      <p v-if="!configured" class="notice">Supabase is not configured. Demo mode still works.</p>
      <p v-else-if="!user" class="notice">
        <NuxtLink to="/auth/sign-in">Sign in</NuxtLink> to create and reopen saved projects.
      </p>

      <form v-if="user" class="create-row" @submit.prevent="createProject">
        <input v-model="name" required maxlength="120" placeholder="Project name" aria-label="Project name">
        <button class="button" type="submit">New project</button>
      </form>

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <p v-if="loading" class="notice">Loading…</p>

      <ul v-if="projects.length" class="project-list">
        <li v-for="project in projects" :key="project.id">
          <NuxtLink :to="`/projects/${project.id}`">
            <strong>{{ project.name }}</strong>
            <span>{{ new Date(project.updated_at).toLocaleString() }}</span>
          </NuxtLink>
        </li>
      </ul>
      <p v-else-if="user && !loading" class="notice">No projects yet.</p>
    </div>
  </main>
</template>

<style scoped>
.projects-page { padding-bottom: 80px; }
.page-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  margin: 28px 0 24px;
}
h1 {
  margin: 4px 0 8px;
  font-size: clamp(1.6rem, 3vw, 2rem);
  letter-spacing: -0.03em;
}
.page-head p { margin: 0; color: var(--text-secondary); max-width: 42rem; }
.head-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: start; }
.create-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.create-row input {
  min-height: 42px;
  min-width: min(100%, 280px);
  flex: 1;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.project-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--border);
}
.project-list li { border-bottom: 1px solid var(--border); }
.project-list a {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  color: inherit;
}
.project-list span { color: var(--text-secondary); font-size: 0.85rem; }
.notice { color: var(--text-secondary); }
.error { color: #9b2c2c; }
</style>
