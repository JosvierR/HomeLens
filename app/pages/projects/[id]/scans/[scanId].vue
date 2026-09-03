<script setup lang="ts">
import type { RoomScan } from '~/types/scan'
import type { PhotoEstimationStatusResponse } from '~~/shared/photo-estimation-api'

interface SavedScanPayload {
  scan: Record<string, unknown> & {
    id: string
    room_id: string
    status: string
    created_at: string
    measurement_model_version?: string
    windows_count?: number
    doors_count?: number
    accepted_frame_count?: number
    device_family?: string
    rooms?: { name?: string, room_type?: string | null, project_id?: string } | Array<{ name?: string, room_type?: string | null, project_id?: string }> | null
  }
  measurements: Array<Record<string, unknown>>
  captureEvidence: Array<Record<string, unknown>>
}

const route = useRoute()
const { user, refresh } = useAuth()
const { replaceScan } = useDemoScan()
const scanId = computed(() => String(route.params.scanId))
const payload = ref<SavedScanPayload | null>(null)
const errorMessage = ref<string | null>(null)
const loading = ref(true)

const roomRecord = computed(() => {
  const rooms = payload.value?.scan.rooms
  return Array.isArray(rooms) ? rooms[0] : rooms
})
const readyEvidence = computed(() => payload.value?.captureEvidence.filter(item => item.status === 'ready' && item.accepted).length ?? 0)
const canAnalyze = computed(() => {
  const current = payload.value
  if (!current || !['estimated', 'ready_for_analysis', 'needs_verification', 'stable', 'completed'].includes(current.scan.status)) return false
  const keys = new Set(current.measurements.map(item => String(item.measurement_key)))
  return ['width', 'length', 'height'].every(key => keys.has(key))
})

const load = async () => {
  loading.value = true
  await refresh()
  if (!user.value) {
    loading.value = false
    return
  }
  try {
    payload.value = await $fetch<SavedScanPayload>(`/api/scans/${scanId.value}`)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not load scan.'
  } finally {
    loading.value = false
  }
}

const openAnalysis = async () => {
  if (!payload.value || !canAnalyze.value) return
  try {
    const status = await $fetch<PhotoEstimationStatusResponse>(`/api/scans/${scanId.value}/estimation`)
    if (!status.scan) throw new Error('This scan does not have all three supported dimensions.')
    const restored: RoomScan = {
      ...status.scan,
      roomName: roomRecord.value?.name ?? status.scan.roomName,
      windows: Number(payload.value.scan.windows_count ?? 0),
      doors: Number(payload.value.scan.doors_count ?? 0)
    }
    replaceScan(restored)
    await navigateTo('/analysis')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not reconstruct this scan.'
  }
}

onMounted(load)
</script>

<template>
  <main class="saved-scan page-container">
    <AppHeader />
    <NuxtLink to="/projects" class="back-link">← Projects</NuxtLink>

    <section v-if="!user && !loading" class="saved-state">
      <h1>Sign in to open this scan</h1>
      <p>Your saved camera evidence and measurements are private.</p>
      <NuxtLink to="/auth/sign-in" class="button">Sign in</NuxtLink>
    </section>

    <section v-else-if="errorMessage" class="saved-state">
      <h1>Scan unavailable</h1>
      <p role="alert">{{ errorMessage }}</p>
      <button type="button" class="button button--secondary" @click="load">Try again</button>
    </section>

    <section v-else-if="payload" class="saved-state">
      <p class="section-label">Saved camera scan</p>
      <h1>{{ roomRecord?.name ?? 'Saved room' }}</h1>
      <p>{{ payload.scan.status === 'completed' ? 'Capture and measurements complete.' : 'This scan is not complete yet.' }}</p>

      <dl class="scan-facts">
        <div><dt>Camera views</dt><dd>{{ readyEvidence }}</dd></div>
        <div><dt>Measurements</dt><dd>{{ payload.measurements.length }}</dd></div>
        <div><dt>Status</dt><dd>{{ payload.scan.status }}</dd></div>
      </dl>

      <button v-if="canAnalyze" type="button" class="button" @click="openAnalysis">Open scenario analysis</button>
      <NuxtLink
        v-else
        :to="roomRecord?.project_id ? `/scan?projectId=${roomRecord.project_id}&scanId=${scanId}&roomId=${payload.scan.room_id}` : '/projects'"
        class="button button--secondary"
      >{{ roomRecord?.project_id ? 'Continue capture' : 'Back to projects' }}</NuxtLink>
    </section>

    <p v-else class="loading-state" role="status">Loading saved scan…</p>
  </main>
</template>

<style scoped>
.saved-scan { padding-bottom: 80px; }
.back-link { display: inline-block; margin-top: 24px; color: var(--text-secondary); font-size: 0.82rem; }
.saved-state { max-width: 620px; margin-top: 28px; }
.saved-state h1 { margin: 6px 0 0; font-size: clamp(1.7rem, 4vw, 2.3rem); letter-spacing: -0.04em; }
.saved-state > p:not(.section-label) { color: var(--text-secondary); }
.scan-facts { display: grid; grid-template-columns: repeat(3, 1fr); margin: 24px 0; border: 1px solid var(--border); border-radius: var(--radius-media); }
.scan-facts div { display: grid; gap: 4px; padding: 14px; }
.scan-facts div + div { border-left: 1px solid var(--border); }
.scan-facts dt { color: var(--text-tertiary); font-size: 0.74rem; }
.scan-facts dd { margin: 0; font-size: 1rem; font-weight: 620; }
.loading-state { margin-top: 36px; color: var(--text-secondary); }
@media (max-width: 520px) {
  .scan-facts { grid-template-columns: 1fr; }
  .scan-facts div + div { border-top: 1px solid var(--border); border-left: 0; }
}
</style>
