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
  return quality === 'insufficient' ? 'Insufficient evidence' : `${quality[0]?.toUpperCase()}${quality.slice(1)}`
})
</script>

<template>
  <section class="calibration-card surface" aria-labelledby="calibration-title" :aria-busy="pending">
    <div class="calibration-heading">
      <div>
        <p class="eyebrow">System confidence</p>
        <h2 id="calibration-title">Is model confidence trustworthy?</h2>
      </div>
      <span v-if="insight?.demoEvidence" class="demo-label">Includes demo evidence</span>
    </div>

    <div v-if="pending && !calibration" class="calibration-loading">
      <div class="skeleton" />
      <div class="skeleton" />
      <p>Checking historical calibration…</p>
    </div>
    <div v-else-if="errorMessage && !calibration" class="state-panel state-panel--error" role="alert">
      <p>Calibration is unavailable. Raw model confidence remains visible.</p>
    </div>
    <div v-else-if="!calibration || !insight" class="state-panel">
      <p>No calibration evidence is available. Raw model confidence is used unchanged.</p>
    </div>
    <template v-else>
      <div class="confidence-comparison">
        <div>
          <span>Raw model</span>
          <strong>{{ rawPercent }}%</strong>
        </div>
        <span class="comparison-arrow" aria-hidden="true">→</span>
        <div>
          <span>Historically calibrated</span>
          <strong>{{ insight.applied ? `${calibratedPercent}%` : '—' }}</strong>
        </div>
      </div>

      <dl class="calibration-facts">
        <div><dt>Comparable evidence</dt><dd>{{ insight.sampleCount || 'Below minimum' }}</dd></div>
        <div><dt>Calibration quality</dt><dd>{{ qualityLabel }}</dd></div>
      </dl>

      <p class="calibration-note">{{ insight.reason }}</p>
      <button type="button" class="explanation-button" :aria-expanded="expanded" aria-controls="calibration-explanation" @click="expanded = !expanded">
        How was this calibrated?
        <svg viewBox="0 0 16 16" aria-hidden="true" :class="{ 'is-open': expanded }"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <div v-show="expanded" id="calibration-explanation" class="calibration-explanation">
        HomeLens compares prior model estimates with later human-verified measurements in the same confidence range. The prototype only applies an adjustment after explicit minimum sample thresholds are met. Raw confidence is always retained for inspection.
      </div>
    </template>
  </section>
</template>

<style scoped>
.calibration-card { padding: 20px; }
.calibration-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
h2 { margin: 5px 0 0; font-size: .98rem; font-weight: 680; letter-spacing: -.02em; line-height: 1.35; }
.demo-label { flex: 0 0 auto; border: 1px solid var(--color-border); border-radius: 999px; padding: 4px 7px; color: var(--color-muted); font-size: .56rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.confidence-comparison { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 10px; margin-top: 18px; border: 1px solid var(--color-border); border-radius: 10px; padding: 14px; background: var(--color-canvas); }
.confidence-comparison div:last-child { text-align: right; }
.confidence-comparison span { display: block; color: var(--color-muted); font-size: .62rem; }
.confidence-comparison strong { display: block; margin-top: 3px; color: var(--color-ink); font-size: 1.45rem; font-weight: 680; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.confidence-comparison div:last-child strong { color: var(--color-accent); }
.comparison-arrow { padding-bottom: 8px; color: var(--color-faint) !important; font-size: .9rem !important; }
.calibration-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0 0; }
.calibration-facts dt { color: var(--color-faint); font-size: .59rem; }
.calibration-facts dd { margin: 3px 0 0; font-size: .7rem; font-weight: 670; }
.calibration-note { margin: 13px 0 0; color: var(--color-muted); font-size: .68rem; line-height: 1.5; }
.explanation-button { display: flex; min-height: 44px; align-items: center; gap: 6px; border: 0; padding: 10px 0 0; background: transparent; color: var(--color-accent); cursor: pointer; font-size: .69rem; font-weight: 670; }
.explanation-button svg { width: 13px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; transition: transform 160ms ease; }
.explanation-button svg.is-open { transform: rotate(180deg); }
.calibration-explanation { border-top: 1px solid var(--color-border); padding-top: 12px; color: var(--color-muted); font-size: .68rem; line-height: 1.55; }
.calibration-loading { display: grid; gap: 10px; padding-top: 20px; }
.calibration-loading .skeleton { height: 38px; }
.calibration-loading p { margin: 0; color: var(--color-muted); font-size: .69rem; }
.state-panel { min-height: 100px; margin-top: 16px; }
.state-panel--error { border-color: #e1b8b1; background: var(--color-danger-soft); }
@media (max-width: 380px) { .confidence-comparison { padding: 12px; } .confidence-comparison strong { font-size: 1.25rem; } }
</style>
