<script setup lang="ts">
const router = useRouter()
const { scan } = useDemoScan()
const { track } = useProductAnalytics()
const { state: cameraState, stream, errorMessage, requestCamera, stopStream } = useCameraPermission()

type CaptureMode = 'gate' | 'capturing' | 'processing' | 'complete'
const mode = ref<CaptureMode>('gate')
const guidanceStep = ref(0)
const microFeedback = ref('')
const capturedFlash = ref(false)
const videoElement = ref<HTMLVideoElement | null>(null)
const timers: ReturnType<typeof setTimeout>[] = []

const guidance = [
  {
    title: 'Point toward the opposite corner.',
    hint: 'Keep the floor edge in view while you move.',
    feedback: 'Got it.'
  },
  {
    title: 'Great. Now capture the ceiling edge.',
    hint: 'A little higher — that angle helps.',
    feedback: 'That angle helps.'
  },
  {
    title: 'One more view of the far wall.',
    hint: 'Move slowly. We already have enough detail on the near side.',
    feedback: 'We already have enough detail here.'
  },
  {
    title: 'We have enough room geometry.',
    hint: 'Finish when you are ready. HomeLens will check what is worth verifying.',
    feedback: 'This measurement looks solid.'
  }
]

const viewsCaptured = computed(() => Math.min(guidanceStep.value + 1, guidance.length))
const canFinish = computed(() => guidanceStep.value >= guidance.length - 1)
const currentGuidance = computed(() => guidance[Math.min(guidanceStep.value, guidance.length - 1)]!)
const unresolvedCount = computed(() => scan.value.measurements.filter(item => item.confidence < 0.75).length)
const selectedDimension = computed(() => {
  if (guidanceStep.value <= 1) return 'width'
  if (guidanceStep.value === 2) return 'height'
  return 'length'
})

const statusLine = computed(() => {
  if (mode.value === 'processing') return 'Analyzing what actually matters…'
  if (mode.value === 'complete') return 'Opening your result…'
  if (mode.value === 'capturing') return `Room capture · ${viewsCaptured.value} of ${guidance.length} useful views`
  return 'Room capture'
})

const showCameraError = computed(() =>
  ['denied', 'unavailable', 'no_camera', 'insecure_context'].includes(cameraState.value)
)

const bindVideo = async () => {
  await nextTick()
  if (videoElement.value && stream.value) {
    videoElement.value.srcObject = stream.value
    await videoElement.value.play().catch(() => undefined)
  }
}

const startDemoCapture = () => {
  stopStream()
  mode.value = 'capturing'
  guidanceStep.value = 0
  microFeedback.value = ''
  track('scan_started', { captureMethod: 'simulated-geometry' })
}

const enableCamera = async () => {
  await requestCamera()
  if (cameraState.value === 'granted') {
    mode.value = 'capturing'
    guidanceStep.value = 0
    await bindVideo()
    track('scan_started', { captureMethod: 'camera' })
  }
}

const flashCaptured = () => {
  capturedFlash.value = true
  timers.push(setTimeout(() => { capturedFlash.value = false }, 480))
}

const advanceGuidance = () => {
  if (mode.value !== 'capturing') return
  flashCaptured()
  microFeedback.value = currentGuidance.value.feedback
  if (guidanceStep.value < guidance.length - 1) {
    timers.push(setTimeout(() => {
      guidanceStep.value += 1
      microFeedback.value = ''
    }, 420))
  }
}

const completeCapture = () => {
  if (mode.value !== 'capturing' || !canFinish.value) return
  mode.value = 'processing'
  stopStream()
  track('scan_completed', {
    measurementCount: scan.value.measurements.length,
    unresolvedCount: unresolvedCount.value,
    captureMethod: cameraState.value === 'granted' ? 'camera' : 'simulated-geometry'
  })

  const reduceMotion = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const interval = reduceMotion ? 80 : 280
  timers.push(setTimeout(() => { mode.value = 'complete' }, interval * 2))
  timers.push(setTimeout(() => router.push('/analysis'), interval * 2 + (reduceMotion ? 60 : 220)))
}

watch(stream, () => { if (mode.value === 'capturing') bindVideo() })

onBeforeUnmount(() => {
  timers.forEach(timer => clearTimeout(timer))
  stopStream()
})
</script>

