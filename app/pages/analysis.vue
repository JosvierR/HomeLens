<script setup lang="ts">
import type { MeasurementEvidence } from '~~/shared/calibration'

const { scan, verifyMeasurement, resetScan, verificationPending, verificationError } = useDemoScan()
const { analysis, pending, errorMessage, analyze } = useHomeLensAnalysis(scan)
const { track } = useProductAnalytics()

const result = computed(() => analysis.value?.decision ?? null)
const rescueAction = computed(() => analysis.value?.rescue ?? null)
const calibration = computed(() => analysis.value?.calibration ?? null)
const selectedMeasurementId = ref<string | null>('height')
const editingMeasurementId = ref<string | null>(null)
const verificationPendingId = ref<string | null>(null)
const verificationErrorId = ref<string | null>(null)
const savedMeasurementId = ref<string | null>(null)
const lastEvidence = ref<MeasurementEvidence | null>(null)
const announcement = ref('')
let savedTimer: ReturnType<typeof setTimeout> | undefined
let lastDecisionEvent = ''
let lastCalibrationEvent = ''

const floorArea = computed(() => {
  const width = scan.value.measurements.find(item => item.id === 'width')?.value ?? 0
  const length = scan.value.measurements.find(item => item.id === 'length')?.value ?? 0
  return Math.round(width * length)
})

const unresolvedMeasurements = computed(() => scan.value.measurements.filter(item => {
  if (item.source === 'manual') return false
  const calibrated = calibration.value?.measurements[item.id]
  return (calibrated?.applied ? calibrated.calibratedConfidence : item.confidence) < .75
}))
const prioritizedVerification = computed(() => result.value?.verificationQueue ?? [])
const recommendedMeasurement = computed(() => scan.value.measurements.find(item => item.id === rescueAction.value?.measurementId))
const priorityFor = (id: string) => prioritizedVerification.value.find(item => item.measurementId === id)

const selectMeasurement = (id: string) => { selectedMeasurementId.value = id }

