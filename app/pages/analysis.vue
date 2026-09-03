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

const unresolvedMeasurements = computed(() => scan.value.measurements.filter(item => {
  if (item.source === 'manual') return false
  const calibrated = calibration.value?.measurements[item.id]
  return (calibrated?.applied ? calibrated.calibratedConfidence : item.confidence) < .75
}))
const prioritizedVerification = computed(() => result.value?.verificationQueue ?? [])
const recommendedMeasurement = computed(() => scan.value.measurements.find(item => item.id === rescueAction.value?.measurementId))

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
        <div>
          <h1>{{ scan.roomName }}</h1>
          <p class="room-metadata numeric">
            {{ scan.measurements.length }} measurements ·
            {{ unresolvedMeasurements.length ? `${unresolvedMeasurements.length} unresolved` : 'all verified' }}
          </p>
        </div>
        <div class="room-actions">
          <button type="button" class="button button--ghost button--small" @click="reset">Reset sample</button>
        </div>
      </header>

      <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

      <p v-if="savedMeasurementId && lastEvidence" class="learning-feedback" role="status">
        Verification saved. {{ lastEvidence.absoluteError > .0001 ? 'This correction' : 'This verification' }} added evidence to the calibration dataset.
      </p>

      <div v-if="scan.measurements.length" class="analysis-layout">
        <div class="analysis-column">
          <section class="geometry-area" aria-labelledby="geometry-title">
            <h2 id="geometry-title" class="sr-only">Room geometry</h2>
            <RoomGeometry
              :measurements="scan.measurements"
              :windows="scan.windows"
              :doors="scan.doors"
              :selected-id="selectedMeasurementId"
              @select="selectMeasurement"
            />
          </section>

          <section class="measurements-area" aria-labelledby="measurements-title">
            <h2 id="measurements-title" class="section-label">Measurements</h2>
            <p class="area-note">Editing a value records it as human-verified and recomputes the decision.</p>
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

          <SensitivitySummary class="sensitivity-area" :result="result" :pending="pending" :error-message="errorMessage" />

          <CalibrationInsight
            class="calibration-area"
            :calibration="calibration"
            :measurement-id="selectedMeasurementId ?? rescueAction?.measurementId"
            :pending="pending"
            :error-message="errorMessage"
          />
        </div>

        <div class="analysis-rail">
          <DecisionStabilityPanel
            class="stability-area"
            :result="result"
            :rescue-action="rescueAction"
            :pending="pending"
            :error-message="errorMessage"
            @retry="analyze"
          />

          <ScanRescuePanel
            class="rescue-area"
            :action="rescueAction"
            :measurement="recommendedMeasurement"
            :pending="pending"
            :error-message="errorMessage"
            :disabled="pending || verificationPending"
            @verify="startVerification"
            @retry="analyze"
          />

          <VerificationQueue
            class="queue-area"
            :items="prioritizedVerification"
            :selected-id="selectedMeasurementId"
            :pending="pending"
            @select="selectMeasurement"
          />
        </div>
      </div>

      <div v-else class="empty-analysis">
        <h2>No measurements yet</h2>
        <p>Complete a room scan to generate measurements.</p>
        <NuxtLink to="/scan" class="button">Start scan</NuxtLink>
      </div>

      <p class="model-note">
        HomeLens uses a non-certified planning proxy in this demo. Its purpose is to show how measurement
        uncertainty can be inspected and resolved before it changes a downstream decision.
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
  padding-block: 24px 40px;
}

.room-header {
  display: flex;
  align-items: baseline;
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
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.room-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.learning-feedback {
  margin: 0 0 16px;
  border-left: 2px solid var(--success);
  padding-left: 12px;
  color: var(--text-secondary);
  font-size: 0.81rem;
}

/*
 * Two columns, one vertical rule. The rail holds the decision, the next
 * action and the queue; nothing else earns a place there.
 */
.analysis-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.68fr) minmax(288px, 0.82fr);
  align-items: start;
  gap: 32px;
}

.analysis-column,
.analysis-rail {
  min-width: 0;
}

.analysis-rail {
  border-left: 1px solid var(--border);
  padding-left: 32px;
}

.analysis-column > section + section,
.analysis-rail > section + section {
  margin-top: 22px;
  border-top: 1px solid var(--border);
  padding-top: 22px;
}

.geometry-area {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-media);
  background: var(--surface);
}

.area-note {
  margin: 3px 0 12px;
  color: var(--text-tertiary);
  font-size: 0.79rem;
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

@media (max-width: 1000px) {
  .analysis-layout {
    grid-template-columns: 1fr;
    gap: 0;
  }

  /* Flatten both wrappers so the mobile reading order can put the decision
     and the next action ahead of the measurement workspace. */
  .analysis-column,
  .analysis-rail {
    display: contents;
  }

  .analysis-layout > * > section {
    margin-top: 22px;
    border-top: 1px solid var(--border);
    padding-top: 22px;
  }

  .geometry-area {
    order: 1;
    margin-top: 0 !important;
    border: 1px solid var(--border) !important;
    padding-top: 0 !important;
  }

  .stability-area { order: 2; }
  .rescue-area { order: 3; }
  .measurements-area { order: 4; }
  .queue-area { order: 5; }
  .sensitivity-area { order: 6; }
  .calibration-area { order: 7; }
}

@media (max-width: 600px) {
  .analysis-main { padding-block: 20px 32px; }

  .room-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }
}
</style>
