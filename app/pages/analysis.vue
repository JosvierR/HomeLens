<script setup lang="ts">
import type { MeasurementEvidence } from '~~/shared/calibration'

const route = useRoute()
const { scan, isDemo, verifyMeasurement, resetScan, verificationPending, verificationError } = useDemoScan()
if (route.query.demo === '1') resetScan()
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

const unresolvedMeasurements = computed(() => scan.value.measurements.filter(item => {
  if (item.source === 'manual') return false
  const calibrated = calibration.value?.measurements[item.id]
  return (calibrated?.applied ? calibrated.calibratedConfidence : item.confidence) < .75
}))
const prioritizedVerification = computed(() => result.value?.verificationQueue ?? [])
const recommendedMeasurement = computed(() => scan.value.measurements.find(item => item.id === rescueAction.value?.measurementId))
const recommendedPriority = computed(() =>
  prioritizedVerification.value.find(item => item.measurementId === rescueAction.value?.measurementId)
)

const feedbackCopy = computed(() => {
  if (!lastEvidence.value || !savedMeasurementId.value) return null
  const before = Math.round(lastEvidence.value.decisionStabilityBefore * 100)
  const after = Math.round(lastEvidence.value.decisionStabilityAfter * 100)
  const removedLargest = lastEvidence.value.stabilityGain > 0.05 && after > before

  let detail = `Thanks. Reliability moved from ${before}% to ${after}%.`
  if (removedLargest) detail = 'That removed the largest source of uncertainty.'
  else if (after < before) detail = `Thanks. Reliability moved from ${before}% to ${after}%.`
  else if (after === before) detail = 'Thanks. The reliability stayed about the same.'

  const nextLine = rescueAction.value?.status === 'needs_verification'
    ? 'The result is still sensitive to one other measurement.'
    : 'Nothing else needs checking right now.'

  return { detail, nextLine }
})

const learningInsight = computed(() => {
  const id = selectedMeasurementId.value ?? rescueAction.value?.measurementId
  const suggestion = id ? calibration.value?.measurements[id] : null
  const fallback = suggestion ?? Object.values(calibration.value?.measurements ?? {}).find(item => item.applied) ?? null
  if (!fallback) {
    return {
      rawConfidence: recommendedMeasurement.value?.rawConfidence ?? recommendedMeasurement.value?.confidence ?? 0,
      calibratedConfidence: null as number | null,
      applied: false,
      sampleCount: 0,
      explanation: 'Not enough comparable history yet. Using model confidence.'
    }
  }
  return {
    rawConfidence: fallback.rawConfidence,
    calibratedConfidence: fallback.applied ? fallback.calibratedConfidence : null,
    applied: fallback.applied,
    sampleCount: fallback.sampleCount,
    explanation: fallback.reason
  }
})

const selectMeasurement = (id: string) => { selectedMeasurementId.value = id }

