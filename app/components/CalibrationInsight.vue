<script setup lang="ts">
import type { CalibrationAnalysis } from '~~/shared/analysis'
import { formatCount, formatPercent } from '~~/shared/format'

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

const open = ref(false)

const insight = computed(() => {
  if (!props.calibration) return null
  if (props.measurementId && props.calibration.measurements[props.measurementId]) {
    return props.calibration.measurements[props.measurementId]
  }
  return Object.values(props.calibration.measurements).find(item => item.applied)
    ?? Object.values(props.calibration.measurements)[0]
    ?? null
})

const qualityLabel = computed(() => {
  const quality = props.calibration?.summary.quality ?? 'insufficient'
  if (quality === 'insufficient') return 'Insufficient'
  return quality.charAt(0).toUpperCase() + quality.slice(1)
})

const isSynthetic = computed(() => insight.value?.demoEvidence ?? false)

const originLabel = computed(() => {
  switch (props.calibration?.summary.origin) {
    case 'synthetic_demo': return 'Synthetic demo history'
    case 'real_user_verification': return 'Real user verifications'
    case 'mixed': return 'Mixed synthetic and real'
    default: return 'No evidence yet'
  }
})
</script>

<template>
  <section class="calibration-panel" aria-labelledby="calibration-title" :aria-busy="pending">
    <button
      type="button"
      class="disclosure"
      :aria-expanded="open"
      aria-controls="calibration-body"
      @click="open = !open"
    >
      <span>
        <span id="calibration-title" class="section-label">Calibration details</span>
        <span class="disclosure-hint">Evidence origin, sample counts and calibration quality</span>
      </span>
      <span class="chevron" aria-hidden="true">{{ open ? '−' : '+' }}</span>
    </button>

    <div v-show="open" id="calibration-body" class="calibration-body">
      <div v-if="pending && !calibration" class="calibration-loading">
        <div class="skeleton" />
      </div>
      <p v-else-if="errorMessage && !calibration" class="calibration-fallback" role="alert">
        Calibration is unavailable. Raw model confidence is shown unchanged.
      </p>
      <p v-else-if="!calibration || !insight" class="calibration-fallback">
        No calibration evidence yet. The original model confidence is used unchanged.
      </p>
      <template v-else>
        <dl class="calibration-figures">
          <div>
            <dt>Model confidence</dt>
            <dd class="numeric">{{ formatPercent(insight.rawConfidence) }}</dd>
          </div>
          <div>
            <dt>{{ isSynthetic ? 'Demo-adjusted confidence' : 'Calibrated confidence' }}</dt>
            <dd class="numeric">{{ insight.applied ? formatPercent(insight.calibratedConfidence) : '—' }}</dd>
          </div>
          <div>
            <dt>Comparable samples</dt>
            <dd class="numeric">
              {{ formatCount(insight.sampleCount) }}
              {{ isSynthetic ? 'synthetic' : 'verified' }}
            </dd>
          </div>
          <div>
            <dt>Evidence origin</dt>
            <dd>{{ originLabel }}</dd>
          </div>
          <div>
            <dt>Real verified history</dt>
            <dd class="numeric">{{ formatCount(calibration.summary.productionEvidenceCount) }}</dd>
          </div>
          <div>
            <dt>Calibration quality</dt>
            <dd>{{ qualityLabel }}</dd>
          </div>
        </dl>
        <p v-if="isSynthetic" class="demo-label">Synthetic demo history. It is excluded from production learning.</p>
        <p class="calibration-basis">{{ insight.reason }}</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.disclosure {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.disclosure-hint {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 0.76rem;
  font-weight: 400;
}

.chevron {
  color: var(--text-tertiary);
  font-size: 1.1rem;
  line-height: 1;
}

.calibration-body {
  margin-top: 12px;
}

.calibration-figures {
  display: grid;
  gap: 8px 24px;
  margin: 0;
}

@media (min-width: 640px) {
  .calibration-figures {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.calibration-figures dt {
  color: var(--text-tertiary);
  font-size: 0.76rem;
}

.calibration-figures dd {
  margin: 2px 0 0;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 560;
}

.demo-label {
  margin: 12px 0 0;
  color: var(--warning);
  font-size: 0.78rem;
}

.calibration-basis {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.55;
}

.calibration-fallback {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.calibration-loading .skeleton { height: 72px; }
</style>