<template>
  <main class="scan-page">
    <header class="scan-header">
      <div class="scan-shell scan-header-inner">
        <NuxtLink to="/" class="back-link">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
          Back
        </NuxtLink>
        <div class="room-status">
          <h1>{{ scan.roomName }}</h1>
          <p>{{ statusLine }}</p>
        </div>
        <div class="progress-readout numeric" aria-live="polite">
          <template v-if="mode === 'capturing'">{{ viewsCaptured }}/{{ guidance.length }}</template>
          <template v-else-if="mode === 'gate'">Ready</template>
          <template v-else>…</template>
        </div>
      </div>
    </header>

    <div class="scan-shell scan-content">
      <!-- Permission gate: camera never requested on load -->
      <section v-if="mode === 'gate'" class="permission-gate" aria-labelledby="camera-gate-title">
        <h2 id="camera-gate-title">We'll use your camera to capture the room.</h2>
        <p>HomeLens does not need microphone access. You can also continue with the demo scan.</p>

        <div v-if="cameraState === 'requesting'" class="gate-status" role="status">Asking for camera access…</div>

        <div v-else-if="showCameraError" class="gate-error" role="alert">
          <p><strong>{{ errorMessage || 'Camera access is blocked.' }}</strong></p>
          <p>You can enable it in your browser settings or continue with the demo scan.</p>
        </div>

        <div class="gate-actions">
          <button
            type="button"
            class="button"
            :disabled="cameraState === 'requesting'"
            @click="enableCamera"
          >{{ showCameraError ? 'Try again' : 'Enable camera' }}</button>
          <button type="button" class="button button--secondary demo-scan-button" @click="startDemoCapture">
            Use demo scan
          </button>
        </div>
        <p class="prototype-note">No camera imagery is stored in this prototype.</p>
      </section>

      <section v-else class="capture-workspace" aria-labelledby="capture-surface-title">
        <div class="capture-canvas">
          <div class="canvas-topbar">
            <span class="live-label"><i aria-hidden="true" /> {{ stream ? 'Live camera' : 'Demo capture' }}</span>
            <span>{{ viewsCaptured }} of {{ guidance.length }} useful views</span>
          </div>

          <h2 id="capture-surface-title" class="sr-only">Room geometry capture</h2>

          <video
            v-if="stream"
            ref="videoElement"
            class="camera-video"
            playsinline
            muted
            autoplay
          />

          <RoomGeometry
            :measurements="scan.measurements"
            :windows="scan.windows"
            :doors="scan.doors"
            :selected-id="selectedDimension"
            tone="dark"
            compact
          />

          <div class="frame-corner frame-corner--tl" aria-hidden="true" />
          <div class="frame-corner frame-corner--tr" aria-hidden="true" />
          <div class="frame-corner frame-corner--bl" aria-hidden="true" />
          <div class="frame-corner frame-corner--br" aria-hidden="true" />

          <div v-if="capturedFlash" class="capture-flash" role="status">Captured</div>

          <div v-if="mode !== 'capturing'" class="completion-overlay" role="status" aria-live="assertive">
            <p class="is-visible">Analyzing what actually matters…</p>
          </div>
        </div>

        <aside class="capture-guidance">
          <div class="guidance-main">
            <p class="guidance-kicker numeric">View {{ viewsCaptured }} of {{ guidance.length }}</p>
            <h2>{{ currentGuidance.title }}</h2>
            <p>{{ currentGuidance.hint }}</p>
            <p v-if="microFeedback" class="micro-feedback" role="status">{{ microFeedback }}</p>
          </div>

          <div class="guidance-actions">
            <button
              v-if="!canFinish"
              type="button"
              class="button button--secondary capture-step"
              :disabled="mode !== 'capturing'"
              @click="advanceGuidance"
            >
              Capture this view
            </button>
            <button
              type="button"
              class="button capture-button"
              :disabled="mode !== 'capturing' || !canFinish"
              @click="completeCapture"
            >
              <span>
                {{
                  mode === 'capturing'
                    ? (canFinish ? 'Finish scan' : 'Keep capturing views')
                    : mode === 'processing'
                      ? 'Analyzing…'
                      : 'Opening analysis…'
                }}
              </span>
            </button>
          </div>
          <p class="prototype-note">No camera data is stored</p>
        </aside>
      </section>
    </div>
  </main>
</template>

<style scoped>
.scan-page {
  min-height: 100vh;
  overflow: hidden;
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

.room-status { text-align: center; }

.room-status h1 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: -0.012em;
}

.room-status p {
  margin: 2px 0 0;
  color: #8a9895;
  font-size: 0.76rem;
}

.progress-readout {
  justify-self: end;
  color: #8a9895;
  font-size: 0.8rem;
}

.scan-content {
  padding-block: 24px 40px;
}

.permission-gate {
  max-width: 34rem;
  margin: 48px auto 0;
  padding: 8px 4px 24px;
}

.permission-gate h2 {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.7rem);
  font-weight: 620;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.permission-gate > p {
  margin: 12px 0 0;
  color: #9aa8a4;
  font-size: 0.95rem;
  line-height: 1.55;
}

.gate-status {
  margin-top: 20px;
  color: #9ccfc5;
  font-size: 0.88rem;
}

