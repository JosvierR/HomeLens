<script setup lang="ts">
import { analyzeCaptureSession } from '~~/shared/capture-analysis'
import { assessFrameQuality } from '~~/shared/frame-quality'
import type { FrameQualityResult } from '~~/shared/frame-quality'
import type { RoomScan } from '~/types/scan'
import type { CapturedFrame } from '~/composables/useCamera'

interface CapturedView {
  frame: CapturedFrame
  quality: FrameQualityResult
  previewUrl: string
  evidenceId?: string
}

const router = useRouter()
const route = useRoute()
const { scan, replaceScan } = useDemoScan()
const { track } = useProductAnalytics()
const { user, refresh: refreshAuth } = useAuth()
const { uploadCapture } = useCaptureEvidence()
const {
  state: cameraState,
  stream,
  devices,
  errorMessage: cameraError,
  previewReady,
  startCamera,
  stopCamera,
  switchCamera,
  bindVideo,
  captureFrame,
  captureImageFile,
  videoEl
} = useCamera()

type CaptureMode = 'gate' | 'capturing' | 'details' | 'processing'
const mode = ref<CaptureMode>('gate')
const guidanceStep = ref(0)
const microFeedback = ref('')
const capturedFlash = ref(false)
const captureBusy = ref(false)
const usingNativeCamera = ref(false)
const submitError = ref<string | null>(null)
const nativeCaptureInput = ref<HTMLInputElement | null>(null)
const capturedViews = shallowRef<CapturedView[]>([])
const timers: ReturnType<typeof setTimeout>[] = []

const roomName = ref(scan.value.captureMethod === 'simulated-geometry' ? 'Scanned room' : scan.value.roomName)
const dimensions = reactive({ width: null as number | null, length: null as number | null, height: null as number | null })
const openings = reactive({ windows: 0, doors: 0 })

const queryValue = (value: unknown) => typeof value === 'string' && value ? value : null
const productContext = computed(() => {
  const projectId = queryValue(route.query.projectId)
  const scanId = queryValue(route.query.scanId)
  const roomId = queryValue(route.query.roomId)
  return projectId && scanId && roomId ? { projectId, scanId, roomId } : null
})

const guidance = [
  {
    title: 'Capture a room overview.',
    hint: 'Keep the full floor and at least two walls visible.',
    feedback: 'Overview accepted.',
    target: 'room_overview'
  },
  {
    title: 'Point toward the opposite corner.',
    hint: 'Hold the phone still and keep the floor edges in view.',
    feedback: 'Corner view accepted.',
    target: 'opposite_corner'
  },
  {
    title: 'Capture the ceiling edge.',
    hint: 'Include the top of two walls without pointing directly at a light.',
    feedback: 'Ceiling view accepted.',
    target: 'ceiling_edge'
  }
] as const

const currentGuidance = computed(() => guidance[Math.min(guidanceStep.value, guidance.length - 1)]!)
const lastCapturedView = computed(() => capturedViews.value.at(-1) ?? null)
const captureAssessment = computed(() => analyzeCaptureSession(capturedViews.value.map(view => ({
  targetType: view.frame.targetType,
  qualityBucket: view.quality.bucket,
  brightnessScore: view.quality.brightnessScore,
  sharpnessScore: view.quality.sharpnessScore,
  contrastScore: view.quality.contrastScore
}))))
const showCameraError = computed(() => ['denied', 'unavailable', 'error'].includes(cameraState.value))
const validMeasurements = computed(() => {
  const values = [dimensions.width, dimensions.length, dimensions.height]
  return values.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100)
    && Number.isInteger(openings.windows) && openings.windows >= 0 && openings.windows <= 100
    && Number.isInteger(openings.doors) && openings.doors >= 0 && openings.doors <= 100
    && roomName.value.trim().length > 0
})
const statusLine = computed(() => {
  if (mode.value === 'processing') return 'Saving evidence and analyzing scenarios…'
  if (mode.value === 'details') return 'Camera evidence complete'
  if (mode.value === 'capturing') return `Live capture · ${capturedViews.value.length} of ${guidance.length} accepted views`
  return 'Room capture'
})
const deviceFamily = computed(() => {
  if (!import.meta.client) return 'web-camera'
  const agent = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(agent)) return 'ios-mobile'
  if (/Android/i.test(agent)) return 'android-mobile'
  return 'web-camera'
})

