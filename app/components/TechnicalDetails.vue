<script setup lang="ts">
import type { Measurement } from '~/types/scan'
import type { CalibrationAnalysis } from '~~/shared/analysis'
import type { DecisionConfidenceResult } from '~~/shared/decision-confidence'
import type { RescueAction } from '~~/shared/scan-rescue'

const props = withDefaults(defineProps<{
  scan: {
    modelVersion?: string
    captureMethod?: string
    measurements: Measurement[]
  }
  result: DecisionConfidenceResult | null
  rescue: RescueAction | null
  calibration: CalibrationAnalysis | null
}>(), {})

const open = ref(false)

const selectedCalibration = computed(() => {
  if (!props.calibration) return null
  const id = props.rescue?.measurementId
  if (id && props.calibration.measurements[id]) return props.calibration.measurements[id]
  return Object.values(props.calibration.measurements).find(item => item.applied)
    ?? Object.values(props.calibration.measurements)[0]
    ?? null
})

const verified = computed(() => props.scan.measurements.filter(item => item.source === 'manual'))
</script>

<template>
  <section class="technical" aria-labelledby="technical-title">
    <button
      type="button"
      class="disclosure"
      :aria-expanded="open"
      aria-controls="technical-body"
      @click="open = !open"
    >
      <span>
        <span id="technical-title" class="section-label">Technical details</span>
        <span class="disclosure-hint">Raw confidence, scenarios, provenance and ranking</span>
      </span>
      <span class="chevron" aria-hidden="true">{{ open ? '−' : '+' }}</span>
    </button>

    <div v-show="open" id="technical-body" class="technical-body">
      <dl class="tech-grid numeric">
        <div>
          <dt>Scenario count</dt>
          <dd>{{ result?.scenarioCount ?? '—' }}</dd>
        </div>
        <div>
          <dt>Decision stability</dt>
          <dd>{{ result ? `${Math.round(result.bandStability * 100)}%` : '—' }}</dd>
        </div>
        <div>
          <dt>Planning index</dt>
          <dd>{{ result?.baselineIndex ?? '—' }}</dd>
        </div>
        <div>
          <dt>Likely range</dt>
          <dd>{{ result ? `${result.likelyRange.low}–${result.likelyRange.high}` : '—' }}</dd>
        </div>
        <div>
          <dt>Raw confidence</dt>
          <dd>{{ selectedCalibration ? `${Math.round(selectedCalibration.rawConfidence * 100)}%` : '—' }}</dd>
        </div>
        <div>
          <dt>Calibrated confidence</dt>
          <dd>{{ selectedCalibration?.applied ? `${Math.round(selectedCalibration.calibratedConfidence * 100)}%` : '—' }}</dd>
        </div>
        <div>
          <dt>Calibration samples</dt>
          <dd>{{ selectedCalibration?.sampleCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Model version</dt>
          <dd>{{ scan.modelVersion || '—' }}</dd>
        </div>
        <div>
          <dt>Capture method</dt>
          <dd>{{ scan.captureMethod || '—' }}</dd>
        </div>
        <div>
          <dt>Rescue status</dt>
          <dd>{{ rescue?.status ?? '—' }}</dd>
        </div>
      </dl>

      <div v-if="result?.verificationQueue.length" class="queue-block">
        <h3>Rescue ranking</h3>
        <ol>
          <li v-for="(item, index) in result.verificationQueue" :key="item.measurementId">
            <span>{{ index + 1 }}. {{ item.label }}</span>
            <span class="numeric">{{ item.impactPercent.toFixed(1) }}% impact · score {{ item.priorityScore.toFixed(1) }}</span>
          </li>
        </ol>
      </div>

      <div v-if="verified.length" class="provenance-block">
        <h3>Verification provenance</h3>
        <ul>
          <li v-for="item in verified" :key="item.id">
            <strong>{{ item.label }}</strong>
            <span class="numeric">
              {{ item.value }} {{ item.unit }} verified
              <template v-if="item.originalEstimate">
                · original estimate {{ item.originalEstimate.value }} {{ item.unit }} at {{ Math.round(item.originalEstimate.confidence * 100) }}%
              </template>
            </span>
          </li>
        </ul>
      </div>

      <div v-if="result" class="distribution-block">
        <h3>Scenario distribution</h3>
        <p class="numeric">
          Compact {{ Math.round(result.bandDistribution.compact * 100) }}% ·
          Standard {{ Math.round(result.bandDistribution.standard * 100) }}% ·
          High capacity {{ Math.round(result.bandDistribution['high-capacity'] * 100) }}%
        </p>
      </div>
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

.technical-body {
  margin-top: 12px;
}

.tech-grid {
  display: grid;
  gap: 10px 20px;
  margin: 0;
}

@media (min-width: 700px) {
  .tech-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.tech-grid dt {
  color: var(--text-tertiary);
  font-size: 0.74rem;
}

.tech-grid dd {
  margin: 2px 0 0;
  color: var(--text-primary);
  font-size: 0.86rem;
  font-weight: 560;
}

.queue-block,
.provenance-block,
.distribution-block {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.queue-block h3,
.provenance-block h3,
.distribution-block h3 {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.76rem;
  font-weight: 560;
}

.queue-block ol,
.provenance-block ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.queue-block li,
.provenance-block li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px 16px;
  padding: 4px 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.provenance-block strong {
  color: var(--text-primary);
  font-weight: 560;
}

.distribution-block p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}
</style>
