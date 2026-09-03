<script setup lang="ts">
const route = useRoute()
const { user, refresh } = useAuth()
const projectId = computed(() => String(route.params.id))
const rooms = ref<Array<{ id: string, name: string, room_type: string | null }>>([])
const projectName = ref('Project')
const roomName = ref('Living Room')
const errorMessage = ref<string | null>(null)
const latestScanId = ref<string | null>(null)

const load = async () => {
  await refresh()
  if (!user.value) return
  errorMessage.value = null
  try {
    const exported = await $fetch<{
      project: { name: string }
      rooms: Array<{ id: string, name: string, room_type: string | null }>
      scans: Array<{ id: string, created_at: string }>
    }>(`/api/projects/${projectId.value}/export`)
    projectName.value = exported.project.name
    rooms.value = exported.rooms
    latestScanId.value = exported.scans.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.id ?? null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not load project.'
  }
}

const createRoom = async () => {
  try {
    await $fetch('/api/rooms', {
      method: 'POST',
      body: { projectId: projectId.value, name: roomName.value.trim(), roomType: 'living_room' }
    })
    await load()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not create room.'
  }
}

const startScan = async (roomId: string) => {
  try {
    const result = await $fetch<{ scan: { id: string } }>('/api/scans', {
      method: 'POST',
      body: { roomId, captureMode: 'camera' }
    })
    await navigateTo(`/scan?projectId=${projectId.value}&scanId=${result.scan.id}&roomId=${roomId}`)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not start scan.'
  }
}

const removeProject = async () => {
  if (!confirm('Delete this project, its scans, and private evidence?')) return
  await $fetch(`/api/projects/${projectId.value}`, { method: 'DELETE' })
  await navigateTo('/projects')
}

onMounted(load)
</script>

<template>
  <main class="page-container" style="padding-bottom:80px">
    <AppHeader />
    <header style="margin:28px 0 20px">
      <p class="section-label">Project</p>
      <h1>{{ projectName }}</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <a class="button button--secondary" :href="`/api/projects/${projectId}/export`" download>Export JSON</a>
        <button type="button" class="button button--secondary" @click="removeProject">Delete project</button>
      </div>
    </header>

    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <p v-if="!user">
      <NuxtLink to="/auth/sign-in">Sign in</NuxtLink> to open this project.
    </p>

    <section v-else>
      <form style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px" @submit.prevent="createRoom">
        <input v-model="roomName" required maxlength="120" placeholder="Room name" aria-label="Room name"
          style="min-height:42px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface)">
        <button class="button" type="submit">Create room</button>
      </form>

      <ul style="list-style:none;padding:0;margin:0">
        <li v-for="room in rooms" :key="room.id" style="display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div>
            <strong>{{ room.name }}</strong>
            <div style="color:var(--text-secondary);font-size:0.85rem">{{ room.room_type || 'Room' }}</div>
          </div>
          <button type="button" class="button" @click="startScan(room.id)">Start scan</button>
        </li>
      </ul>

      <p v-if="latestScanId" style="margin-top:20px">
        Latest scan:
        <NuxtLink :to="`/projects/${projectId}/scans/${latestScanId}`">{{ latestScanId }}</NuxtLink>
      </p>
    </section>
  </main>
</template>
