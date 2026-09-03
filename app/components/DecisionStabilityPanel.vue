<script setup lang="ts">
import type { DecisionConfidenceResult, RecommendationBand } from '~~/shared/decision-confidence'
import type { RescueAction } from '~~/shared/scan-rescue'

const props = withDefaults(defineProps<{
  result: DecisionConfidenceResult | null
  rescueAction?: RescueAction | null
  pending?: boolean
  errorMessage?: string | null
}>(), {
  rescueAction: null,
  pending: false,
  errorMessage: null
})

const emit = defineEmits<{ retry: [] }>()

const bandLabel: Record<RecommendationBand, string> = {
  compact: 'Band A · Compact',
  standard: 'Band B · Standard',
  'high-capacity': 'Band C · High capacity'
}

const stabilityPercent = computed(() => Math.round((props.result?.bandStability ?? 0) * 100))
const projectedPercent = computed(() => Math.round((props.rescueAction?.projectedStability ?? 0) * 100))
const targetPercent = computed(() => Math.round((props.rescueAction?.targetStability ?? 0.9) * 100))
const status = computed(() => {
  if (!props.result) return 'Awaiting analysis'
  if (props.rescueAction?.status === 'needs_verification') {
    const count = props.rescueAction.actions.length
    return count > 1 ? `Needs ${count} verifications` : count === 1 ? 'Needs one verification' : 'Needs review'
  }
  if (props.result.stabilityLabel === 'stable') return 'Decision is stable'
  return 'Review recommended'
})
</script>

<template>
  <section class="stability-panel surface" aria-labelledby="stability-title" aria-live="polite" :aria-busy="pending">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Decision stability</p>
        <h2 id="stability-title">Can you trust the current result?</h2>
      </div>
      <span v-if="pending && result" class="recomputing"><span aria-hidden="true" /> Recomputing</span>
    </div>

    <div v-if="pending && !result" class="loading-state" aria-label="Analyzing measurement uncertainty">
      <div class="skeleton skeleton--value" />
      <div class="skeleton skeleton--line" />
      <p>Analyzing measurement uncertainty…</p>
    </div>

    <div v-else-if="errorMessage && !result" class="state-panel state-panel--error" role="alert">
      <div>
        <strong>Decision analysis could not be computed.</strong>
        <p>{{ errorMessage }}</p>
        <button type="button" class="button button--secondary button--small" @click="emit('retry')">Retry analysis</button>
      </div>
    </div>

    <div v-else-if="!result" class="state-panel">
      <p>No measurements are available for this analysis.</p>
    </div>

    <template v-else>
      <div class="stability-score">
        <span class="score-value">{{ stabilityPercent }}<span>%</span></span>
        <span class="score-status">{{ status }}</span>
      </div>

      <div class="stability-plot" :aria-label="`Decision stability is ${stabilityPercent} percent; target is ${targetPercent} percent`" role="img">
        <div class="stability-track">
          <span class="stability-fill" :style="{ width: `${stabilityPercent}%` }" />
          <span class="target-marker" :style="{ left: `${targetPercent}%` }"><span>Target</span></span>
        </div>
        <div class="track-labels"><span>Uncertain</span><span>Stable</span></div>
      </div>

      <p v-if="rescueAction?.status === 'needs_verification' && rescueAction.label" class="projection">
        Verifying <strong>{{ rescueAction.label.toLowerCase() }}</strong> is projected to increase stability to
        <strong>{{ projectedPercent }}%</strong>.
      </p>
      <p v-else class="projection projection--success">
        Measurement uncertainty is unlikely to change the current planning band.
      </p>

      <dl class="stability-facts">
        <div>
          <dt>Current result</dt>
          <dd>{{ bandLabel[result.expectedBand] }}</dd>
        </div>
        <div>
          <dt>Planning index</dt>
          <dd>{{ result.baselineIndex }}</dd>
        </div>
        <div>
          <dt>90% scenario range</dt>
          <dd>{{ result.likelyRange.low }}–{{ result.likelyRange.high }}</dd>
        </div>
      </dl>
    </template>
  </section>
