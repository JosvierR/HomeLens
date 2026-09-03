<script setup lang="ts">
const router = useRouter()
const { scan } = useDemoScan()
const { track } = useProductAnalytics()
const phase = ref<'capturing' | 'processing' | 'complete'>('capturing')
const completionStage = ref(0)
const selectedDimension = ref('width')
const timers: ReturnType<typeof setTimeout>[] = []

const currentStep = computed(() => phase.value === 'capturing' ? 1 : phase.value === 'processing' ? 2 : 3)
const progress = computed(() => phase.value === 'capturing' ? 42 : phase.value === 'processing' ? 78 : 100)
const unresolvedCount = computed(() => scan.value.measurements.filter(item => item.confidence < 0.75).length)
const completionMessages = computed(() => [
  'Geometry captured',
  `${scan.value.measurements.length} measurements detected`,
  `${unresolvedCount.value} requires verification`
])

const completeCapture = () => {
  if (phase.value !== 'capturing') return
  phase.value = 'processing'
  completionStage.value = 0
  track('scan_completed', {
    measurementCount: scan.value.measurements.length,
    unresolvedCount: unresolvedCount.value,
    captureMethod: scan.value.captureMethod ?? null
  })

  const reduceMotion = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const interval = reduceMotion ? 80 : 320
  timers.push(setTimeout(() => { completionStage.value = 1 }, interval))
  timers.push(setTimeout(() => { completionStage.value = 2 }, interval * 2))
  timers.push(setTimeout(() => {
    phase.value = 'complete'
    completionStage.value = 2
  }, interval * 3))
  timers.push(setTimeout(() => router.push('/analysis'), interval * 3 + (reduceMotion ? 80 : 280)))
}

onMounted(() => {
  track('scan_started', { captureMethod: scan.value.captureMethod ?? null })
})

onBeforeUnmount(() => timers.forEach(timer => clearTimeout(timer)))
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
          <strong>{{ scan.roomName }}</strong>
          <span><i aria-hidden="true" /> {{ phase === 'complete' ? 'Scan complete' : phase === 'processing' ? 'Processing geometry' : 'Scanning' }}</span>
        </div>
        <div class="progress-readout"><span>{{ progress }}%</span><i><b :style="{ width: `${progress}%` }" /></i></div>
      </div>
    </header>

    <div class="scan-shell scan-content">
      <ScanProgress :current="currentStep" />

      <div class="capture-heading">
        <div>
          <p class="eyebrow">Room capture</p>
          <h1>{{ phase === 'capturing' ? 'Capture the room perimeter.' : 'Resolving room geometry.' }}</h1>
        </div>
        <p>Keep the floor-wall edge visible while moving steadily. HomeLens will flag uncertain dimensions for review.</p>
      </div>

      <section class="capture-workspace" aria-labelledby="capture-surface-title">
        <div class="capture-canvas">
          <div class="canvas-topbar">
            <span class="live-label"><i aria-hidden="true" /> Live capture</span>
            <span>4 corners · 7 edges</span>
          </div>

          <h2 id="capture-surface-title" class="sr-only">Simulated camera and room geometry capture</h2>
          <RoomGeometry
            :measurements="scan.measurements"
            :windows="scan.windows"
            :doors="scan.doors"
            :selected-id="selectedDimension"
            tone="dark"
            compact
            @select="selectedDimension = $event"
          />

          <div class="frame-corner frame-corner--tl" aria-hidden="true" />
          <div class="frame-corner frame-corner--tr" aria-hidden="true" />
          <div class="frame-corner frame-corner--bl" aria-hidden="true" />
          <div class="frame-corner frame-corner--br" aria-hidden="true" />

          <div v-if="phase !== 'capturing'" class="completion-overlay" role="status" aria-live="assertive">
            <div class="completion-check" aria-hidden="true">✓</div>
            <p v-for="(message, index) in completionMessages" :key="message" :class="{ 'is-visible': completionStage >= index }">
              <span aria-hidden="true">{{ index === 0 ? '—' : '✓' }}</span> {{ message }}
            </p>
          </div>
        </div>

        <aside class="capture-guidance">
          <div class="guidance-main">
            <p class="eyebrow">Live guidance</p>
            <span class="guidance-index">01</span>
            <h2>Move slowly toward the opposite wall.</h2>
            <p>Keep the lower edge of the wall inside the guide. Corners will lock when their geometry is stable.</p>
          </div>

          <div class="guidance-checks">
            <div class="is-detected"><span aria-hidden="true">✓</span><p><strong>Floor edge</strong><small>Detected and tracking</small></p></div>
            <div><span aria-hidden="true">2</span><p><strong>Ceiling line</strong><small>Keep inside the frame</small></p></div>
          </div>

          <button type="button" class="button capture-button" :disabled="phase !== 'capturing'" @click="completeCapture">
            <span>{{ phase === 'capturing' ? 'Complete simulated capture' : phase === 'processing' ? 'Processing capture…' : 'Opening analysis…' }}</span>
            <svg v-if="phase === 'capturing'" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
          </button>
          <p class="prototype-note">Prototype capture · No camera data is stored</p>
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
  min-height: 68px;
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
  font-size: 0.78rem;
  font-weight: 630;
}