const enableCamera = async () => {
  submitError.value = null
  microFeedback.value = ''
  usingNativeCamera.value = false
  await startCamera()
  if (cameraState.value !== 'active') return
  mode.value = 'capturing'
  await nextTick()
  const bound = await bindVideo(videoEl.value)
  if (!bound) microFeedback.value = cameraError.value ?? 'The preview could not start. Try the phone camera option.'
  track('scan_started', { captureMethod: 'camera' })
}

const openNativeCamera = () => {
  submitError.value = null
  usingNativeCamera.value = true
  stopCamera()
  mode.value = 'capturing'
  nextTick(() => nativeCaptureInput.value?.click())
}

const acceptFrame = (frame: CapturedFrame) => {
  const quality = assessFrameQuality({
    width: frame.width,
    height: frame.height,
    brightness: frame.brightness,
    sharpness: frame.sharpness,
    contrast: frame.contrast,
    shadowClipping: frame.shadowClipping,
    highlightClipping: frame.highlightClipping
  })
  if (quality.bucket === 'recapture_recommended') {
    microFeedback.value = `${quality.reason ?? 'This view is not clear enough'}. Hold still and try again.`
    return false
  }

  const existingIndex = capturedViews.value.findIndex(view => view.frame.targetType === frame.targetType)
  const nextView = { frame, quality, previewUrl: URL.createObjectURL(frame.blob) }
  const nextViews = [...capturedViews.value]
  if (existingIndex >= 0) {
    URL.revokeObjectURL(nextViews[existingIndex]!.previewUrl)
    nextViews.splice(existingIndex, 1, nextView)
  } else {
    nextViews.push(nextView)
  }
  capturedViews.value = nextViews
  capturedFlash.value = true
  microFeedback.value = currentGuidance.value.feedback
  timers.push(setTimeout(() => { capturedFlash.value = false }, 420))

  if (capturedViews.value.length >= guidance.length) {
    timers.push(setTimeout(() => {
      stopCamera()
      mode.value = 'details'
      microFeedback.value = ''
    }, 420))
  } else {
    guidanceStep.value = capturedViews.value.length
    timers.push(setTimeout(() => { microFeedback.value = '' }, 900))
  }
  return true
}

const captureCurrentView = async () => {
  if (captureBusy.value || mode.value !== 'capturing') return
  if (!stream.value) {
    openNativeCamera()
    return
  }
  captureBusy.value = true
  microFeedback.value = ''
  try {
    const frame = await captureFrame(currentGuidance.value.target)
    if (!frame) microFeedback.value = cameraError.value ?? 'The frame could not be captured. Try again.'
    else acceptFrame(frame)
  } finally {
    captureBusy.value = false
  }
}

const handleNativeCapture = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  captureBusy.value = true
  microFeedback.value = 'Checking this photo…'
  try {
    const frame = await captureImageFile(file, currentGuidance.value.target)
    if (!frame) microFeedback.value = cameraError.value ?? 'The photo could not be processed.'
    else acceptFrame(frame)
  } finally {
    captureBusy.value = false
  }
}

const changeCamera = async () => {
  if (captureBusy.value) return
  captureBusy.value = true
  microFeedback.value = 'Changing camera…'
  try {
    await switchCamera()
    await nextTick()
    await bindVideo(videoEl.value)
    microFeedback.value = cameraState.value === 'active' ? '' : (cameraError.value ?? 'The other camera could not start.')
  } finally {
    captureBusy.value = false
  }
}

const restartCapture = async () => {
  capturedViews.value.forEach(view => URL.revokeObjectURL(view.previewUrl))
  capturedViews.value = []
  guidanceStep.value = 0
  mode.value = 'gate'
  await enableCamera()
}

const buildRoomScan = (): RoomScan => {
  const createdAt = new Date().toISOString()
  const context = productContext.value
  return {
    id: context?.scanId ?? `camera_${crypto.randomUUID()}`,
    roomId: context?.roomId,
    roomName: roomName.value.trim(),
    createdAt,
    windows: openings.windows,
    doors: openings.doors,
    modelVersion: 'manual-entry-v1',
    captureMethod: 'camera',
    deviceFamily: deviceFamily.value,
    roomCategory: 'room',
    measurements: [
      { id: 'width', label: 'Width', value: dimensions.width!, unit: 'ft', confidence: 1, rawConfidence: 1, source: 'manual' },
      { id: 'length', label: 'Length', value: dimensions.length!, unit: 'ft', confidence: 1, rawConfidence: 1, source: 'manual' },
      { id: 'height', label: 'Ceiling height', value: dimensions.height!, unit: 'ft', confidence: 1, rawConfidence: 1, source: 'manual' }
    ]
  }
}