const startVerification = async (id: string) => {
  const measurement = scan.value.measurements.find(item => item.id === id)
  const priority = prioritizedVerification.value.find(item => item.measurementId === id)
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
    savedTimer = setTimeout(() => { savedMeasurementId.value = null }, 8000)
    const before = Math.round(response.evidence.decisionStabilityBefore * 100)
    const after = Math.round(response.evidence.decisionStabilityAfter * 100)
    announcement.value = `${label} verified. Decision stability moved from ${before} percent to ${after} percent.`
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
  announcement.value = 'Demo measurements restored.'
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
        <div>
          <h1>{{ scan.roomName }}</h1>
          <p class="room-metadata numeric">
            Scan complete
            <span aria-hidden="true">·</span>
            {{ scan.measurements.length }} measurements
            <span aria-hidden="true">·</span>
            <template v-if="unresolvedMeasurements.length">
              {{ unresolvedMeasurements.length }} worth checking
            </template>
            <template v-else>all verified</template>
          </p>
        </div>
        <div class="room-actions">
          <button v-if="isDemo" type="button" class="reset-link" @click="reset">Reset demo</button>
          <span v-else class="capture-source numeric" aria-label="Analysis source: real camera scan">Camera scan</span>
          <NuxtLink to="/scan" class="button button--secondary button--small">New scan</NuxtLink>
        </div>
      </header>

      <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

      <div v-if="feedbackCopy" class="learning-feedback" role="status">
        <p><strong>Verified.</strong> {{ feedbackCopy.detail }}</p>
        <p>{{ feedbackCopy.nextLine }}</p>
      </div>

      <div v-if="scan.measurements.length" class="analysis-stack">
        <RecommendationPanel
          class="recommendation-area"
          :result="result"
          :rescue-action="rescueAction"
          :measurement="recommendedMeasurement"
          :priority="recommendedPriority"
          :pending="pending"
          :error-message="errorMessage"
          :disabled="pending || verificationPending"
          @verify="startVerification"
          @retry="analyze"
        />

        <div class="evidence-pair">
          <section class="geometry-area" aria-labelledby="geometry-title">
            <div class="geometry-heading">
              <h2 id="geometry-title">Room geometry</h2>
              <p>Select a dimension to highlight it in the measurements below.</p>
            </div>
            <RoomGeometry
              :measurements="scan.measurements"
              :windows="scan.windows"
              :doors="scan.doors"
              :selected-id="selectedMeasurementId"
              @select="selectMeasurement"
            />
          </section>

          <ScanRescuePanel
            class="check-area"
            :action="rescueAction"
            :measurement="recommendedMeasurement"
            :queue="prioritizedVerification"
            :selected-id="selectedMeasurementId"
            :pending="pending"
            :error-message="errorMessage"
            :disabled="pending || verificationPending"
            @verify="startVerification"
            @retry="analyze"
            @select="selectMeasurement"
          />
        </div>

        <section class="measurements-area" aria-labelledby="measurements-title">
          <h2 id="measurements-title" class="section-label">Measurements</h2>
          <p class="area-note">Checking a value marks it as verified and updates the result.</p>
          <MeasurementTable
            :measurements="scan.measurements"
            :priorities="prioritizedVerification"
            :selected-id="selectedMeasurementId"
            :recommended-id="rescueAction?.status === 'needs_verification' ? rescueAction.measurementId : null"
            :editing-id="editingMeasurementId"
            :saving-id="verificationPendingId"
            :saved-id="savedMeasurementId"
            :error-id="verificationErrorId"
            :error-message="verificationError"
            :disabled="pending || verificationPending"
            @save="saveMeasurement"
            @select="selectMeasurement"
            @edit-state="handleEditState"
          />
        </section>

        <SensitivitySummary
          class="sensitivity-area"
          :result="result"
          :pending="pending"
          :error-message="errorMessage"
        />

        <LearningInsight
          class="learning-area"
          :raw-confidence="learningInsight.rawConfidence"
          :calibrated-confidence="learningInsight.calibratedConfidence"
          :applied="learningInsight.applied"
          :sample-count="learningInsight.sampleCount"
          :explanation="learningInsight.explanation"
        />

        <CalibrationInsight
          class="calibration-area"
          :calibration="calibration"
          :measurement-id="selectedMeasurementId ?? rescueAction?.measurementId"
          :pending="pending"
          :error-message="errorMessage"
        />

        <TechnicalDetails
          class="technical-area"
          :scan="scan"
          :result="result"
          :rescue="rescueAction"
          :calibration="calibration"
        />
      </div>

      <div v-else class="empty-analysis">
        <h2>No measurements yet</h2>
        <p>Complete a room scan to generate measurements.</p>
        <NuxtLink to="/scan" class="button">Start scan</NuxtLink>
      </div>

      <p class="model-note">
        <template v-if="isDemo">
          This sample uses synthetic measurements to demonstrate scenario analysis. Start a new scan to use your camera and real values.
        </template>
        <template v-else>
          This result uses the dimensions you entered after the camera evidence passed local quality checks. It does not infer absolute scale from uncalibrated photos.
        </template>
      </p>
    </main>
  </div>
</template>

<style scoped>
.analysis-page {
  min-height: 100vh;
  background: var(--canvas);
}

.analysis-main {
  max-width: 1280px;
  padding-block: 24px 48px;
}

.room-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 18px;
}

.room-header h1 {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 620;
  letter-spacing: -0.032em;
  line-height: 1.2;
}

.room-metadata {
  margin: 4px 0 0;
  color: var(--text-tertiary);
  font-size: 0.82rem;
}

.room-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.reset-link {
  min-height: 32px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
}

.reset-link:hover {
  color: var(--text-secondary);
  text-decoration-color: var(--border-strong);
}

.capture-source {
  color: var(--text-tertiary);
  font-size: 0.76rem;
}

.learning-feedback {
  margin: 0 0 18px;
  border-left: 2px solid var(--success);
  padding: 2px 0 2px 12px;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.5;
}

.learning-feedback p { margin: 0; }
.learning-feedback p + p { margin-top: 2px; }
.learning-feedback strong { color: var(--text-primary); }

.analysis-stack {
  display: grid;
  gap: 28px;
}

.evidence-pair {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 24px;
  align-items: start;
}

.geometry-area {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-media);
  background: var(--surface);
}

.geometry-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px 0;
}

.geometry-heading h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 620;
  letter-spacing: -0.015em;
}

.geometry-heading p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.76rem;
  text-align: right;
}

.area-note {
  margin: 3px 0 12px;
  color: var(--text-tertiary);
  font-size: 0.79rem;
}

.sensitivity-area,
.calibration-area,
.technical-area {
  border-top: 1px solid var(--border);
  padding-top: 22px;
}

.empty-analysis {
  border-top: 1px solid var(--border);
  padding: 48px 0;
}

.empty-analysis h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 620;
}

.empty-analysis p {
  margin: 5px 0 16px;
  color: var(--text-secondary);
  font-size: 0.86rem;
}

.model-note {
  max-width: 720px;
  margin: 32px 0 0;
  border-top: 1px solid var(--border);
  padding-top: 14px;
  color: var(--text-tertiary);
  font-size: 0.76rem;
  line-height: 1.55;
}

@media (max-width: 960px) {
  .evidence-pair {
    grid-template-columns: 1fr;
  }

  .geometry-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .geometry-heading p { text-align: left; }

  /* Mobile order: recommendation already first; check panel before geometry */
  .analysis-stack {
    display: flex;
    flex-direction: column;
  }

  .recommendation-area { order: 1; }
  .evidence-pair { order: 2; display: contents; }
  .check-area { order: 3; }
  .geometry-area { order: 4; }
  .measurements-area { order: 5; }
  .sensitivity-area { order: 6; }
  .calibration-area { order: 7; }
  .technical-area { order: 8; }
}

@media (max-width: 600px) {
  .analysis-main { padding-block: 20px 36px; }

  .room-header {
    flex-direction: column;
    gap: 14px;
  }

  .room-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