.back-link:hover { color: #fff; }
.back-link svg { width: 15px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }

.room-status {
  text-align: center;
}

.room-status strong,
.room-status span {
  display: block;
}

.room-status strong {
  font-size: 0.8rem;
  font-weight: 650;
}

.room-status span {
  margin-top: 2px;
  color: #82908c;
  font-size: 0.62rem;
}

.room-status i {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-right: 4px;
  border-radius: 50%;
  background: #85c6b8;
}

.progress-readout {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: 10px;
  color: #9ba8a4;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.progress-readout > i {
  display: block;
  width: 72px;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: #34403d;
}

.progress-readout b {
  display: block;
  height: 100%;
  background: #86c7b9;
  transition: width 220ms ease;
}

.scan-content {
  padding-block: 36px 52px;
}

.scan-content > :deep(.scan-progress) {
  width: min(720px, 100%);
  margin-inline: auto;
}

.capture-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 40px;
  margin-top: 38px;
  padding-top: 28px;
  border-top: 1px solid rgb(255 255 255 / 9%);
}

.capture-heading .eyebrow,
.guidance-main .eyebrow {
  color: #82908c;
}

.capture-heading h1 {
  margin: 7px 0 0;
  font-size: clamp(1.9rem, 4vw, 2.85rem);
  font-weight: 580;
  letter-spacing: -0.045em;
  line-height: 1.1;
}

.capture-heading > p {
  max-width: 440px;
  margin: 0;
  color: #99a6a2;
  font-size: 0.78rem;
  line-height: 1.6;
}

.capture-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 1px;
  margin-top: 28px;
  overflow: hidden;
  border: 1px solid #33403d;
  border-radius: 16px;
  background: #33403d;
}

.capture-canvas {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 520px;
  place-items: center;
  overflow: hidden;
  background: #111817;
}

.capture-canvas::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: radial-gradient(circle at 48% 48%, rgb(73 104 97 / 22%), transparent 52%);
  content: "";
  pointer-events: none;
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
  top: 18px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #71817d;
  font-size: 0.62rem;
  font-weight: 620;
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
  box-shadow: 0 0 0 4px rgb(134 199 185 / 9%);
}

.frame-corner {
  position: absolute;
  z-index: 2;
  width: 34px;
  height: 34px;
  border-color: rgb(213 231 226 / 45%);
  pointer-events: none;
}

.frame-corner--tl { top: 62px; left: 28px; border-top: 1px solid; border-left: 1px solid; }
.frame-corner--tr { top: 62px; right: 28px; border-top: 1px solid; border-right: 1px solid; }
.frame-corner--bl { bottom: 28px; left: 28px; border-bottom: 1px solid; border-left: 1px solid; }
.frame-corner--br { right: 28px; bottom: 28px; border-right: 1px solid; border-bottom: 1px solid; }

.capture-guidance {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 25px 22px 20px;
  background: #17201f;
}

.guidance-index {
  display: block;
  margin-top: 30px;
  color: #5f706c;
  font-size: 0.68rem;
  font-weight: 680;
}