const completeCapture = async () => {
  if (mode.value !== 'details' || !validMeasurements.value || captureAssessment.value.status !== 'ready') return
  mode.value = 'processing'
  submitError.value = null
  const realScan = buildRoomScan()
  try {
    const context = productContext.value
    if (context) {
      await refreshAuth()
      if (!user.value) throw new Error('Your session expired. Sign in again before saving this scan.')
      for (const view of capturedViews.value) {
        if (view.evidenceId) continue
        view.evidenceId = await uploadCapture(view.frame, view.quality, {
          scanId: context.scanId,
          projectId: context.projectId,
          deviceFamily: deviceFamily.value
        })
      }
      await $fetch(`/api/scans/${context.scanId}/complete`, {
        method: 'POST',
        body: {
          roomName: realScan.roomName,
          measurements: realScan.measurements.map(measurement => ({
            key: measurement.id,
            label: measurement.label,
            value: measurement.value
          })),
          windows: realScan.windows,
          doors: realScan.doors,
          deviceFamily: deviceFamily.value,
          acceptedFrameCount: capturedViews.value.length
        }
      })
    }

    replaceScan(realScan)
    track('scan_completed', {
      measurementCount: realScan.measurements.length,
      unresolvedCount: 0,
      captureMethod: 'camera'
    })
    await router.push('/analysis')
  } catch (error) {
    mode.value = 'details'
    submitError.value = error instanceof Error ? error.message : 'The scan could not be saved. Your captured views are still here.'
  }
}

const loadProductRoom = async () => {
  const context = productContext.value
  if (!context) return
  await refreshAuth()
  if (!user.value) return
  try {
    const exported = await $fetch<{ rooms: Array<{ id: string, name: string }> }>(`/api/projects/${context.projectId}/export`)
    roomName.value = exported.rooms.find(room => room.id === context.roomId)?.name ?? roomName.value
  } catch {
    // The scan can still continue; the server verifies ownership on every write.
  }
}

watch(stream, async current => {
  if (!current || mode.value !== 'capturing') return
  await nextTick()
  await bindVideo(videoEl.value)
}, { flush: 'post' })

onMounted(loadProductRoom)

onBeforeUnmount(() => {
  timers.forEach(timer => clearTimeout(timer))
  stopCamera()
  capturedViews.value.forEach(view => URL.revokeObjectURL(view.previewUrl))
})
</script>

