<script setup lang="ts">
import { analyzeCaptureSession } from '~~/shared/capture-analysis'
import { assessFrameQuality } from '~~/shared/frame-quality'
import type { FrameQualityResult } from '~~/shared/frame-quality'
import type { PhotoEstimationStatusResponse } from '~~/shared/photo-estimation-api'
import type { FusedPhotoMeasurement } from '~~/shared/photo-metric'
import type { NextCaptureAction } from '~~/shared/next-best-capture'
import type { RoomScan } from '~/types/scan'
import type { CapturedFrame } from '~/composables/useCamera'

interface CapturedView {
  frame: CapturedFrame
  quality: FrameQualityResult
  previewUrl: string
  evidenceId?: string
}

interface GuidanceStep {
  title: string
  hint: string
  feedback: string
  target: string
}

type CaptureMode =
  | 'gate'
  | 'capturing'
  | 'uploading'
  | 'estimating'
  | 'results'
  | 'needs_more_evidence'
  | 'failed'
  | 'manual'
  | 'processing'

const router = useRouter()
const route = useRoute()
const { scan, replaceScan } = useDemoScan()
const { track } = useProductAnalytics()
const { user, refresh: refreshAuth, ensureGuestSession, configured } = useAuth()
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

const baseGuidance: GuidanceStep[] = [
  {
    title: 'Capture a room overview',
    hint: 'Stand near a corner. Include the floor and two walls; keep furniture from filling the frame.',
    feedback: 'Overview accepted.',
    target: 'room_overview'
  },
  {
    title: 'Move to another corner',
    hint: 'Do not capture from the same position. Keep the opposite wall and floor edges visible.',
    feedback: 'Opposite view accepted.',
    target: 'opposite_corner'
  },
  {
    title: 'Include floor and ceiling geometry',
    hint: 'Show where two walls meet the floor and ceiling. Avoid pointing directly at a light.',
    feedback: 'Height view accepted.',
    target: 'ceiling_edge'
  }
]

const mode = ref<CaptureMode>('gate')
const activeGuidance = ref<GuidanceStep[]>(baseGuidance)
const guidanceStep = ref(0)
const microFeedback = ref('')
const capturedFlash = ref(false)
const captureBusy = ref(false)
const submitError = ref<string | null>(null)
const nativeCaptureInput = ref<HTMLInputElement | null>(null)
const capturedViews = shallowRef<CapturedView[]>([])
const estimationStatus = shallowRef<PhotoEstimationStatusResponse | null>(null)
const estimationAttempts = ref(0)
const pollCount = ref(0)
const timers: ReturnType<typeof setTimeout>[] = []
let pollTimer: ReturnType<typeof setTimeout> | undefined

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

const currentGuidance = computed(() => activeGuidance.value[Math.min(guidanceStep.value, activeGuidance.value.length - 1)]!)
const lastCapturedView = computed(() => capturedViews.value.at(-1) ?? null)
const captureAssessment = computed(() => analyzeCaptureSession(capturedViews.value.map(view => ({
  targetType: view.frame.targetType,
  qualityBucket: view.quality.bucket,
  brightnessScore: view.quality.brightnessScore,
  sharpnessScore: view.quality.sharpnessScore,
  contrastScore: view.quality.contrastScore
}))))
const acceptedBaseCount = computed(() => baseGuidance.filter(step =>
  capturedViews.value.some(view => view.frame.targetType === step.target)
).length)
const showCameraError = computed(() => ['denied', 'unavailable', 'error'].includes(cameraState.value))
const estimatedMeasurements = computed(() => estimationStatus.value?.estimate?.measurements ?? [])
const manualAllowed = computed(() => mode.value === 'failed'
  || estimationAttempts.value >= 2
  || estimationStatus.value?.estimate?.status === 'irregular')
const validManualMeasurements = computed(() => {
  const values = [dimensions.width, dimensions.length, dimensions.height]
  return values.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100)
    && roomName.value.trim().length > 0
})
const statusLine = computed(() => {
  if (mode.value === 'uploading') return 'Encrypting and uploading accepted views...'
  if (mode.value === 'estimating') return 'Building metric room geometry...'
  if (mode.value === 'results') return 'Photo-derived room estimate ready'
  if (mode.value === 'needs_more_evidence') return 'More evidence is needed'
  if (mode.value === 'manual') return 'Last-resort physical verification'
  if (mode.value === 'processing') return 'Saving verified measurements...'
  if (mode.value === 'capturing') return `Live capture - ${acceptedBaseCount.value} of ${baseGuidance.length} required views`
  return 'Metric room capture'
})
const deviceFamily = computed(() => {
  if (!import.meta.client) return 'web-camera'
  const agent = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(agent)) return 'ios-mobile'
  if (/Android/i.test(agent)) return 'android-mobile'
  return 'web-camera'
})

