<script setup lang="ts">
import type { Measurement } from '~/types/scan'
import type { CalibrationAnalysis } from '~~/shared/analysis'
import type { DecisionConfidenceResult } from '~~/shared/decision-confidence'
import type { RescueAction } from '~~/shared/scan-rescue'
import {
  formatCount,
  formatFeetRange,
  formatFeetTechnical,
  formatIndex,
  formatPercent,
  formatPercentPoints,
  formatPercentPrecise
} from '~~/shared/format'

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
const photoDerived = computed(() => props.scan.measurements.filter(item => item.provenance?.measurementMethod === 'photo_metric_depth'))

const mean = (values: number[]) => values.length
  ? values.reduce((total, value) => total + value, 0) / values.length
  : null

const acceptedConfidence = computed(() => mean(props.scan.measurements.map(item => item.confidence)))
const originalConfidence = computed(() => mean(props.scan.measurements.map(item => item.rawConfidence ?? item.originalEstimate?.confidence ?? item.confidence)))

const calibrationOriginLabel = computed(() => {
  switch (props.calibration?.summary.origin) {
    case 'synthetic_demo': return 'synthetic_demo'
    case 'real_user_verification': return 'real_user_verification'
    case 'mixed': return 'mixed'
    default: return 'none'
  }
})

const delta = (measurement: Measurement) => {
  const original = measurement.originalEstimate?.value
  if (original === undefined) return null
  const difference = measurement.value - original
  return {
    difference,
    relative: Math.abs(difference) / measurement.value,
    signed: `${difference >= 0 ? '+' : '-'}${formatFeetTechnical(Math.abs(difference), measurement.unit)}`
  }
}

const modelVersions = computed(() => {
  const provenance = photoDerived.value[0]?.provenance
  return [
    { label: 'Measurement model', value: props.scan.modelVersion },
    { label: 'Photo depth model', value: provenance?.depthModelVersion },
    { label: 'Geometry estimator', value: provenance?.geometryModelVersion },
    { label: 'Confidence model', value: provenance?.confidenceModelVersion }
  ].filter(entry => Boolean(entry.value))
})
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
        <span class="disclosure-hint">Evidence, uncertainty, scenarios, ranking and provenance</span>
      </span>
      <span class="chevron" aria-hidden="true">{{ open ? '−' : '+' }}</span>
    </button>

    <div v-show="open" id="technical-body" class="technical-body">
      <dl class="tech-grid numeric">
        <div>
          <dt>Scenario count</dt>
          <dd>{{ formatCount(result?.scenarioCount) }}</dd>
        </div>
        <div>
          <dt>Decision stability</dt>
          <dd>{{ formatPercent(result?.bandStability) }}</dd>
        </div>
        <div>
          <dt>Planning index</dt>
          <dd>{{ formatIndex(result?.baselineIndex) }}</dd>
        </div>
        <div>
          <dt>Likely range</dt>
          <dd>{{ result ? `${formatIndex(result.likelyRange.low)}–${formatIndex(result.likelyRange.high)}` : '—' }}</dd>
        </div>
        <div>
          <dt>Accepted measurement confidence</dt>
          <dd>{{ formatPercent(acceptedConfidence) }}</dd>
        </div>
        <div>
          <dt>Original photo confidence</dt>
          <dd>{{ formatPercent(originalConfidence) }}</dd>
        </div>
        <div>
          <dt>Calibrated confidence</dt>
          <dd>{{ selectedCalibration?.applied ? formatPercent(selectedCalibration.calibratedConfidence) : '—' }}</dd>
        </div>
        <div>
          <dt>Calibration samples</dt>
          <dd>{{ formatCount(selectedCalibration?.sampleCount ?? 0) }}</dd>
        </div>
        <div>
          <dt>Calibration evidence origin</dt>
          <dd>{{ calibrationOriginLabel }}</dd>
        </div>
        <div>
          <dt>Capture method</dt>
          <dd>{{ scan.captureMethod || '—' }}</dd>
        </div>
        <div v-for="version in modelVersions" :key="version.label">
          <dt>{{ version.label }}</dt>
          <dd>{{ version.value }}</dd>
        </div>
        <div>
          <dt>Rescue status</dt>
          <dd>{{ rescue?.status ?? '—' }}</dd>
        </div>
      </dl>

      <div v-if="photoDerived.length" class="block">
        <h3>Photo evidence</h3>
        <ul>
          <li v-for="measurement in photoDerived" :key="measurement.id">
            <strong>{{ measurement.label }}</strong>
            <span class="numeric">
              {{ formatFeetTechnical(measurement.originalEstimate?.value ?? measurement.value, measurement.unit) }}
              at {{ formatPercent(measurement.rawConfidence ?? measurement.confidence) }}
              <template v-if="measurement.uncertaintyLow !== undefined && measurement.uncertaintyHigh !== undefined">
                · {{ formatFeetRange(measurement.uncertaintyLow, measurement.uncertaintyHigh, measurement.unit) }}
              </template>
              · {{ formatCount(measurement.provenance?.supportingViewCount) }} view{{ measurement.provenance?.supportingViewCount === 1 ? '' : 's' }}
            </span>
          </li>
        </ul>
      </div>

      <div v-if="result?.verificationQueue.length" class="block">
        <h3>Verification ranking</h3>
        <ol>
          <li v-for="(item, index) in result.verificationQueue" :key="item.measurementId">
            <span>{{ index + 1 }}. {{ item.label }}</span>
            <span class="numeric">{{ formatPercentPoints(item.impactPercent) }} impact · score {{ formatPercentPoints(item.priorityScore) }}</span>
          </li>
        </ol>
      </div>

      <div v-if="verified.length" class="block">
        <h3>Verification provenance</h3>
        <ul>
          <li v-for="measurement in verified" :key="measurement.id">
            <strong>{{ measurement.label }}</strong>
            <span class="numeric">
              <template v-if="measurement.provenance?.measurementMethod === 'photo_metric_depth'">photo metric → human verified · </template>
              verified {{ formatFeetTechnical(measurement.value, measurement.unit) }}
              <template v-if="delta(measurement)">
                · estimate {{ formatFeetTechnical(measurement.originalEstimate?.value, measurement.unit) }}
                at {{ formatPercent(measurement.originalEstimate?.confidence) }}
                · difference {{ delta(measurement)!.signed }} ({{ formatPercentPrecise(delta(measurement)!.relative) }})
              </template>
            </span>
          </li>
        </ul>
      </div>

      <div v-if="result" class="block">
        <h3>Scenario distribution</h3>
        <p class="numeric">
          Compact {{ formatPercent(result.bandDistribution.compact) }} ·
          Standard {{ formatPercent(result.bandDistribution.standard) }} ·
          High capacity {{ formatPercent(result.bandDistribution['high-capacity']) }}
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
  overflow-wrap: anywhere;
}

.block {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.block h3 {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.76rem;
  font-weight: 560;
}

.block ol,
.block ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.block li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px 16px;
  padding: 4px 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.block strong {
  color: var(--text-primary);
  font-weight: 560;
}

.block p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}
</style>