<template>
  <main class="scan-page">
    <header class="scan-header">
      <div class="scan-shell scan-header-inner">
        <NuxtLink :to="productContext ? `/projects/${productContext.projectId}` : '/'" class="back-link">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
          Back
        </NuxtLink>
        <div class="room-status">
          <h1>{{ roomName }}</h1>
          <p>{{ statusLine }}</p>
        </div>
        <div class="progress-readout numeric" aria-live="polite">
          <template v-if="mode === 'capturing'">{{ capturedViews.length }}/{{ guidance.length }}</template>
          <template v-else-if="mode === 'details'">Ready</template>
          <template v-else-if="mode === 'processing'">…</template>
          <template v-else>Start</template>
        </div>
      </div>
    </header>

    <div class="scan-shell scan-content">
      <section v-if="mode === 'gate'" class="permission-gate" aria-labelledby="camera-gate-title">
        <p class="eyebrow">Real camera capture</p>
        <h2 id="camera-gate-title">See the room through your phone camera.</h2>
        <p>The live preview uses the rear camera when available. HomeLens captures three still frames and never records audio.</p>

        <div v-if="cameraState === 'requesting_permission'" class="gate-status" role="status">Opening the camera…</div>

        <div v-else-if="showCameraError" class="gate-error" role="alert">
          <p><strong>{{ cameraError || 'Camera access is blocked.' }}</strong></p>
          <p>You can retry the live preview or use the phone's native camera below.</p>
        </div>

        <div class="gate-actions">
          <button
            type="button"
            class="button"
            :disabled="cameraState === 'requesting_permission'"
            @click="enableCamera"
          >{{ showCameraError ? 'Try live camera again' : 'Open live camera' }}</button>
          <button type="button" class="button button--secondary native-camera-button" @click="openNativeCamera">
            Use phone camera
          </button>
        </div>
        <p class="privacy-note">
          Anonymous scans stay in this browser session. Signed-in project scans save accepted frames to private storage.
        </p>
      </section>

      <section v-else-if="mode === 'capturing'" class="capture-workspace" aria-labelledby="capture-surface-title">
        <div class="capture-canvas">
          <div class="canvas-topbar">
            <span class="live-label"><i aria-hidden="true" /> {{ stream ? (previewReady ? 'Live camera' : 'Starting preview') : 'Phone camera' }}</span>
            <button
              v-if="stream && devices.length > 1"
              type="button"
              class="camera-switch"
              :disabled="captureBusy"
              aria-label="Switch between front and rear cameras"
              @click="changeCamera"
            >Switch camera</button>
          </div>

          <h2 id="capture-surface-title" class="sr-only">Live room camera</h2>
          <video
            v-show="stream"
            ref="videoEl"
            class="camera-video"
            playsinline
            muted
            autoplay
          />
          <img
            v-if="!stream && lastCapturedView"
            class="camera-video camera-still"
            :src="lastCapturedView.previewUrl"
            alt="Most recently accepted room view"
          >
          <div v-else-if="!stream" class="camera-placeholder">
            <span>{{ captureBusy ? 'Checking photo…' : 'Open the phone camera for the next view.' }}</span>
          </div>

          <div class="frame-corner frame-corner--tl" aria-hidden="true" />
          <div class="frame-corner frame-corner--tr" aria-hidden="true" />
          <div class="frame-corner frame-corner--bl" aria-hidden="true" />
          <div class="frame-corner frame-corner--br" aria-hidden="true" />
          <div v-if="capturedFlash" class="capture-flash" role="status">View accepted</div>
        </div>

        <aside class="capture-guidance">
          <div class="guidance-main">
            <p class="guidance-kicker numeric">View {{ guidanceStep + 1 }} of {{ guidance.length }}</p>
            <h2>{{ currentGuidance.title }}</h2>
            <p>{{ currentGuidance.hint }}</p>
            <p v-if="microFeedback" class="micro-feedback" role="status">{{ microFeedback }}</p>
            <ol class="view-progress" aria-label="Capture progress">
              <li v-for="(step, index) in guidance" :key="step.target" :class="{ complete: index < capturedViews.length, current: index === guidanceStep }">
                <span aria-hidden="true">{{ index < capturedViews.length ? '✓' : index + 1 }}</span>
                {{ step.title.replace('Capture ', '').replace('Point ', '') }}
              </li>
            </ol>
          </div>

          <div class="guidance-actions">
            <button
              type="button"
              class="button capture-button"
              :disabled="captureBusy || (Boolean(stream) && !previewReady)"
              @click="captureCurrentView"
            >{{ captureBusy ? 'Checking…' : stream ? 'Capture this view' : 'Open phone camera' }}</button>
          </div>
        </aside>
      </section>

      <section v-else class="details-workspace" aria-labelledby="details-title">
        <div class="evidence-summary">
          <div class="evidence-heading">
            <div>
              <p class="eyebrow">Camera evidence</p>
              <h2 id="details-title">{{ captureAssessment.summary }}</h2>
            </div>
            <button v-if="mode !== 'processing'" type="button" class="text-button" @click="restartCapture">Retake views</button>
          </div>

          <div class="evidence-metrics">
            <div><strong>{{ capturedViews.length }}/{{ guidance.length }}</strong><span>views accepted</span></div>
            <div><strong>{{ Math.round(captureAssessment.coverage * 100) }}%</strong><span>required coverage</span></div>
            <div><strong>{{ Math.round(captureAssessment.qualityScore * 100) }}%</strong><span>visual quality</span></div>
          </div>

          <div class="evidence-strip">
            <figure v-for="(view, index) in capturedViews" :key="view.frame.targetType">
              <img :src="view.previewUrl" :alt="`Accepted camera view ${index + 1}`">
              <figcaption>
                <span>View {{ index + 1 }}</span>
                <span>{{ view.quality.bucket === 'good' ? 'Good' : 'Usable' }}</span>
              </figcaption>
            </figure>
          </div>
        </div>

        <form class="measurement-form" @submit.prevent="completeCapture">
          <div>
            <p class="eyebrow">Real measurements</p>
            <h2>Enter the values you measured.</h2>
            <p class="form-intro">Phone photos without depth or a scale reference cannot provide reliable absolute dimensions on every device. These values drive the scenario analysis.</p>
          </div>

          <label class="field field--wide">
            <span>Room name</span>
            <input v-model.trim="roomName" required maxlength="120" autocomplete="off">
          </label>

          <div class="dimension-fields">
            <label class="field">
              <span>Width <small>ft</small></span>
              <input v-model.number="dimensions.width" type="number" inputmode="decimal" min="0.1" max="100" step="0.1" required placeholder="12.5">
            </label>
            <label class="field">
              <span>Length <small>ft</small></span>
              <input v-model.number="dimensions.length" type="number" inputmode="decimal" min="0.1" max="100" step="0.1" required placeholder="16.0">
            </label>
            <label class="field">
              <span>Ceiling height <small>ft</small></span>
              <input v-model.number="dimensions.height" type="number" inputmode="decimal" min="0.1" max="100" step="0.1" required placeholder="9.0">
            </label>
          </div>

          <div class="opening-fields">
            <label class="field">
              <span>Windows</span>
              <input v-model.number="openings.windows" type="number" inputmode="numeric" min="0" max="100" step="1" required>
            </label>
            <label class="field">
              <span>Doors</span>
              <input v-model.number="openings.doors" type="number" inputmode="numeric" min="0" max="100" step="1" required>
            </label>
          </div>

          <p v-if="submitError" class="submit-error" role="alert">{{ submitError }}</p>
          <button type="submit" class="button capture-step" :disabled="mode === 'processing' || !validMeasurements">
            {{ mode === 'processing' ? 'Saving and analyzing…' : 'Analyze real scan' }}
          </button>
        </form>
      </section>
    </div>

    <input
      ref="nativeCaptureInput"
      class="sr-only"
      type="file"
      accept="image/*"
      capture="environment"
      aria-label="Capture a room photo with the phone camera"
      @change="handleNativeCapture"
    >
  </main>