</template>

<style scoped>
.stability-panel {
  padding: 22px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

h2 {
  margin: 5px 0 0;
  font-size: 1.05rem;
  font-weight: 680;
  letter-spacing: -0.02em;
  line-height: 1.35;
}

.recomputing {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-accent);
  font-size: 0.69rem;
  font-weight: 650;
  white-space: nowrap;
}

.recomputing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 800ms ease-in-out infinite alternate;
}

.loading-state {
  padding: 32px 0 10px;
}

.skeleton--value {
  width: 108px;
  height: 58px;
}

.skeleton--line {
  width: 100%;
  height: 9px;
  margin-top: 22px;
}

.loading-state p {
  margin: 16px 0 0;
  color: var(--color-muted);
  font-size: 0.76rem;
}

.state-panel {
  margin-top: 20px;
}

.state-panel--error {
  border-color: #e1b8b1;
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.state-panel strong {
  display: block;
  color: var(--color-ink);
}

.state-panel p + .button,
.state-panel strong + p {
  margin-top: 8px;
}

.stability-score {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 18px;
}

.score-value {
  font-size: clamp(2.8rem, 6vw, 4.1rem);
  font-weight: 640;
  letter-spacing: -0.065em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.score-value span {
  margin-left: 2px;
  color: var(--color-muted);
  font-size: 0.4em;
  letter-spacing: -0.02em;
}

.score-status {
  color: var(--color-review);
  font-size: 0.77rem;
  font-weight: 680;
}

.stability-plot {
  margin-top: 22px;
}

.stability-track {
  position: relative;
  height: 10px;
  border-radius: 2px;
  background: repeating-linear-gradient(90deg, #e5e7e1 0, #e5e7e1 calc(10% - 2px), transparent calc(10% - 2px), transparent 10%);
}

.stability-fill {
  position: absolute;
  inset: 0 auto 0 0;
  max-width: 100%;
  border-radius: 2px 0 0 2px;
  background: repeating-linear-gradient(90deg, var(--color-accent) 0, var(--color-accent) calc(10% - 2px), transparent calc(10% - 2px), transparent 10%);
  transition: width 240ms ease;
}

.target-marker {
  position: absolute;
  top: -5px;
  width: 1px;
  height: 20px;
  background: var(--color-ink);
}

.target-marker span {
  position: absolute;
  bottom: 22px;
  left: 50%;
  color: var(--color-muted);
  font-size: 0.6rem;
  font-weight: 650;
  transform: translateX(-50%);
}

.track-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--color-faint);
  font-size: 0.62rem;
  font-weight: 570;
}

.projection {
  margin: 18px 0 0;
  border-left: 2px solid var(--color-review);
  padding: 1px 0 1px 12px;
  color: var(--color-ink-soft);
  font-size: 0.78rem;
  line-height: 1.55;
}

.projection--success {
  border-color: var(--color-high);
}

.projection strong {
  color: var(--color-ink);
}

.stability-facts {
  display: grid;
  grid-template-columns: 1.3fr .7fr 1fr;
  gap: 1px;
  margin: 20px 0 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-border);
}

.stability-facts div {
  min-width: 0;
  padding: 11px;
  background: var(--color-surface);
}

.stability-facts dt {
  color: var(--color-muted);
  font-size: 0.62rem;
  font-weight: 560;
}

.stability-facts dd {
  margin: 4px 0 0;
  color: var(--color-ink);
  font-size: 0.76rem;
  font-weight: 680;
  line-height: 1.3;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

@keyframes pulse {
  to { opacity: .28; }
}

@media (max-width: 380px) {
  .stability-facts {
    grid-template-columns: 1fr 1fr;
  }

  .stability-facts div:first-child {
    grid-column: 1 / -1;
  }
}
</style>