const startVerification = async (id: string) => {
  const measurement = scan.value.measurements.find(item => item.id === id)
  const priority = priorityFor(id)
  track('measurement_verification_started', {
    measurementType: id,
    rawConfidence: measurement?.rawConfidence ?? measurement?.confidence ?? null,
    calibratedConfidence: priority?.calibratedConfidence ?? null,
    stabilityBefore: result.value?.bandStability ?? null
  })
  selectedMeasurementId.value = id
  editingMeasurementId.value = id
  await nextTick()
  document.getElementById(`measurement-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const handleEditState = (id: string, editing: boolean) => {
  if (!editing && editingMeasurementId.value === id) editingMeasurementId.value = null
}

const saveMeasurement = async (id: string, value: number) => {
  if (verificationPending.value) return
  const label = scan.value.measurements.find(item => item.id === id)?.label ?? 'Measurement'
  verificationPendingId.value = id
  verificationErrorId.value = null
  savedMeasurementId.value = null
  try {
    const response = await verifyMeasurement(id, value)
    if (!response) return
    analysis.value = response.analysis
    editingMeasurementId.value = null
    lastEvidence.value = response.evidence
    savedMeasurementId.value = id
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => { savedMeasurementId.value = null }, 2600)
    const evidenceMessage = response.evidence.absoluteError > 0.0001
      ? 'This correction added evidence to the calibration dataset.'
      : 'This verification added evidence to the calibration dataset.'
    announcement.value = `${label} saved as a human-verified value. ${evidenceMessage} Decision stability is ${Math.round(response.analysis.decision.bandStability * 100)} percent.`
    track('measurement_manually_verified', {
      measurementType: id,
      rawConfidence: response.evidence.estimatedConfidence,
      stabilityBefore: response.evidence.decisionStabilityBefore,
      stabilityAfter: response.evidence.decisionStabilityAfter,
      stabilityGain: response.evidence.stabilityGain
    })
    track('evidence_recorded', { measurementType: id, evidenceCount: 1 })
    if (response.evidence.decisionStabilityBefore < .9 && response.evidence.decisionStabilityAfter >= .9) {
      track('decision_stabilized', {
        measurementType: id,
        stabilityBefore: response.evidence.decisionStabilityBefore,
        stabilityAfter: response.evidence.decisionStabilityAfter,
        stabilityGain: response.evidence.stabilityGain
      })
    }
  } catch {
    verificationErrorId.value = id
    announcement.value = `${label} could not be saved. The original estimate remains unchanged.`
  } finally {
    verificationPendingId.value = null
  }
}

const reset = () => {
  resetScan()
  selectedMeasurementId.value = 'height'
  editingMeasurementId.value = null
  verificationErrorId.value = null
  savedMeasurementId.value = null
  lastEvidence.value = null
  announcement.value = 'Sample measurements restored.'
}

watch(pending, (isPending, wasPending) => {
  if (wasPending && !isPending && result.value) {
    announcement.value = `Decision stability updated to ${Math.round(result.value.bandStability * 100)} percent.`
  }
})

watch(analysis, current => {
  if (!current) return
  const topMeasurement = current.rescue.measurementId
  const decisionSignature = `${current.decision.stabilityLabel}:${topMeasurement ?? 'none'}`
  if (current.rescue.status === 'needs_verification' && topMeasurement && decisionSignature !== lastDecisionEvent) {
    lastDecisionEvent = decisionSignature
    track('decision_unstable', {
      measurementType: topMeasurement,
      stabilityBefore: current.decision.bandStability,
      unresolvedCount: current.decision.verificationQueue.length
    })
    track('verification_requested', {
      measurementType: topMeasurement,
      stabilityBefore: current.rescue.currentStability,
      stabilityAfter: current.rescue.projectedStability ?? null,
      stabilityGain: current.rescue.stabilityGain ?? null
    })
  }
  const applied = Object.entries(current.calibration.measurements).find(([, item]) => item.applied)
  if (applied) {
    const [measurementType, suggestion] = applied
    const calibrationSignature = `${measurementType}:${suggestion.scope}:${suggestion.sampleCount}`
    if (calibrationSignature !== lastCalibrationEvent) {
      lastCalibrationEvent = calibrationSignature
      track('calibration_applied', {
        measurementType,
        rawConfidence: suggestion.rawConfidence,
        calibratedConfidence: suggestion.calibratedConfidence,
        calibrationScope: suggestion.scope,
        evidenceCount: suggestion.sampleCount
      })
    }
  }
})

onMounted(() => {
  track('analysis_viewed', {
    measurementCount: scan.value.measurements.length,
    unresolvedCount: unresolvedMeasurements.value.length,
    captureMethod: scan.value.captureMethod ?? null
  })
})

onBeforeUnmount(() => clearTimeout(savedTimer))
</script>

<template>
  <div class="analysis-page">
    <AppHeader />

    <main class="page-container analysis-main">
      <header class="room-header">
        <div class="room-identity">
          <p class="eyebrow">Room analysis</p>
          <h1>{{ scan.roomName }}</h1>
          <div class="room-metadata" aria-label="Scan summary">
            <span class="complete"><i aria-hidden="true" /> Scan complete</span>
            <span>{{ scan.measurements.length }} measurements</span>
            <span>{{ unresolvedMeasurements.length }} unresolved verification{{ unresolvedMeasurements.length === 1 ? '' : 's' }}</span>
          </div>
        </div>
        <div class="room-actions">
          <button type="button" class="button button--ghost button--small" @click="reset">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 5.5A5.4 5.4 0 1 1 3 10.2M3.2 5.5V2.4M3.2 5.5h3.1" /></svg>
            Reset
          </button>
          <NuxtLink to="/scan" class="button button--secondary button--small">New scan</NuxtLink>
        </div>
      </header>

      <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

      <div v-if="savedMeasurementId && lastEvidence" class="learning-feedback" role="status">
        <span aria-hidden="true">✓</span>
        <p><strong>Verification saved.</strong> {{ lastEvidence.absoluteError > .0001 ? 'This correction added evidence to the calibration dataset.' : 'This verification added evidence to the calibration dataset.' }}</p>
      </div>

      <div v-if="scan.measurements.length" class="analysis-layout">
        <section class="geometry-area surface" aria-labelledby="geometry-title">
          <div class="area-heading">
            <div><p class="eyebrow">Room overview</p><h2 id="geometry-title">Inspectable geometry</h2></div>
            <p>Select a dimension to trace it through the analysis.</p>
          </div>
          <RoomGeometry
            :measurements="scan.measurements"
            :windows="scan.windows"
            :doors="scan.doors"
            :selected-id="selectedMeasurementId"
            @select="selectMeasurement"
          />
          <div class="room-context" aria-label="Physical room context">
            <div><span>Floor area</span><strong>{{ floorArea }} ft²</strong></div>
            <div><span>Windows detected</span><strong>{{ scan.windows }}</strong></div>
            <div><span>Doors detected</span><strong>{{ scan.doors }}</strong></div>
            <div><span>Model status</span><strong>Inspectable</strong></div>
          </div>
        </section>

        <DecisionStabilityPanel
          class="decision-area"
          :result="result"
          :rescue-action="rescueAction"
          :pending="pending"
          :error-message="errorMessage"
          @retry="analyze"
        />

        <ScanRescueCard
          class="rescue-area"
          :action="rescueAction"
          :measurement="recommendedMeasurement"
          :pending="pending"
          :error-message="errorMessage"
          :disabled="pending || verificationPending"
          @verify="startVerification"
          @retry="analyze"
        />

        <CalibrationInsight
          class="calibration-area"
          :calibration="calibration"
          :measurement-id="selectedMeasurementId ?? rescueAction?.measurementId"
          :pending="pending"
          :error-message="errorMessage"
        />

        <section class="measurements-area" aria-labelledby="measurements-title">
          <div class="area-heading measurement-heading">
            <div>
              <p class="eyebrow">Measured inputs</p>
              <h2 id="measurements-title">Measurements</h2>
            </div>
            <p>Editing an estimate records human provenance and recomputes the decision model.</p>
          </div>
          <div class="measurement-grid">
            <MeasurementCard
              v-for="measurement in scan.measurements"
              :key="measurement.id"
              :measurement="measurement"
              :priority="priorityFor(measurement.id)"
              :selected="selectedMeasurementId === measurement.id"
              :recommended="rescueAction?.status === 'needs_verification' && rescueAction.measurementId === measurement.id"
              :force-edit="editingMeasurementId === measurement.id"
              :disabled="pending || verificationPending"
              :saving="verificationPendingId === measurement.id"
              :saved="savedMeasurementId === measurement.id"
              :error-message="verificationErrorId === measurement.id ? verificationError : null"
              @save="saveMeasurement"
              @select="selectMeasurement"
              @edit-state="handleEditState"
            />
          </div>
        </section>

        <VerificationQueue
          class="queue-area"
          :items="prioritizedVerification"
          :selected-id="selectedMeasurementId"
          :pending="pending"
          @select="selectMeasurement"
        />

        <SensitivitySummary class="sensitivity-area" :result="result" :pending="pending" :error-message="errorMessage" />
      </div>

      <div v-else class="empty-analysis surface">
        <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 29V13l12-7 12 7v16M8 29h24M14 16h12v13" /></svg>
        <h2>No measurements available for this scan.</h2>
        <p>Capture at least width, length, and ceiling height before running the decision model.</p>
        <NuxtLink to="/scan" class="button">Start a new scan</NuxtLink>
      </div>

      <aside class="model-note" aria-label="Planning model note">
        <span>Planning model note</span>
        <p>HomeLens uses a non-certified planning proxy in this demo. Its purpose is to show how measurement uncertainty can be inspected and resolved before it changes a downstream decision.</p>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.analysis-page {
  min-height: 100vh;
  background: var(--color-canvas);
}

.analysis-main {
  padding-block: 34px 48px;
}

.room-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--color-border);
}

.room-identity h1 {
  margin: 5px 0 0;
  font-size: clamp(2rem, 4vw, 2.7rem);
  font-weight: 620;
  letter-spacing: -0.05em;
  line-height: 1.1;
}

.room-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-top: 13px;
  color: var(--color-muted);
  font-size: 0.72rem;
}

.room-metadata span {
  display: inline-flex;
  align-items: center;
}

.room-metadata span + span::before {
  margin-inline: 9px;
  color: var(--color-border-strong);
  content: "/";
}

.room-metadata .complete {
  color: var(--color-high);
  font-weight: 650;
}

.room-metadata i {
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--color-high);
}

.room-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 5px;
}

.room-actions svg {
  width: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.35;
}

.learning-feedback {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  border: 1px solid #cbe1d3;
  border-radius: 10px;
  padding: 11px 14px;
  background: var(--color-high-soft);
  color: var(--color-muted);
  font-size: .73rem;
  line-height: 1.45;
}

.learning-feedback > span {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--color-high);
  color: #fff;
}

.learning-feedback p { margin: 0; }
.learning-feedback strong { color: var(--color-ink); }

.analysis-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.95fr) minmax(300px, .82fr);
  grid-template-areas:
    "geometry decision"
    "geometry rescue"
    "measurements calibration"
    "measurements queue"
    "sensitivity queue";
  align-items: start;
  gap: 18px;
  margin-top: 24px;
}

.geometry-area { grid-area: geometry; overflow: hidden; padding: 24px; }
.decision-area { grid-area: decision; }
.rescue-area { grid-area: rescue; }
.calibration-area { grid-area: calibration; }
.measurements-area { grid-area: measurements; min-width: 0; padding-top: 10px; }
.queue-area { grid-area: queue; }
.sensitivity-area { grid-area: sensitivity; }

.area-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.area-heading h2 {
  margin: 5px 0 0;
  font-size: 1.28rem;
  font-weight: 680;
  letter-spacing: -0.03em;
}

.area-heading > p {
  max-width: 270px;
  margin: 2px 0 0;
  color: var(--color-muted);
  font-size: 0.71rem;
  line-height: 1.5;
  text-align: right;
}

.geometry-area > :deep(.geometry) {
  margin-top: 20px;
}

.room-context {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-border);
}

.room-context div {
  min-width: 0;
  padding: 11px 12px;
  background: var(--color-surface);
}

.room-context span,
.room-context strong {
  display: block;
}

.room-context span {
  color: var(--color-muted);
  font-size: 0.61rem;
}

.room-context strong {
  margin-top: 3px;
  overflow: hidden;
  font-size: 0.76rem;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.measurement-heading {
  align-items: end;
  margin-bottom: 14px;
}

.measurement-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.model-note {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 24px;
  margin-top: 24px;
  border-top: 1px solid var(--color-border);
  padding-top: 18px;
  color: var(--color-muted);
  font-size: 0.69rem;
  line-height: 1.55;
}

.model-note span {
  color: var(--color-ink-soft);
  font-weight: 680;
}

.model-note p { max-width: 750px; margin: 0; }

.empty-analysis {
  display: grid;
  justify-items: center;
  margin-top: 24px;
  padding: 70px 24px;
  text-align: center;
}

.empty-analysis svg {
  width: 52px;
  fill: none;
  stroke: var(--color-accent);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.1;
}

.empty-analysis h2 { margin: 20px 0 0; font-size: 1.3rem; }
.empty-analysis p { max-width: 460px; margin: 8px 0 20px; color: var(--color-muted); font-size: .82rem; }

@media (max-width: 1100px) {
  .analysis-layout {
    grid-template-columns: minmax(0, 1.55fr) minmax(290px, .9fr);
  }

  .measurement-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 900px) {
  .analysis-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      "decision"
      "rescue"
      "calibration"
      "geometry"
      "measurements"
      "sensitivity"
      "queue";
  }

  .decision-area,
  .rescue-area,
  .calibration-area { width: 100%; }
  .measurement-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .analysis-main { padding-block: 26px 38px; }
  .room-header { align-items: flex-start; flex-direction: column; gap: 18px; padding-bottom: 22px; }
  .room-actions { width: 100%; }
  .room-actions .button { flex: 1; }
  .geometry-area { padding: 18px; }
  .area-heading { align-items: flex-start; flex-direction: column; gap: 5px; }
  .area-heading > p { max-width: 500px; text-align: left; }
  .room-context { grid-template-columns: repeat(2, 1fr); }
  .measurement-grid { grid-template-columns: 1fr; }
  .measurement-heading { margin-bottom: 12px; }
  .model-note { grid-template-columns: 1fr; gap: 5px; }
}

@media (max-width: 390px) {
  .room-metadata { display: grid; gap: 3px; }
  .room-metadata span + span::before { display: none; }
  .room-context { grid-template-columns: 1fr 1fr; }
}
</style>