const errorText = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const data = 'data' in error ? error.data : undefined
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message
    if ('message' in error && typeof error.message === 'string') return error.message
  }
  return fallback
}

const clearPoll = () => {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = undefined
}

let sessionPrepareId = 0

const enableCamera = async () => {
  submitError.value = null
  microFeedback.value = ''
  sessionPrepareId += 1
  // Mount the <video> first, then request the stream from this user gesture.
  mode.value = 'capturing'
  await nextTick()
  await nextTick()
  const started = await startCamera()
  if (mode.value !== 'capturing') return
  if (!started || cameraState.value !== 'active') {
    mode.value = 'gate'
    return
  }
  await nextTick()
  let bound = await bindVideo(videoEl.value)
  if (!bound) {
    await new Promise(resolve => window.setTimeout(resolve, 120))
    bound = await bindVideo(videoEl.value)
  }
  if (!bound) {
    microFeedback.value = cameraError.value ?? 'The preview could not start. Try again or use the phone camera.'
  }
  track('scan_started', { captureMethod: 'camera' })
}

const openNativeCamera = () => {
  submitError.value = null
  sessionPrepareId += 1
  stopCamera()
  mode.value = 'capturing'
  nextTick(() => nativeCaptureInput.value?.click())
}

const pollEstimation = async () => {
  const context = productContext.value
  if (!context || mode.value !== 'estimating') return
  try {
    const status = await $fetch<PhotoEstimationStatusResponse>(`/api/scans/${context.scanId}/estimation`)
    estimationStatus.value = status
    pollCount.value += 1
    if (status.state === 'processing_geometry' || (status.state === 'captured' && status.progress.total > 0)) {
      if (pollCount.value >= 100) throw new Error('The geometry worker is taking too long. Your private views are saved; retry when the service is available.')
      pollTimer = setTimeout(pollEstimation, 1000)
      return
    }
    if (status.state === 'idle' || (status.state === 'captured' && status.progress.total === 0)) {
      mode.value = capturedViews.value.length ? 'capturing' : 'gate'
      return
    }
    if (status.state === 'failed') {
      mode.value = 'failed'
      submitError.value = status.error?.message ?? 'The geometry worker could not complete this scan.'
      return
    }
    mode.value = status.scan && status.estimate?.status === 'estimated' ? 'results' : 'needs_more_evidence'
  } catch (error) {
    mode.value = 'failed'
    submitError.value = errorText(error, 'The estimate could not be loaded. Your accepted views remain saved.')
  }
}

const beginPhotoEstimation = async () => {
  clearPoll()
  submitError.value = null
  let context = productContext.value
  if (!context) {
    const started = await bootstrapGuestScan()
    context = started
  }
  if (!context) {
    mode.value = 'failed'
    submitError.value = 'Could not start this scan session. Refresh and try again.'
    return
  }
  mode.value = 'uploading'
  try {
    await ensureGuestSession()
    if (!user.value) throw new Error('Could not start a demo session for this scan.')
    const pending = capturedViews.value.filter(view => !view.evidenceId)
    await Promise.all(pending.map(async view => {
      view.evidenceId = await uploadCapture(view.frame, view.quality, {
        scanId: context!.scanId,
        projectId: context!.projectId,
        deviceFamily: deviceFamily.value
      })
    }))
    await $fetch(`/api/scans/${context.scanId}/estimation/start`, { method: 'POST' })
    estimationAttempts.value += 1
    pollCount.value = 0
    mode.value = 'estimating'
    await pollEstimation()
  } catch (error) {
    mode.value = 'failed'
    submitError.value = errorText(error, 'Photo estimation is unavailable. Your accepted views are still here.')
  }
}

const bootstrapGuestScan = async () => {
  if (!configured) return null
  const guest = await ensureGuestSession()
  if (!guest) return null
  const started = await $fetch<{ projectId: string, roomId: string, scanId: string, roomName: string }>('/api/demo/start-scan', {
    method: 'POST'
  })
  roomName.value = started.roomName || roomName.value
  await router.replace({
    path: '/scan',
    query: {
      projectId: started.projectId,
      roomId: started.roomId,
      scanId: started.scanId
    }
  })
  return {
    projectId: started.projectId,
    roomId: started.roomId,
    scanId: started.scanId
  }
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
  } else nextViews.push(nextView)
  capturedViews.value = nextViews
  capturedFlash.value = true
  microFeedback.value = currentGuidance.value.feedback
  timers.push(setTimeout(() => { capturedFlash.value = false }, 420))

  const roundComplete = activeGuidance.value.every(step =>
    capturedViews.value.some(view => view.frame.targetType === step.target)
  )
  if (roundComplete) {
    timers.push(setTimeout(() => {
      stopCamera()
      microFeedback.value = ''
      void beginPhotoEstimation()
    }, 420))
  } else {
    guidanceStep.value = Math.min(guidanceStep.value + 1, activeGuidance.value.length - 1)
    timers.push(setTimeout(() => { microFeedback.value = '' }, 900))
  }
  return true
}

