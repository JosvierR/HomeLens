<script setup lang="ts">
import type { CalibrationAnalysis } from '~~/shared/analysis'

const props = withDefaults(defineProps<{
  calibration: CalibrationAnalysis | null
  measurementId?: string | null
  pending?: boolean
  errorMessage?: string | null
}>(), {
  measurementId: null,
  pending: false,
  errorMessage: null
})

const expanded = ref(false)

const insight = computed(() => {
  if (!props.calibration) return null
  if (props.measurementId && props.calibration.measurements[props.measurementId]) {
    return props.calibration.measurements[props.measurementId]
  }
  return Object.values(props.calibration.measurements).find(item => item.applied)
    ?? Object.values(props.calibration.measurements)[0]
    ?? null
})

const rawPercent = computed(() => Math.round((insight.value?.rawConfidence ?? 0) * 100))
const calibratedPercent = computed(() => Math.round((insight.value?.calibratedConfidence ?? 0) * 100))
const qualityLabel = computed(() => {
  const quality = props.calibration?.summary.quality ?? 'insufficient'
  return quality === 'insufficient' ? 'insufficient' : quality
})
</script>

<template>
  <section class="calibration-panel" aria-labelledby="calibration-title" :aria-busy="pending">
    <h2 id="calibration-title" class="section-label">Confidence calibration</h2>

    <div v-if="pending && !calibration" class="calibration-loading">
      <div class="skeleton" />
    </div>
    <p v-else-if="errorMessage && !calibration" class="calibration-fallback" role="alert">
      Calibration is unavailable. Raw model confidence is shown unchanged.
    </p>
    <p v-else-if="!calibration || !insight" class="calibration-fallback">
      No calibration evidence yet. Raw model confidence is used unchanged.
    </p>
    <template v-else>
      <dl class="calibration-figures">
        <div>
          <dt>Raw model</dt>
          <dd class="numeric">{{ rawPercent }}%</dd>
        </div>
        <div>
          <dt>Calibrated</dt>
          <dd class="numeric">{{ insight.applied ? `${calibratedPercent}%` : '—' }}</dd>
        </div>
      </dl>

      <p class="calibration-basis">
        Based on <span class="numeric">{{ insight.sampleCount }}</span> comparable
        observation{{ insight.sampleCount === 1 ? '' : 's' }} of {{ qualityLabel }} quality<template v-if="insight.demoEvidence">, including synthetic demo evidence</template>.
      </p>

      <button
        type="button"
        class="explanation-button"
        :aria-expanded="expanded"
        aria-controls="calibration-explanation"
        @click="expanded = !expanded"
      >How calibration works</button>
      <div v-show="expanded" id="calibration-explanation" class="calibration-explanation">
        <p>{{ insight.reason }}</p>
        <p>HomeLens compares earlier model estimates against later human-verified measurements in the same confidence range, and only applies an adjustment once a minimum sample threshold is met. Raw confidence is always retained.</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* Calibration supports the decision rather than being the user's task,
   so it is a compact technical disclosure. */
.calibration-figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, max-content));
  gap: 4px 40px;
  margin: 10px 0 0;
}

.calibration-figures div {
  display: contents;
}

.calibration-figures dt {
  color: var(--text-tertiary);
  font-size: 0.81rem;
}

.calibration-figures dd {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.83rem;
  font-weight: 600;
}

.calibration-basis {
  margin: 12px 0 0;
  color: var(--text-secondary);
  font-size: 0.79rem;
  line-height: 1.55;
}

.calibration-fallback {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 0.81rem;
}

.explanation-button {
  min-height: 30px;
  margin-top: 6px;
  border: 0;
  padding: 6px 0 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.79rem;
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.explanation-button:hover { color: var(--text-primary); }

.calibration-explanation {
  margin-top: 8px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  color: var(--text-secondary);
  font-size: 0.79rem;
  line-height: 1.55;
}

.calibration-explanation p { margin: 0; }
.calibration-explanation p + p { margin-top: 8px; }

.calibration-loading .skeleton { height: 54px; margin-top: 10px; }
</style>
