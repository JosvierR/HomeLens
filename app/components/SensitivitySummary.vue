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

const bandLabel: Record<RecommendationBand, string> = {
  compact: 'Band A',
  standard: 'Band B',
  'high-capacity': 'Band C'
}

const bandDescription: Record<RecommendationBand, string> = {
  compact: 'Compact',
  standard: 'Standard',
  'high-capacity': 'High capacity'
}
</script>

<template>
  <section class="sensitivity surface" aria-labelledby="sensitivity-title" :aria-busy="pending">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Sensitivity model</p>
        <h2 id="sensitivity-title">What could change this decision?</h2>
      </div>
      <span v-if="result">{{ result.scenarioCount }} scenarios</span>
    </div>

    <div v-if="pending && !result" class="sensitivity-loading">
      <div class="skeleton" />
      <div class="skeleton" />
      <div class="skeleton" />
    </div>
    <div v-else-if="errorMessage && !result" class="state-panel" role="alert">
      <p>Scenario analysis is unavailable until the decision engine reconnects.</p>
    </div>
    <div v-else-if="!result" class="state-panel">
      <p>No sensitivity model can be shown without measurements.</p>
    </div>
    <template v-else>
      <div class="sensitivity-grid">
        <div class="current-result">
          <span>Current planning result</span>
          <strong>{{ bandLabel[result.expectedBand] }}</strong>
          <p>{{ bandDescription[result.expectedBand] }} planning range</p>
          <dl>
            <div><dt>Current index</dt><dd>{{ result.baselineIndex }}</dd></div>
            <div><dt>Likely range</dt><dd>{{ result.likelyRange.low }}–{{ result.likelyRange.high }}</dd></div>
          </dl>
        </div>

        <div class="scenario-distribution">
          <div class="distribution-title"><span>Across uncertainty scenarios</span><span>Probability</span></div>
          <div v-for="band in (['compact', 'standard', 'high-capacity'] as RecommendationBand[])" :key="band" class="distribution-row">
            <span>{{ bandLabel[band] }}</span>
            <div class="bar"><i :style="{ width: `${result.bandDistribution[band] * 100}%` }" /></div>
            <strong>{{ Math.round(result.bandDistribution[band] * 100) }}%</strong>
          </div>
          <div v-if="result.verificationQueue[0]" class="main-driver">
            <span>Main uncertainty driver</span>
            <strong>{{ result.verificationQueue[0].label }}</strong>
            <p>{{ result.verificationQueue[0].reason }}</p>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.sensitivity {
  padding: 24px;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.section-heading h2 {
  margin: 5px 0 0;
  font-size: 1.25rem;
  font-weight: 680;
  letter-spacing: -0.03em;
}

.section-heading > span {
  color: var(--color-faint);
  font-size: 0.67rem;
}

.sensitivity-grid {
  display: grid;
  grid-template-columns: minmax(180px, .7fr) 1.3fr;
  gap: 1px;
  margin-top: 20px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 11px;
  background: var(--color-border);
}

.current-result,
.scenario-distribution {
  min-width: 0;
  padding: 18px;
  background: var(--color-surface);
}

.current-result > span,
.distribution-title,
.main-driver > span {
  color: var(--color-muted);
  font-size: 0.68rem;
  font-weight: 590;
}

.current-result > strong {
  display: block;
  margin-top: 6px;
  font-size: 2rem;
  font-weight: 650;
  letter-spacing: -0.045em;
}

.current-result > p {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.7rem;
}

.current-result dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 20px 0 0;
}

.current-result dt {
  color: var(--color-faint);
  font-size: 0.6rem;
}

.current-result dd {
  margin: 3px 0 0;
  font-size: 0.78rem;
  font-weight: 680;
  font-variant-numeric: tabular-nums;
}

.distribution-title {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}

.distribution-row {
  display: grid;
  grid-template-columns: 54px minmax(60px, 1fr) 34px;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  color: var(--color-muted);
  font-size: 0.68rem;
}

.distribution-row .bar {
  height: 7px;
  overflow: hidden;
  border-radius: 2px;
  background: #e2e5df;
}

.distribution-row i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--color-accent);
  transition: width 240ms ease;
}

.distribution-row strong {
  color: var(--color-ink);
  font-size: 0.69rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.main-driver {
  margin-top: 15px;
  border-top: 1px solid var(--color-border);
  padding-top: 13px;
}

.main-driver strong {
  display: block;
  margin-top: 3px;
  font-size: 0.81rem;
}

.main-driver p {
  margin: 3px 0 0;
  color: var(--color-muted);
  font-size: 0.67rem;
  line-height: 1.45;
}

.sensitivity-loading {
  display: grid;
  grid-template-columns: .7fr 1.3fr;
  gap: 12px;
  margin-top: 20px;
}

.sensitivity-loading .skeleton {
  height: 160px;
}

.sensitivity-loading .skeleton:first-child {
  grid-row: span 2;
}

.sensitivity-loading .skeleton:nth-child(2),
.sensitivity-loading .skeleton:nth-child(3) {
  height: 74px;
}

.state-panel {
  margin-top: 20px;
}

@media (max-width: 620px) {
  .sensitivity-grid {
    grid-template-columns: 1fr;
  }
}
</style>
