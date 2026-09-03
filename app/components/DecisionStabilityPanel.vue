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
  if (!props.result) return null
  const count = props.rescueAction?.status === 'needs_verification' ? props.rescueAction.actions.length : 0
  if (count) return { label: `Needs ${count} verification${count === 1 ? '' : 's'}`, tone: 'review' as const }
  if (props.result.stabilityLabel === 'stable') return { label: 'Stable', tone: 'stable' as const }
  return { label: 'Needs review', tone: 'review' as const }
})
</script>

<template>
  <section class="stability-panel" aria-labelledby="stability-title" aria-live="polite" :aria-busy="pending">
    <div class="panel-header">
      <h2 id="stability-title" class="section-label">Decision stability</h2>
      <span v-if="pending && result" class="recomputing">Recalculating…</span>
    </div>

    <div v-if="pending && !result" class="loading-state" aria-label="Analyzing measurement uncertainty">
      <div class="skeleton skeleton--value" />
      <div class="skeleton skeleton--line" />
    </div>

    <div v-else-if="errorMessage && !result" class="state-panel state-panel--error" role="alert">
      <div>
        <p><strong>Decision analysis is temporarily unavailable.</strong></p>
        <p class="state-detail">Your room measurements are still available.</p>
        <button type="button" class="button button--secondary button--small" @click="emit('retry')">Retry analysis</button>
      </div>
    </div>

    <div v-else-if="!result" class="state-panel">
      <p>No measurements are available for this analysis.</p>
    </div>

    <template v-else>
      <p class="stability-score">
        <span class="score-value numeric" data-stability-value>{{ stabilityPercent }}<span class="score-unit">%</span></span>
        <span v-if="status" class="score-status" :class="`score-status--${status.tone}`">{{ status.label }}</span>
      </p>

      <div
        class="stability-plot"
        role="img"
        :aria-label="`Decision stability is ${stabilityPercent} percent against a ${targetPercent} percent target`"
      >
        <span class="stability-track"><span class="stability-fill" :style="{ width: `${stabilityPercent}%` }" /></span>
        <span class="target-marker" :style="{ left: `${targetPercent}%` }" />
        <span class="target-caption numeric" :style="{ left: `${targetPercent}%` }">{{ targetPercent }}% target</span>
      </div>

      <p v-if="rescueAction?.status === 'needs_verification' && rescueAction.label" class="projection">
        Verifying {{ rescueAction.label.toLowerCase() }} is projected to raise this to <strong class="numeric">{{ projectedPercent }}%</strong>.
      </p>
      <p v-else class="projection">
        Remaining measurement uncertainty is unlikely to change the planning band.
      </p>

      <dl class="fact-list">
        <div><dt>Result</dt><dd>{{ bandLabel[result.expectedBand] }}</dd></div>
        <div><dt>Planning index</dt><dd class="numeric">{{ result.baselineIndex }}</dd></div>
        <div><dt>90% scenario range</dt><dd class="numeric">{{ result.likelyRange.low }}–{{ result.likelyRange.high }}</dd></div>
      </dl>
    </template>
  </section>
</template>

<style scoped>
.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.recomputing {
  color: var(--text-tertiary);
  font-size: 0.76rem;
}

.stability-score {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 10px 0 0;
}

.score-value {
  color: var(--text-primary);
  font-size: 2.5rem;
  font-weight: 600;
  letter-spacing: -0.045em;
  line-height: 1;
}

.score-unit {
  margin-left: 1px;
  color: var(--text-tertiary);
  font-size: 0.42em;
  font-weight: 500;
}

.score-status {
  font-size: 0.82rem;
  font-weight: 560;
}

.score-status--review { color: var(--warning); }
.score-status--stable { color: var(--success); }

.stability-plot {
  position: relative;
  margin-top: 16px;
  padding-bottom: 18px;
}

.stability-track {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: var(--surface-subtle);
}

.stability-fill {
  display: block;
  max-width: 100%;
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
  transition: width 200ms ease;
}

.target-marker {
  position: absolute;
  top: -3px;
  width: 1px;
  height: 10px;
  background: var(--text-primary);
}

.target-caption {
  position: absolute;
  top: 12px;
  color: var(--text-tertiary);
  font-size: 0.7rem;
  transform: translateX(-50%);
  white-space: nowrap;
}

.projection {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.83rem;
  line-height: 1.5;
}

.projection strong {
  color: var(--text-primary);
  font-weight: 600;
}

.fact-list {
  margin: 16px 0 0;
}

.fact-list div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--border);
  padding: 7px 0;
}

.fact-list dt {
  color: var(--text-tertiary);
  font-size: 0.79rem;
}

.fact-list dd {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.81rem;
  font-weight: 560;
  text-align: right;
}

.loading-state {
  padding-top: 12px;
}

.skeleton--value { width: 96px; height: 40px; }
.skeleton--line { width: 100%; height: 4px; margin-top: 20px; }

.state-panel { margin-top: 12px; }
.state-panel p { margin: 0; }
.state-panel strong { color: var(--text-primary); }
.state-detail { margin-top: 4px !important; }
.state-panel .button { margin-top: 10px; }
</style>
