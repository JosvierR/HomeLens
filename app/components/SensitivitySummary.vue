<script setup lang="ts">
import type { DecisionConfidenceResult, RecommendationBand } from '~~/shared/decision-confidence'

withDefaults(defineProps<{
  result: DecisionConfidenceResult | null
  pending?: boolean
  errorMessage?: string | null
}>(), {
  pending: false,
  errorMessage: null
})

const bands: RecommendationBand[] = ['compact', 'standard', 'high-capacity']

const bandLabel: Record<RecommendationBand, string> = {
  compact: 'Band A · Compact',
  standard: 'Band B · Standard',
  'high-capacity': 'Band C · High capacity'
}
</script>

<template>
  <section class="sensitivity" aria-labelledby="sensitivity-title" :aria-busy="pending">
    <div class="sensitivity-header">
      <h2 id="sensitivity-title" class="section-label">Scenario sensitivity</h2>
      <span v-if="result" class="scenario-count numeric">{{ result.scenarioCount }} scenarios</span>
    </div>
    <p class="sensitivity-note">Where the planning band lands when every uncertain input is varied together.</p>

    <div v-if="pending && !result" class="sensitivity-loading">
      <div v-for="index in 3" :key="index" class="skeleton" />
    </div>
    <p v-else-if="errorMessage && !result" class="sensitivity-fallback" role="alert">
      Scenario analysis is unavailable until the decision engine reconnects.
    </p>
    <p v-else-if="!result" class="sensitivity-fallback">
      No sensitivity model can be shown without measurements.
    </p>
    <template v-else>
      <dl class="distribution">
        <div v-for="band in bands" :key="band" :class="{ 'distribution--expected': band === result.expectedBand }">
          <dt>{{ bandLabel[band] }}</dt>
          <dd>
            <span class="bar" aria-hidden="true"><i :style="{ width: `${result.bandDistribution[band] * 100}%` }" /></span>
            <span class="numeric">{{ Math.round(result.bandDistribution[band] * 100) }}%</span>
          </dd>
        </div>
      </dl>

      <p v-if="result.verificationQueue[0]" class="driver">
        <strong>{{ result.verificationQueue[0].label }}</strong> drives most of the remaining spread.
        {{ result.verificationQueue[0].reason }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.sensitivity-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.scenario-count {
  color: var(--text-tertiary);
  font-size: 0.77rem;
}

.sensitivity-note {
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 0.79rem;
}

.distribution {
  margin: 14px 0 0;
}

.distribution div {
  display: grid;
  grid-template-columns: minmax(120px, 190px) minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  padding: 6px 0;
}

.distribution dt {
  color: var(--text-secondary);
  font-size: 0.82rem;
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
  margin: 12px 0 0;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.55;
}

.driver strong {
  color: var(--text-primary);
  font-weight: 600;
}

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