const captureCurrentView = async () => {
  if (captureBusy.value || mode.value !== 'capturing') return
  if (!stream.value) return openNativeCamera()
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
  microFeedback.value = 'Checking this photo...'
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
  microFeedback.value = 'Changing camera...'
  try {
    await switchCamera()
    await nextTick()
    await bindVideo(videoEl.value)
    microFeedback.value = cameraState.value === 'active' ? '' : (cameraError.value ?? 'The other camera could not start.')
  } finally {
    captureBusy.value = false
  }
}

const retakeAll = () => {
  clearPoll()
  capturedViews.value.forEach(view => URL.revokeObjectURL(view.previewUrl))
  capturedViews.value = []
  estimationStatus.value = null
  estimationAttempts.value = 0
  activeGuidance.value = baseGuidance
  guidanceStep.value = 0
  mode.value = 'gate'
}

const fallbackCaptureAction = (): Pick<NextCaptureAction, 'targetType' | 'instruction' | 'reason'> => {
  const missing = estimationStatus.value?.estimate?.missingMeasurements[0]
  if (missing === 'height') return { targetType: 'ceiling_corner', instruction: 'Capture a ceiling corner.', reason: 'The floor-to-ceiling plane pair needs a clearer view.' }
  if (missing === 'length') return { targetType: 'far_wall', instruction: 'Capture the far wall.', reason: 'The visible floor depth did not constrain room length.' }
  return { targetType: 'opposite_corner', instruction: 'Capture the opposite corner again.', reason: 'The parallel wall planes need another viewpoint.' }
}

const takeRecommendedView = async () => {
  const recommended = estimationStatus.value?.nextCapture
  const action = recommended?.kind === 'capture' ? recommended : fallbackCaptureAction()
  activeGuidance.value = [{
    title: action.instruction.replace(/\.$/, ''),
    hint: action.reason,
    feedback: 'Additional evidence accepted.',
    target: action.targetType
  }]
  guidanceStep.value = 0
  estimationStatus.value = null
  await enableCamera()
}

const continueToAnalysis = async () => {
  const context = productContext.value
  const estimatedScan = estimationStatus.value?.scan
  if (!context || !estimatedScan) return
  mode.value = 'processing'
  submitError.value = null
  try {
    await $fetch(`/api/scans/${context.scanId}/estimation/accept`, {
      method: 'POST',
      body: { roomName: roomName.value.trim(), windows: openings.windows, doors: openings.doors }
    })
    replaceScan({ ...estimatedScan, roomName: roomName.value.trim(), windows: openings.windows, doors: openings.doors })
    track('scan_completed', { measurementCount: 3, unresolvedCount: estimatedScan.measurements.filter(item => item.confidence < .75).length, captureMethod: 'photo_metric_depth' })
    await router.push('/analysis')
  } catch (error) {
    mode.value = 'results'
    submitError.value = errorText(error, 'The estimate could not be accepted yet.')
  }
}

const openManualFallback = () => {
  if (!manualAllowed.value) return
  dimensions.width = null
  dimensions.length = null
  dimensions.height = null
  mode.value = 'manual'
  submitError.value = null
}

const buildManualScan = (): RoomScan => ({
  id: productContext.value?.scanId ?? `camera_${crypto.randomUUID()}`,
  roomId: productContext.value?.roomId ?? undefined,
  roomName: roomName.value.trim(),
  createdAt: new Date().toISOString(),
  windows: openings.windows,
  doors: openings.doors,
  modelVersion: 'manual-entry-v1',
  captureMethod: 'camera-manual-fallback',
  deviceFamily: deviceFamily.value,
  roomCategory: 'room',
  measurements: [
    { id: 'width', label: 'Width', value: dimensions.width!, unit: 'ft', confidence: 1, rawConfidence: 1, source: 'manual' },
    { id: 'length', label: 'Length', value: dimensions.length!, unit: 'ft', confidence: 1, rawConfidence: 1, source: 'manual' },
    { id: 'height', label: 'Ceiling height', value: dimensions.height!, unit: 'ft', confidence: 1, rawConfidence: 1, source: 'manual' }
  ]
})