</template>

<style scoped>
.scan-page {
  min-height: 100vh;
  background: #0f1615;
  color: #eef3f1;
}

.scan-shell {
  width: min(calc(100% - 40px), 1180px);
  margin-inline: auto;
}

.scan-header {
  border-bottom: 1px solid rgb(255 255 255 / 9%);
  background: #121918;
}

.scan-header-inner {
  display: grid;
  min-height: 64px;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
}

.back-link {
  display: inline-flex;
  width: fit-content;
  min-height: 44px;
  align-items: center;
  gap: 6px;
  color: #aab6b3;
  font-size: 0.82rem;
  font-weight: 560;
}

.back-link:hover { color: #fff; }
.back-link svg { width: 15px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }
.room-status { min-width: 0; text-align: center; }
.room-status h1 { margin: 0; overflow: hidden; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.012em; text-overflow: ellipsis; white-space: nowrap; }
.room-status p { margin: 2px 0 0; color: #8a9895; font-size: 0.76rem; }
.progress-readout { justify-self: end; color: #8a9895; font-size: 0.8rem; }
.scan-content { padding-block: 24px 40px; }

.permission-gate {
  max-width: 36rem;
  margin: 48px auto 0;
  padding: 8px 4px 24px;
}

.eyebrow { margin: 0 0 8px; color: #86b9ae; font-size: 0.72rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; }
.permission-gate h2,
.evidence-heading h2,
.measurement-form h2 { margin: 0; font-size: clamp(1.35rem, 3vw, 1.7rem); font-weight: 620; letter-spacing: -0.03em; line-height: 1.2; }
.permission-gate > p:not(.eyebrow, .privacy-note) { margin: 12px 0 0; color: #9aa8a4; font-size: 0.95rem; line-height: 1.55; }
.gate-status { margin-top: 20px; color: #9ccfc5; font-size: 0.88rem; }
.gate-error { margin-top: 18px; border-left: 2px solid #d9ae63; padding-left: 12px; color: #c8d2ce; font-size: 0.9rem; line-height: 1.5; }
.gate-error p { margin: 0; }
.gate-error p + p { margin-top: 4px; }
.gate-error strong { color: #fff; }
.gate-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
.gate-actions .button { min-height: 44px; }
.gate-actions .button--secondary { border-color: #43504d; background: #17201f; color: #eef3f1; }
.privacy-note { margin: 12px 0 0; color: #71807c; font-size: 0.76rem; line-height: 1.5; }

.capture-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 1px;
  overflow: hidden;
  border: 1px solid #2d3936;
  border-radius: var(--radius-media);
  background: #2d3936;
}

.capture-canvas {
  position: relative;
  min-width: 0;
  height: min(720px, calc(100svh - 140px));
  min-height: 460px;
  overflow: hidden;
  background: #050807;
}

.camera-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #050807; }
.camera-still { object-fit: contain; }
.camera-placeholder { position: absolute; inset: 0; display: grid; place-items: center; padding: 28px; color: #8d9c98; text-align: center; }
.canvas-topbar { position: absolute; z-index: 4; top: 14px; left: 14px; right: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; pointer-events: none; }
.live-label,
.camera-switch { border: 1px solid rgb(255 255 255 / 14%); border-radius: 999px; padding: 7px 10px; background: rgb(5 8 7 / 78%); color: #d4dfdc; font-size: 0.73rem; backdrop-filter: blur(8px); }
.live-label { display: inline-flex; align-items: center; gap: 6px; }
.live-label i { width: 6px; height: 6px; border-radius: 50%; background: #78d0bd; }
.camera-switch { min-height: 34px; cursor: pointer; pointer-events: auto; }
.camera-switch:disabled { opacity: 0.5; }

.frame-corner { position: absolute; z-index: 2; width: 34px; height: 34px; border-color: rgb(235 249 245 / 68%); pointer-events: none; }
.frame-corner--tl { top: 60px; left: 22px; border-top: 2px solid; border-left: 2px solid; }
.frame-corner--tr { top: 60px; right: 22px; border-top: 2px solid; border-right: 2px solid; }
.frame-corner--bl { bottom: 22px; left: 22px; border-bottom: 2px solid; border-left: 2px solid; }
.frame-corner--br { right: 22px; bottom: 22px; border-right: 2px solid; border-bottom: 2px solid; }
.capture-flash { position: absolute; z-index: 6; top: 50%; left: 50%; border: 1px solid #5a9b8d; border-radius: var(--radius-input); padding: 9px 15px; background: rgb(15 22 21 / 90%); color: #d7eee8; font-size: 0.86rem; transform: translate(-50%, -50%); animation: flash-in 160ms ease-out; }

.capture-guidance { display: flex; min-width: 0; flex-direction: column; padding: 22px 20px 18px; background: #17201f; }
.guidance-kicker { margin: 0; color: #7d8a86; font-size: 0.74rem; }
.guidance-main h2 { margin: 8px 0 0; font-size: 1.08rem; font-weight: 600; letter-spacing: -0.018em; line-height: 1.35; }
.guidance-main > p { margin: 8px 0 0; color: #9aa8a4; font-size: 0.86rem; line-height: 1.55; }
.micro-feedback { color: #a9ded2 !important; font-weight: 560; }
.view-progress { display: grid; gap: 9px; margin: 24px 0 0; padding: 18px 0 0; border-top: 1px solid #2b3835; list-style: none; }
.view-progress li { display: grid; grid-template-columns: 22px 1fr; align-items: start; color: #788682; font-size: 0.76rem; line-height: 1.35; }
.view-progress li span { display: grid; width: 16px; height: 16px; place-items: center; border: 1px solid #42504d; border-radius: 50%; font-size: 0.62rem; }
.view-progress li.current { color: #d9e3e0; }
.view-progress li.complete { color: #94c7bc; }
.view-progress li.complete span { border-color: #5d9186; }
.guidance-actions { display: grid; gap: 8px; margin-top: auto; padding-top: 24px; }
.capture-button { width: 100%; min-height: 46px; background: #e4eeeb; color: #13201d; }
.capture-button:hover { background: #fff; }
.capture-button:disabled { opacity: 0.45; }

.details-workspace { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr); overflow: hidden; border: 1px solid #2d3936; border-radius: var(--radius-media); background: #111817; }
.evidence-summary { min-width: 0; padding: 26px; border-right: 1px solid #2d3936; }
.evidence-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.evidence-heading h2 { max-width: 22ch; font-size: 1.35rem; }
.text-button { min-height: 34px; border: 0; padding: 0; background: transparent; color: #9ccfc5; cursor: pointer; font-size: 0.8rem; text-decoration: underline; text-underline-offset: 3px; }
.evidence-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 24px; overflow: hidden; border: 1px solid #2d3936; border-radius: 8px; background: #2d3936; }
.evidence-metrics div { display: grid; gap: 3px; padding: 13px; background: #17201f; }
.evidence-metrics strong { font-size: 1.1rem; font-weight: 620; }
.evidence-metrics span { color: #82908c; font-size: 0.7rem; }
.evidence-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
.evidence-strip figure { min-width: 0; margin: 0; overflow: hidden; border: 1px solid #2d3936; border-radius: 8px; background: #17201f; }
.evidence-strip img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.evidence-strip figcaption { display: flex; justify-content: space-between; gap: 8px; padding: 8px; color: #899793; font-size: 0.68rem; }
.evidence-strip figcaption span:last-child { color: #9ccfc5; }

.measurement-form { display: grid; align-content: start; gap: 18px; min-width: 0; padding: 26px; background: #17201f; }
.measurement-form h2 { font-size: 1.35rem; }
.form-intro { margin: 9px 0 0; color: #8f9d99; font-size: 0.82rem; line-height: 1.5; }
.dimension-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.opening-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.field { display: grid; gap: 6px; min-width: 0; color: #b5c1bd; font-size: 0.75rem; }
.field span { display: flex; justify-content: space-between; gap: 6px; }
.field small { color: #75837f; font-size: inherit; font-weight: 400; }
.field input { width: 100%; min-width: 0; min-height: 44px; border: 1px solid #3a4945; border-radius: 8px; padding: 0 11px; background: #101716; color: #f2f6f5; font: inherit; font-size: 0.9rem; }
.field input:focus { border-color: #78a89e; outline: 2px solid rgb(120 168 158 / 20%); outline-offset: 1px; }
.submit-error { margin: 0; border-left: 2px solid #d9ae63; padding-left: 10px; color: #e5c991; font-size: 0.8rem; line-height: 1.5; }
.capture-step { width: 100%; min-height: 46px; }

@keyframes flash-in { from { opacity: 0; transform: translate(-50%, -46%); } }

@media (max-width: 900px) {
  .capture-workspace,
  .details-workspace { grid-template-columns: 1fr; }
  .capture-canvas { height: min(58svh, 560px); min-height: 340px; }
  .capture-guidance { min-height: 300px; padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px)); }
  .evidence-summary { border-right: 0; border-bottom: 1px solid #2d3936; }
}

@media (max-width: 580px) {
  .scan-shell { width: min(calc(100% - 24px), 1180px); }
  .scan-header-inner { grid-template-columns: auto minmax(0, 1fr) auto; gap: 9px; }
  .back-link { font-size: 0; }
  .back-link svg { width: 18px; }
  .room-status p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scan-content { padding-block: 12px 28px; }
  .permission-gate { margin-top: 28px; }
  .gate-actions { display: grid; }
  .capture-canvas { width: 100%; height: min(54svh, 460px); min-height: 300px; }
  .capture-guidance { min-height: 270px; padding: 18px 16px calc(16px + env(safe-area-inset-bottom, 0px)); }
  .view-progress { margin-top: 18px; padding-top: 14px; }
  .evidence-summary,
  .measurement-form { padding: 20px 16px; }
  .evidence-heading { gap: 12px; }
  .evidence-metrics { grid-template-columns: 1fr; }
  .evidence-metrics div { grid-template-columns: auto 1fr; align-items: baseline; gap: 10px; }
  .evidence-strip { gap: 6px; }
  .evidence-strip figcaption { display: grid; }
  .dimension-fields { grid-template-columns: 1fr; }
}

@media (max-width: 350px) {
  .scan-shell { width: min(calc(100% - 16px), 1180px); }
  .evidence-strip { grid-template-columns: 1fr; }
  .evidence-strip figure { display: grid; grid-template-columns: 120px 1fr; }
  .evidence-strip img { aspect-ratio: 4 / 3; }
  .evidence-strip figcaption { align-content: center; }
}
</style>
