<script setup lang="ts">
import type { DecisionConfidenceResult, RecommendationBand } from '~~/shared/decision-confidence'
import { formatCount, formatIndex, formatPercent } from '~~/shared/format'

const props = withDefaults(defineProps<{
  result: DecisionConfidenceResult | null
  pending?: boolean
  errorMessage?: string | null
}>(), {
  pending: false,
  errorMessage: null
})

const detailsOpen = ref(false)

const bands: RecommendationBand[] = ['compact', 'standard', 'high-capacity']

const bandLabel: Record<RecommendationBand, string> = {
  compact: 'Compact',
  standard: 'Standard',
  'high-capacity': 'High capacity'
}

/** A range of 129–129 is mathematically true and visually useless. */
const rangeIsMeaningful = computed(() =>
  Boolean(props.result) && props.result!.likelyRange.low !== props.result!.likelyRange.high
)
</script>

<template>
  <section class="sensitivity" aria-labelledby="sensitivity-title" :aria-busy="pending">
    <h2 id="sensitivity-title" class="section-label">What could change this result?</h2>
    <p class="sensitivity-note">How the result changes across plausible measurements.</p>

    <div v-if="pending && !result" class="sensitivity-loading">
      <div v-for="index in 3" :key="index" class="skeleton" />
    </div>
    <p v-else-if="errorMessage && !result" class="sensitivity-fallback" role="alert">
      Scenario analysis is unavailable until the decision engine reconnects.
    </p>
    <p v-else-if="!result" class="sensitivity-fallback">
      No scenario results can be shown without measurements.
    </p>
    <template v-else>
      <div class="current-band">
        <span>Current planning band</span>
        <strong>{{ bandLabel[result.expectedBand] }}</strong>
      </div>

      <dl class="distribution">
        <div
          v-for="band in bands"
          :key="band"
          :class="{ 'distribution--expected': band === result.expectedBand }"
        >
          <dt>{{ bandLabel[band] }}</dt>
          <dd>
            <span class="bar" aria-hidden="true"><i :style="{ width: `${result.bandDistribution[band] * 100}%` }" /></span>
            <span class="numeric">{{ formatPercent(result.bandDistribution[band]) }}</span>
          </dd>
        </div>
      </dl>

      <p v-if="result.verificationQueue[0] && result.stabilityLabel !== 'stable'" class="driver">
        <span>Main uncertainty</span>
        <strong>{{ result.verificationQueue[0].label }}</strong>
      </p>

      <button
        type="button"
        class="details-toggle"
        :aria-expanded="detailsOpen"
        aria-controls="sensitivity-details"
        @click="detailsOpen = !detailsOpen"
      >Show scenario details</button>
      <div v-show="detailsOpen" id="sensitivity-details" class="details-panel">
        <p class="numeric">
          {{ formatCount(result.scenarioCount) }} scenarios · planning index {{ formatIndex(result.baselineIndex) }} ·
          <template v-if="rangeIsMeaningful">likely range {{ formatIndex(result.likelyRange.low) }}–{{ formatIndex(result.likelyRange.high) }}</template>
          <template v-else>stable across all scenarios</template>
        </p>
        <p v-if="result.verificationQueue[0]">{{ result.verificationQueue[0].reason }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.sensitivity-note {
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 0.79rem;
}

.current-band {
  margin-top: 14px;
}

.current-band span {
  display: block;
  color: var(--text-tertiary);
  font-size: 0.76rem;
}

.current-band strong {
  display: block;
  margin-top: 2px;
  font-size: 1.15rem;
  font-weight: 620;
  letter-spacing: -0.02em;
}

.distribution {
  margin: 14px 0 0;
}

.distribution div {
  display: grid;
  grid-template-columns: minmax(96px, 140px) minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 6px 0;
}

.distribution dt {
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.distribution--expected dt {
  color: var(--text-primary);
  font-weight: 560;
}

.distribution dd {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.bar {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: var(--surface-subtle);
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--border-strong);
  transition: width 200ms ease;
}

.distribution--expected .bar i { background: var(--accent); }

.distribution dd .numeric {
  color: var(--text-primary);
  font-size: 0.81rem;
  text-align: right;
}

.driver {
  margin: 14px 0 0;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.driver span {
  display: block;
  color: var(--text-tertiary);
  font-size: 0.76rem;
}

.driver strong {
  display: block;
  margin-top: 2px;
  color: var(--text-primary);
  font-size: 0.92rem;
  font-weight: 600;
}

.details-toggle {
  min-height: 40px;
  margin-top: 8px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.82rem;
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.details-toggle:hover { color: var(--text-primary); }

.details-panel {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.5;
}

.details-panel p { margin: 0; }
.details-panel p + p { margin-top: 6px; }

.sensitivity-fallback {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.sensitivity-loading {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.sensitivity-loading .skeleton { height: 20px; }

@media (max-width: 520px) {
  .distribution div {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