.gate-error {
  margin-top: 18px;
  border-left: 2px solid #d9ae63;
  padding-left: 12px;
  color: #c8d2ce;
  font-size: 0.9rem;
  line-height: 1.5;
}

.gate-error p { margin: 0; }
.gate-error p + p { margin-top: 4px; }
.gate-error strong { color: #fff; }

.gate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}

.gate-actions .button {
  min-height: 44px;
}

.gate-actions .button--secondary {
  border-color: #43504d;
  background: #17201f;
  color: #eef3f1;
}

.gate-actions .button--secondary:hover {
  border-color: #5a6a66;
  background: #1d2826;
}

.capture-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 1px;
  overflow: hidden;
  border: 1px solid #2d3936;
  border-radius: var(--radius-media);
  background: #2d3936;
}

.capture-canvas {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: min(720px, calc(100vh - 140px));
  place-items: center;
  overflow: hidden;
  background: #0f1615;
}

.camera-video {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.28;
}

.capture-canvas :deep(.geometry) {
  position: relative;
  z-index: 1;
  width: min(96%, 780px);
  background: transparent;
}

.canvas-topbar {
  position: absolute;
  z-index: 3;
  top: 16px;
  left: 18px;
  right: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #788884;
  font-size: 0.76rem;
}

.live-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #aab8b4;
}

.live-label i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #86c7b9;
}

.frame-corner {
  position: absolute;
  z-index: 2;
  width: 28px;
  height: 28px;
  border-color: rgb(213 231 226 / 40%);
  pointer-events: none;
}

.frame-corner--tl { top: 56px; left: 22px; border-top: 1px solid; border-left: 1px solid; }
.frame-corner--tr { top: 56px; right: 22px; border-top: 1px solid; border-right: 1px solid; }
.frame-corner--bl { bottom: 22px; left: 22px; border-bottom: 1px solid; border-left: 1px solid; }
.frame-corner--br { right: 22px; bottom: 22px; border-right: 1px solid; border-bottom: 1px solid; }

.capture-flash {
  position: absolute;
  z-index: 6;
  top: 50%;
  left: 50%;
  border: 1px solid #477a70;
  border-radius: var(--radius-input);
  padding: 8px 14px;
  background: rgb(15 22 21 / 88%);
  color: #d7eee8;
  font-size: 0.86rem;
  transform: translate(-50%, -50%);
  animation: flash-in 160ms ease-out;
}

.capture-guidance {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 22px 20px 18px;
  background: #17201f;
}

.guidance-kicker {
  margin: 0;
  color: #7d8a86;
  font-size: 0.74rem;
}

.guidance-main h2 {
  margin: 8px 0 0;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.018em;
  line-height: 1.35;
}

.guidance-main > p {
  margin: 8px 0 0;
  color: #8e9d99;
  font-size: 0.86rem;
  line-height: 1.55;
}

.micro-feedback {
  color: #9ccfc5 !important;
  font-weight: 560;
}

.guidance-actions {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding-top: 24px;
}

.capture-button,
.capture-step {
  width: 100%;
  min-height: 44px;
}

.capture-button {
  background: #e4eeeb;
  color: #13201d;
}

.capture-button:hover { background: #fff; }
.capture-button:disabled { opacity: 0.45; }

.capture-step {
  border-color: #43504d;
  background: transparent;
  color: #eef3f1;
}

.capture-step:hover {
  border-color: #5a6a66;
  background: #1d2826;
}

.prototype-note {
  margin: 10px 0 0;
  color: #6c7a76;
  font-size: 0.74rem;
  text-align: center;
}

.completion-overlay {
  position: absolute;
  z-index: 5;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 30px;
  background: rgb(15 22 21 / 94%);
  animation: overlay-in 160ms ease-out;
}

.completion-overlay p {
  margin: 0;
  color: #edf3f1;
  font-size: 1rem;
  opacity: 0;
}

.completion-overlay p.is-visible { opacity: 1; }

@keyframes overlay-in {
  from { opacity: 0; }
}

@keyframes flash-in {
  from { opacity: 0; transform: translate(-50%, -46%); }
}

@media (max-width: 860px) {
  .capture-workspace { grid-template-columns: 1fr; }
  .capture-canvas { min-height: 380px; }
  .capture-guidance {
    padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  }
}

@media (max-width: 580px) {
  .scan-shell { width: min(calc(100% - 28px), 1180px); }
  .scan-header-inner { grid-template-columns: auto 1fr auto; gap: 10px; }
  .room-status { overflow: hidden; }
  .room-status h1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scan-content { padding-block: 18px 28px; }
  .permission-gate { margin-top: 28px; }
  .gate-actions { display: grid; }
  .capture-canvas { min-height: 320px; }
  .guidance-actions { padding-top: 18px; }
}

@media (max-width: 374px) {
  .back-link { font-size: 0; }
  .back-link svg { width: 18px; }
}
</style>