const completeManualFallback = async () => {
  if (!validManualMeasurements.value) return
  mode.value = 'processing'
  submitError.value = null
  const manualScan = buildManualScan()
  try {
    const context = productContext.value
    if (context) {
      await $fetch(`/api/scans/${context.scanId}/complete`, {
        method: 'POST',
        body: {
          roomName: manualScan.roomName,
          measurements: manualScan.measurements.map(item => ({ key: item.id, label: item.label, value: item.value })),
          windows: openings.windows,
          doors: openings.doors,
          deviceFamily: deviceFamily.value,
          acceptedFrameCount: capturedViews.value.length
        }
      })
    }
    replaceScan(manualScan)
    await router.push('/analysis')
  } catch (error) {
    mode.value = 'manual'
    submitError.value = errorText(error, 'The verified values could not be saved.')
  }
}

const measurementFor = (type: FusedPhotoMeasurement['measurementType']) =>
  estimatedMeasurements.value.find(item => item.measurementType === type)
const displayFeet = (value: number) => value.toFixed(1)

const loadProductRoom = async () => {
  const context = productContext.value
  if (!context) return
  await refreshAuth()
  if (!user.value) return
  try {
    const exported = await $fetch<{ rooms: Array<{ id: string, name: string }> }>(`/api/projects/${context.projectId}/export`)
    roomName.value = exported.rooms.find(room => room.id === context.roomId)?.name ?? roomName.value
  } catch {
    // Ownership is checked on every server write; camera capture can still start.
  }
}

const prepareScanSession = async () => {
  const prepareId = ++sessionPrepareId
  submitError.value = null
  if (!configured) {
    submitError.value = 'This demo environment is not connected yet.'
    return
  }
  if (!productContext.value) {
    try {
      await bootstrapGuestScan()
    } catch (error) {
      submitError.value = errorText(error, 'Could not start the scan. Refresh and try again.')
      return
    }
  } else {
    await ensureGuestSession()
    await loadProductRoom()
  }

  if (prepareId !== sessionPrepareId) return
  if (mode.value === 'capturing' || mode.value === 'uploading' || mode.value === 'estimating') return

  const context = productContext.value
  if (!context) return
  try {
    const status = await $fetch<PhotoEstimationStatusResponse>(`/api/scans/${context.scanId}/estimation`)
    if (prepareId !== sessionPrepareId) return
    if (mode.value === 'capturing' || mode.value === 'uploading') return
    estimationStatus.value = status
    const hasInferenceWork = Boolean(status.jobId) || status.progress.total > 0
    if (status.state === 'processing_geometry' && hasInferenceWork) {
      mode.value = 'estimating'
      pollCount.value = 0
      await pollEstimation()
      return
    }
    if (status.state === 'failed' && hasInferenceWork) {
      mode.value = 'failed'
      submitError.value = status.error?.message ?? 'The geometry worker could not complete this scan.'
      return
    }
    if (status.state === 'needs_more_evidence') {
      mode.value = 'needs_more_evidence'
      return
    }
    if (status.scan && (status.state === 'estimated' || status.state === 'ready_for_analysis')) {
      mode.value = 'results'
      return
    }
  } catch {
    // Fresh capture can still start.
  }
}

watch(stream, async current => {
  if (!current || mode.value !== 'capturing') return
  await nextTick()
  if (!previewReady.value) await bindVideo(videoEl.value)
}, { flush: 'post' })

onMounted(() => {
  void prepareScanSession()
})
onBeforeUnmount(() => {
  clearPoll()
  timers.forEach(timer => clearTimeout(timer))
  stopCamera()
  capturedViews.value.forEach(view => URL.revokeObjectURL(view.previewUrl))
})
</script>