.guidance-main h2 {
  margin: 9px 0 0;
  font-size: 1.35rem;
  font-weight: 590;
  letter-spacing: -0.03em;
  line-height: 1.25;
}

.guidance-main > p:last-child {
  margin: 12px 0 0;
  color: #8e9d99;
  font-size: 0.74rem;
  line-height: 1.6;
}

.guidance-checks {
  display: grid;
  gap: 1px;
  margin-top: 28px;
  border-block: 1px solid #2d3936;
  background: #2d3936;
}

.guidance-checks > div {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 2px;
  background: #17201f;
}

.guidance-checks > div > span {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #43504d;
  border-radius: 50%;
  color: #7e8c88;
  font-size: 0.62rem;
}

.guidance-checks .is-detected > span {
  border-color: #3e6a61;
  background: #25453f;
  color: #a5d0c7;
}

.guidance-checks p,
.guidance-checks strong,
.guidance-checks small {
  display: block;
  margin: 0;
}

.guidance-checks strong { font-size: 0.72rem; font-weight: 640; }
.guidance-checks small { margin-top: 2px; color: #75827f; font-size: 0.61rem; }

.capture-button {
  width: 100%;
  margin-top: auto;
  background: #dfece8;
  color: #13201d;
}

.capture-button:hover { background: #fff; }
.capture-button svg { width: 16px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }

.prototype-note {
  margin: 9px 0 0;
  color: #62706d;
  font-size: 0.58rem;
  text-align: center;
}

.completion-overlay {
  position: absolute;
  z-index: 5;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  padding: 30px;
  background: rgb(14 22 20 / 91%);
  backdrop-filter: blur(5px);
  animation: overlay-in 180ms ease-out;
}

.completion-check {
  display: grid;
  width: 50px;
  height: 50px;
  margin-bottom: 20px;
  place-items: center;
  border: 1px solid #477a70;
  border-radius: 50%;
  background: #203d37;
  color: #bce1d8;
}

.completion-overlay p {
  display: flex;
  width: min(280px, 100%);
  align-items: center;
  gap: 10px;
  margin: 0;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
  padding: 10px;
  color: #82908c;
  font-size: 0.78rem;
  opacity: 0;
  transform: translateY(5px);
  transition: opacity 180ms ease, transform 180ms ease;
}

.completion-overlay p.is-visible {
  color: #edf3f1;
  opacity: 1;
  transform: translateY(0);
}

.completion-overlay p span { color: #8ec7bd; }

@keyframes overlay-in {
  from { opacity: 0; }
}

@media (max-width: 860px) {
  .capture-heading { align-items: flex-start; flex-direction: column; gap: 14px; }
  .capture-workspace { grid-template-columns: 1fr; }
  .capture-canvas { min-height: 480px; }
  .capture-guidance { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .guidance-index { margin-top: 18px; }
  .guidance-checks { margin-top: 0; }
  .capture-button { grid-column: 1 / -1; margin-top: 0; }
  .prototype-note { grid-column: 1 / -1; }
}

@media (max-width: 580px) {
  .scan-shell { width: min(calc(100% - 28px), 1180px); }
  .scan-header-inner { grid-template-columns: auto 1fr auto; gap: 10px; }
  .room-status { overflow: hidden; }
  .room-status strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .progress-readout > i { display: none; }
  .scan-content { padding-block: 26px 36px; }
  .capture-heading { margin-top: 28px; padding-top: 22px; }
  .capture-workspace { margin-top: 20px; }
  .capture-canvas { min-height: 365px; }
  .canvas-topbar { top: 13px; left: 14px; right: 14px; }
  .frame-corner--tl { top: 46px; left: 14px; }
  .frame-corner--tr { top: 46px; right: 14px; }
  .frame-corner--bl { bottom: 14px; left: 14px; }
  .frame-corner--br { right: 14px; bottom: 14px; }
  .capture-guidance { grid-template-columns: 1fr; padding: 20px 18px 16px; }
  .capture-button, .prototype-note { grid-column: auto; }
  .guidance-checks { margin-top: 0; }
}

@media (max-width: 374px) {
  .back-link { font-size: 0; }
  .back-link svg { width: 18px; }
  .capture-canvas { min-height: 325px; }
}
</style>