<template>
  <main class="scan-page">
    <header class="scan-header">
      <div class="scan-shell scan-header-inner">
        <NuxtLink to="/" class="back-link" aria-label="Back">&#8592; Back</NuxtLink>
        <div class="room-status"><h1>{{ roomName }}</h1><p>{{ statusLine }}</p></div>
        <div class="progress-readout numeric" aria-live="polite">{{ acceptedBaseCount }}/3</div>
      </div>
    </header>

    <div class="scan-shell scan-content">
      <section v-if="mode === 'gate'" class="permission-gate" aria-labelledby="camera-gate-title">
        <p class="eyebrow">Quick room scan</p>
        <h2 id="camera-gate-title">Open the camera and capture three views.</h2>
        <p>No account needed. HomeLens uses the same photo-to-metric model to estimate width, length, and ceiling height.</p>
        <div v-if="cameraState === 'requesting_permission'" class="gate-status" role="status">Opening the camera...</div>
        <div v-else-if="showCameraError" class="gate-error" role="alert"><strong>{{ cameraError || 'Camera access is blocked.' }}</strong><br>Retry the live preview or use the phone camera.</div>
        <p v-if="submitError" class="submit-error" role="alert">{{ submitError }}</p>
        <div class="gate-actions">
          <button type="button" class="button" :disabled="cameraState === 'requesting_permission'" @click="enableCamera">{{ showCameraError ? 'Try camera again' : 'Open camera' }}</button>
          <button type="button" class="button button--secondary" @click="openNativeCamera">Use phone camera</button>
        </div>
        <p class="privacy-note">Images stay private for this scan and are sent to the GPU worker only through short-lived access.</p>
      </section>

      <section v-else-if="mode === 'capturing'" class="capture-workspace" aria-labelledby="capture-surface-title">
        <div class="capture-canvas">
          <div class="canvas-topbar">
            <span class="live-label"><i /> {{ stream ? (previewReady ? 'Live camera' : 'Starting preview') : 'Phone camera' }}</span>
            <button v-if="stream && devices.length > 1" type="button" class="camera-switch" :disabled="captureBusy" @click="changeCamera">Switch front/rear</button>
          </div>
          <h2 id="capture-surface-title" class="sr-only">Live room camera</h2>
          <video
            v-show="stream"
            ref="videoEl"
            class="camera-video"
            playsinline
            webkit-playsinline
            muted
            autoplay
          />
          <img v-if="!stream && lastCapturedView" class="camera-video camera-still" :src="lastCapturedView.previewUrl" alt="Most recently accepted room view">
          <div v-else-if="!stream" class="camera-placeholder">{{ captureBusy ? 'Checking photo...' : 'Open the phone camera for this view.' }}</div>
          <div class="frame-guide" aria-hidden="true" />
          <div v-if="capturedFlash" class="capture-flash" role="status">View accepted</div>
        </div>
        <aside class="capture-guidance">
          <div>
            <p class="guidance-kicker numeric">View {{ guidanceStep + 1 }} of {{ activeGuidance.length }}</p>
            <h2>{{ currentGuidance.title }}</h2>
            <p>{{ currentGuidance.hint }}</p>
            <p v-if="microFeedback" class="micro-feedback" role="status">{{ microFeedback }}</p>
            <ol v-if="activeGuidance.length > 1" class="view-progress">
              <li v-for="(step, index) in activeGuidance" :key="step.target" :class="{ complete: capturedViews.some(view => view.frame.targetType === step.target), current: index === guidanceStep }">
                <span>{{ capturedViews.some(view => view.frame.targetType === step.target) ? '&#10003;' : index + 1 }}</span>{{ step.title }}
              </li>
            </ol>
          </div>
          <button type="button" class="button capture-button" :disabled="captureBusy || (Boolean(stream) && !previewReady)" @click="captureCurrentView">{{ captureBusy ? 'Checking...' : stream ? 'Capture this view' : 'Open phone camera' }}</button>
        </aside>
      </section>

      <section v-else-if="mode === 'uploading' || mode === 'estimating'" class="processing-panel" aria-live="polite">
        <div class="spinner" aria-hidden="true" />
        <p class="eyebrow">{{ mode === 'uploading' ? 'Private upload' : 'Metric geometry' }}</p>
        <h2>{{ mode === 'uploading' ? 'Securing your accepted views...' : 'Building the room estimate...' }}</h2>
        <p v-if="mode === 'estimating'">Depth, structural planes, multi-view agreement, and uncertainty are being evaluated. Unsupported dimensions will remain missing.</p>
        <p v-else>Original images stay private; inference receives time-limited access and does not retain raw depth arrays.</p>
        <div v-if="estimationStatus" class="job-progress numeric">{{ estimationStatus.progress.completed }} / {{ estimationStatus.progress.total }} views processed</div>
      </section>

      <section v-else-if="mode === 'results'" class="result-workspace">
        <div class="evidence-summary">
          <div class="section-heading"><div><p class="eyebrow">Camera evidence</p><h2>Three supported dimensions found.</h2></div><button type="button" class="text-button" @click="retakeAll">Retake all</button></div>
          <div class="evidence-strip">
            <figure v-for="(view, index) in capturedViews" :key="view.frame.captureId"><img :src="view.previewUrl" :alt="`Accepted room view ${index + 1}`"><figcaption>{{ view.frame.targetType.replaceAll('_', ' ') }}</figcaption></figure>
          </div>
          <p class="shape-note">Room model: {{ estimationStatus?.estimate?.shape.replaceAll('_', ' ') }} at {{ Math.round((estimationStatus?.estimate?.rectangularityConfidence ?? 0) * 100) }}% rectangularity confidence.</p>
        </div>
        <div class="estimate-review">
          <div><p class="eyebrow">Estimated from captured views</p><h2>Review before analysis.</h2><p class="form-intro">These are model estimates, not tape measurements. Each likely range includes depth quality, plane fit, and disagreement across views.</p></div>
          <div class="estimate-grid">
            <article v-for="measurement in estimatedMeasurements" :key="measurement.measurementType">
              <span>{{ measurement.label }}</span>
              <strong class="numeric">{{ displayFeet(measurement.valueFeet) }} <small>ft</small></strong>
              <span class="range numeric">Likely range {{ displayFeet(measurement.uncertaintyLowFeet) }}-{{ displayFeet(measurement.uncertaintyHighFeet) }} ft</span>
              <span class="support">{{ Math.round(measurement.confidence * 100) }}% confidence - {{ measurement.supportingViewCount }} supporting view{{ measurement.supportingViewCount === 1 ? '' : 's' }}</span>
            </article>
          </div>
          <label class="field field--wide"><span>Room name</span><input v-model.trim="roomName" maxlength="120"></label>
          <div class="opening-fields">
            <label class="field"><span>Windows <small>optional correction</small></span><input v-model.number="openings.windows" type="number" min="0" max="100" step="1"></label>
            <label class="field"><span>Doors <small>optional correction</small></span><input v-model.number="openings.doors" type="number" min="0" max="100" step="1"></label>
          </div>
          <div v-if="estimationStatus?.nextCapture?.kind === 'capture'" class="next-capture">
            <strong>One more view could improve decision stability.</strong><span>{{ estimationStatus.nextCapture.instruction }} {{ estimationStatus.nextCapture.reason }}</span>
            <button type="button" class="button button--secondary" @click="takeRecommendedView">Take recommended view</button>
          </div>
          <p v-if="submitError" class="submit-error" role="alert">{{ submitError }}</p>
          <button type="button" class="button primary-action" :disabled="!roomName.trim()" @click="continueToAnalysis">Continue to scenario analysis</button>
        </div>
      </section>

      <section v-else-if="mode === 'needs_more_evidence' || mode === 'failed'" class="recovery-panel">
        <p class="eyebrow">{{ mode === 'failed' ? 'Processing unavailable' : 'No unsupported guesses' }}</p>
        <h2>{{ mode === 'failed' ? 'The automatic estimate did not complete.' : 'Another view is needed.' }}</h2>
        <p>{{ submitError || estimationStatus?.estimate?.reason || 'The images did not support all three dimensions with usable geometry.' }}</p>
        <p v-if="estimationStatus?.estimate?.missingMeasurements.length"><strong>Still missing:</strong> {{ estimationStatus.estimate.missingMeasurements.map(item => `${item} needs another view`).join(', ') }}.</p>
        <div v-if="estimatedMeasurements.length" class="partial-list">
          <span v-for="measurement in estimatedMeasurements" :key="measurement.measurementType">{{ measurement.label }}: {{ displayFeet(measurement.valueFeet) }} ft ({{ Math.round(measurement.confidence * 100) }}%)</span>
        </div>
        <div class="recovery-actions">
          <button v-if="mode === 'needs_more_evidence'" type="button" class="button" @click="takeRecommendedView">Take recommended view</button>
          <button v-else type="button" class="button" @click="beginPhotoEstimation">Retry automatic estimate</button>
          <button v-if="manualAllowed" type="button" class="button button--secondary" @click="openManualFallback">Use physical measurements instead</button>
          <NuxtLink to="/" class="button button--secondary">Back home</NuxtLink>
          <button type="button" class="text-button" @click="retakeAll">Retake all views</button>
        </div>
        <p v-if="!manualAllowed" class="privacy-note">Manual dimensions become available only after the recommended evidence attempt.</p>
      </section>

      <section v-else class="manual-panel">
        <p class="eyebrow">Last-resort verification</p>
        <h2>Enter dimensions measured with a tape or laser.</h2>
        <p>Do not estimate these values by eye. They will be marked as human ground truth, while any prior model estimate remains in the audit trail.</p>
        <form @submit.prevent="completeManualFallback">
          <label class="field field--wide"><span>Room name</span><input v-model.trim="roomName" required maxlength="120"></label>
          <div class="dimension-fields">
            <label class="field"><span>Width <small>ft</small></span><input v-model.number="dimensions.width" type="number" inputmode="decimal" min="0.1" max="100" step="0.1" required></label>
            <label class="field"><span>Length <small>ft</small></span><input v-model.number="dimensions.length" type="number" inputmode="decimal" min="0.1" max="100" step="0.1" required></label>
            <label class="field"><span>Ceiling height <small>ft</small></span><input v-model.number="dimensions.height" type="number" inputmode="decimal" min="0.1" max="100" step="0.1" required></label>
          </div>
          <div class="opening-fields">
            <label class="field"><span>Windows</span><input v-model.number="openings.windows" type="number" min="0" max="100" step="1"></label>
            <label class="field"><span>Doors</span><input v-model.number="openings.doors" type="number" min="0" max="100" step="1"></label>
          </div>
          <p v-if="submitError" class="submit-error" role="alert">{{ submitError }}</p>
          <button type="submit" class="button primary-action" :disabled="mode === 'processing' || !validManualMeasurements">{{ mode === 'processing' ? 'Saving...' : 'Analyze verified room' }}</button>
        </form>
      </section>
    </div>

    <input ref="nativeCaptureInput" class="sr-only" type="file" accept="image/*" capture="environment" aria-label="Capture a room photo with the phone camera" @change="handleNativeCapture">
  </main>
</template>

<style scoped>
.scan-page { min-height: 100vh; background: #0f1615; color: #eef3f1; }
.scan-shell { width: min(calc(100% - 40px), 1180px); margin-inline: auto; }
.scan-header { border-bottom: 1px solid rgb(255 255 255 / 9%); background: #121918; }
.scan-header-inner { display: grid; min-height: 64px; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; }
.back-link { color: #aab6b3; font-size: .82rem; }.back-link:hover { color: #fff; }
.room-status { min-width: 0; text-align: center; }.room-status h1 { margin: 0; overflow: hidden; font-size: .9rem; text-overflow: ellipsis; white-space: nowrap; }.room-status p { margin: 2px 0 0; color: #8a9895; font-size: .76rem; }
.progress-readout { justify-self: end; color: #8a9895; font-size: .8rem; }.scan-content { padding-block: 24px 40px; }
.eyebrow { margin: 0 0 8px; color: #86b9ae; font-size: .72rem; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
h2 { margin: 0; font-size: clamp(1.35rem, 3vw, 1.75rem); font-weight: 620; letter-spacing: -.03em; line-height: 1.2; }
.permission-gate,.processing-panel,.recovery-panel,.manual-panel { max-width: 620px; margin: 48px auto 0; }
.permission-gate>p,.processing-panel>p,.recovery-panel>p,.manual-panel>p { color: #9aa8a4; line-height: 1.55; }
.setup-notice,.next-capture { margin-top: 18px; border-left: 2px solid #78a89e; padding: 10px 12px; background: #17201f; color: #b8c5c1; font-size: .86rem; line-height: 1.5; }.setup-notice a { color: #a9ded2; text-decoration: underline; }
.gate-status,.gate-error { margin-top: 18px; color: #d9c083; }.gate-actions,.recovery-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }.privacy-note { color: #71807c !important; font-size: .76rem; }
.capture-workspace,.result-workspace { display: grid; grid-template-columns: minmax(0,1fr) 330px; gap: 1px; overflow: hidden; border: 1px solid #2d3936; border-radius: var(--radius-media); background: #2d3936; }
.capture-canvas { position: relative; min-width: 0; height: min(720px,calc(100svh - 140px)); min-height: 460px; overflow: hidden; background: #050807; }
.camera-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #050807; }.camera-placeholder { position: absolute; inset: 0; display: grid; place-items: center; color: #8d9c98; }
.canvas-topbar { position: absolute; z-index: 4; top: 14px; right: 14px; left: 14px; display: flex; justify-content: space-between; pointer-events: none; }.live-label,.camera-switch { border: 1px solid rgb(255 255 255 / 15%); border-radius: 999px; padding: 7px 10px; background: rgb(5 8 7 / 78%); color: #d4dfdc; font-size: .73rem; }.live-label i { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: #78d0bd; }.camera-switch { cursor: pointer; pointer-events: auto; }
.frame-guide { position: absolute; inset: 12%; z-index: 2; border: 1px solid rgb(235 249 245 / 42%); border-radius: 3px; pointer-events: none; }.capture-flash { position: absolute; z-index: 6; top: 50%; left: 50%; padding: 9px 15px; border: 1px solid #5a9b8d; border-radius: 8px; background: rgb(15 22 21 / 92%); transform: translate(-50%,-50%); }
.capture-guidance { display: flex; min-width: 0; flex-direction: column; justify-content: space-between; gap: 24px; padding: 22px 20px 18px; background: #17201f; }.guidance-kicker { margin: 0; color: #7d8a86; font-size: .74rem; }.capture-guidance h2 { margin-top: 8px; font-size: 1.15rem; }.capture-guidance p { color: #9aa8a4; font-size: .86rem; line-height: 1.55; }.micro-feedback { color: #a9ded2 !important; }.view-progress { display: grid; gap: 9px; margin: 24px 0 0; padding: 18px 0 0; border-top: 1px solid #2b3835; list-style: none; }.view-progress li { display: grid; grid-template-columns: 22px 1fr; color: #788682; font-size: .76rem; }.view-progress li.current { color: #fff; }.view-progress li.complete { color: #94c7bc; }.capture-button,.primary-action { width: 100%; min-height: 46px; }
.processing-panel { text-align: center; }.processing-panel p { max-width: 540px; margin-inline: auto; }.spinner { width: 34px; height: 34px; margin: 0 auto 22px; border: 2px solid #40504c; border-top-color: #9ccfc5; border-radius: 50%; animation: spin .8s linear infinite; }.job-progress { margin-top: 18px; color: #86b9ae; font-size: .8rem; }@keyframes spin { to { transform: rotate(360deg); } }
.result-workspace { grid-template-columns: minmax(0,1.05fr) minmax(390px,.95fr); background: #111817; }.evidence-summary,.estimate-review { min-width: 0; padding: 26px; }.evidence-summary { border-right: 1px solid #2d3936; }.section-heading { display: flex; justify-content: space-between; gap: 18px; }.text-button { min-height: 34px; border: 0; padding: 0; background: transparent; color: #9ccfc5; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.evidence-strip { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 22px; }.evidence-strip figure { min-width: 0; margin: 0; overflow: hidden; border: 1px solid #2d3936; border-radius: 8px; }.evidence-strip img { display: block; width: 100%; aspect-ratio: 4/3; object-fit: cover; }.evidence-strip figcaption { overflow: hidden; padding: 7px; color: #91a09c; font-size: .67rem; text-overflow: ellipsis; white-space: nowrap; }.shape-note,.form-intro { color: #8f9d99; font-size: .8rem; line-height: 1.5; }
.estimate-review { display: grid; align-content: start; gap: 17px; background: #17201f; }.estimate-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }.estimate-grid article { display: grid; gap: 3px; padding: 12px; border: 1px solid #34423f; border-radius: 8px; background: #111817; }.estimate-grid article>span:first-child { color: #9ba9a5; font-size: .72rem; }.estimate-grid strong { font-size: 1.25rem; }.estimate-grid small { font-size: .7rem; font-weight: 400; }.range,.support { color: #879590; font-size: .68rem; line-height: 1.35; }.next-capture { display: grid; gap: 6px; margin: 0; }.next-capture .button { margin-top: 4px; }
.field { display: grid; gap: 6px; color: #b5c1bd; font-size: .75rem; }.field span { display: flex; justify-content: space-between; gap: 6px; }.field small { color: #75837f; }.field input { width: 100%; min-width: 0; min-height: 44px; border: 1px solid #3a4945; border-radius: 8px; padding: 0 11px; background: #101716; color: #f2f6f5; }.opening-fields,.dimension-fields { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }.dimension-fields { grid-template-columns: repeat(3,1fr); }.manual-panel form { display: grid; gap: 16px; margin-top: 22px; }.submit-error { margin: 0; border-left: 2px solid #d9ae63; padding-left: 10px; color: #e5c991; font-size: .8rem; line-height: 1.5; }.partial-list { display: grid; gap: 5px; color: #a9b6b2; font-size: .85rem; }
@media (max-width:900px) { .capture-workspace,.result-workspace { grid-template-columns:1fr; }.capture-canvas { height:min(58svh,560px); min-height:340px; }.capture-guidance { min-height:280px; }.evidence-summary { border-right:0; border-bottom:1px solid #2d3936; } }
@media (max-width:580px) { .scan-shell { width:min(calc(100% - 24px),1180px); }.scan-header-inner { grid-template-columns:auto minmax(0,1fr) auto; gap:9px; }.back-link { font-size:0; }.back-link::first-letter { font-size:1rem; }.scan-content { padding-block:12px 28px; }.permission-gate,.processing-panel,.recovery-panel,.manual-panel { margin-top:28px; }.gate-actions,.recovery-actions { display:grid; }.capture-canvas { height:min(54svh,460px); min-height:300px; }.capture-guidance { min-height:260px; padding:18px 16px calc(16px + env(safe-area-inset-bottom,0px)); }.evidence-summary,.estimate-review { padding:20px 16px; }.evidence-strip { gap:5px; }.estimate-grid,.dimension-fields { grid-template-columns:1fr; }.estimate-grid article { grid-template-columns:1fr auto; }.estimate-grid article strong { grid-row:1/3; grid-column:2; }.opening-fields { grid-template-columns:1fr 1fr; } }
</style>
