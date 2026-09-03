<script setup lang="ts">
import type { Measurement } from '~/types/scan'
import type { DecisionConfidenceResult, RecommendationBand, VerificationPriority } from '~~/shared/decision-confidence'
import type { RescueAction } from '~~/shared/scan-rescue'

const props = withDefaults(defineProps<{
  result: DecisionConfidenceResult | null
  rescueAction?: RescueAction | null
  measurement?: Measurement
  priority?: VerificationPriority
  pending?: boolean
  errorMessage?: string | null
  disabled?: boolean
}>(), {
  rescueAction: null,
  measurement: undefined,
  priority: undefined,
  pending: false,
  errorMessage: null,
  disabled: false
})

const emit = defineEmits<{ verify: [id: string]; retry: [] }>()

const whyOpen = ref(false)
const technicalOpen = ref(false)

const bandLabel: Record<RecommendationBand, string> = {
  compact: 'Compact',
  standard: 'Standard',
  'high-capacity': 'High capacity'
}

const stabilityPercent = computed(() => Math.round((props.result?.bandStability ?? 0) * 100))
const projectedPercent = computed(() => Math.round((props.rescueAction?.projectedStability ?? 0) * 100))
const targetPercent = computed(() => Math.round((props.rescueAction?.targetStability ?? 0.9) * 100))
const currentRescuePercent = computed(() => Math.round((props.rescueAction?.currentStability ?? props.result?.bandStability ?? 0) * 100))
const gainPercent = computed(() => Math.round(((props.rescueAction?.stabilityGain ?? 0) * 100)))

const headline = computed(() => {
  if (!props.result) return null
  if (props.rescueAction?.status === 'needs_verification') {
    if (stabilityPercent.value >= 75) return { title: 'Almost there', tone: 'review' as const }
    return { title: 'One measurement is worth checking', tone: 'review' as const }
  }
  if (props.result.stabilityLabel === 'stable') return { title: 'Looking solid', tone: 'stable' as const }
  return { title: 'Worth a closer look', tone: 'review' as const }
})

const impactWord = computed(() => {
  const impact = props.priority?.impactPercent ?? 0
  if (impact >= 7) return 'High'
  if (impact >= 3) return 'Medium'
  return 'Low'
})

const uncertaintyWord = computed(() => {
  const confidence = props.measurement?.confidence ?? props.priority?.confidence ?? 1
  if (confidence >= 0.9) return 'Low'
  if (confidence >= 0.75) return 'Moderate'
  return 'High'
})

const verifyLabel = computed(() => {
  const label = props.rescueAction?.label
  return label ? `Check ${label.toLowerCase()}` : 'Check measurement'
})
</script>

<template>
  <section class="recommendation" aria-labelledby="recommendation-title" aria-live="polite" :aria-busy="pending">
    <div class="recommendation-kicker">
      <span>What HomeLens found</span>
      <span v-if="pending && result" class="recomputing">Updating…</span>
    </div>

    <div v-if="pending && !result" class="loading-state" aria-label="Analyzing measurement uncertainty">
      <div class="skeleton skeleton--title" />
      <div class="skeleton skeleton--line" />
      <div class="skeleton skeleton--bar" />
    </div>

    <div v-else-if="errorMessage && !result" class="state-panel state-panel--error" role="alert">
      <div>
        <p><strong>We could not update the decision analysis.</strong></p>
        <p class="state-detail">Your room measurements are still saved.</p>
        <button type="button" class="button button--secondary button--small" @click="emit('retry')">Retry analysis</button>
      </div>
    </div>

    <div v-else-if="!result" class="state-panel">
      <p>No measurements are available for this analysis.</p>
    </div>

    <template v-else>
      <h2 id="recommendation-title" class="recommendation-title" :class="`recommendation-title--${headline?.tone}`">
        {{ headline?.title }}
      </h2>

      <p class="recommendation-copy">
        <template v-if="rescueAction?.status === 'needs_verification'">
          We're not sure about one measurement. Checking it could make your result much more reliable.
        </template>
        <template v-else>
          Your result stays the same in
          <strong class="numeric">{{ stabilityPercent }}%</strong>
          of plausible measurement variations
          <template v-if="result"> ({{ bandLabel[result.expectedBand] }})</template>.
        </template>
      </p>

      <div class="stability-block">
        <div class="stability-meta">
          <span>How reliable is this result?</span>
          <span class="score-value numeric" data-stability-value>{{ stabilityPercent }}%</span>
        </div>
        <div
          class="stability-plot"
          role="img"
          :aria-label="`Decision stability is ${stabilityPercent} percent against a ${targetPercent} percent target`"
        >
          <span class="track-ends"><span>Uncertain</span><span>Stable</span></span>
          <span class="stability-track">
            <span class="stability-fill" :style="{ width: `${stabilityPercent}%` }" />
            <span class="stability-marker" :style="{ left: `${stabilityPercent}%` }" />
            <span class="target-marker" :style="{ left: `${targetPercent}%` }" />
          </span>
          <span class="target-caption numeric">{{ targetPercent }}% target</span>
        </div>
      </div>

      <template v-if="rescueAction?.status === 'needs_verification' && rescueAction.measurementId">
        <p class="action-prompt">
          Check <strong>{{ rescueAction.label?.toLowerCase() }}</strong>
          <template v-if="projectedPercent">
            — reliability could move from
            <span class="numeric">{{ currentRescuePercent }}%</span> to
            <span class="numeric">{{ projectedPercent }}%</span>.
          </template>
        </p>

        <div class="action-row">
          <button
            type="button"
            class="button verify-button"
            :disabled="disabled"
            @click="emit('verify', rescueAction.measurementId)"
          >{{ verifyLabel }}</button>
          <button
            type="button"
            class="why-toggle"
            :aria-expanded="whyOpen"
            aria-controls="why-this-panel"
            @click="whyOpen = !whyOpen"
          >Why this?</button>
        </div>

        <div v-show="whyOpen" id="why-this-panel" class="why-panel">
          <dl class="why-facts">
            <div><dt>Impact on decision</dt><dd>{{ impactWord }}</dd></div>
            <div><dt>Measurement uncertainty</dt><dd>{{ uncertaintyWord }}</dd></div>
            <div><dt>Expected stability gain</dt><dd class="numeric">+{{ Math.max(gainPercent, 0) }}%</dd></div>
          </dl>
          <p>
            {{ rescueAction.reason || `Although another measurement may have similar uncertainty, ${rescueAction.label?.toLowerCase()} has a larger effect on the current decision.` }}
          </p>
          <button
            type="button"
            class="tech-toggle"
            :aria-expanded="technicalOpen"
            aria-controls="why-tech-panel"
            @click="technicalOpen = !technicalOpen"
          >How HomeLens decided this</button>
          <div v-show="technicalOpen" id="why-tech-panel" class="tech-panel numeric">
            <p v-if="priority">Impact score {{ priority.impactPercent.toFixed(1) }}% · priority {{ priority.priorityScore.toFixed(1) }}</p>
            <p v-if="measurement">Current estimate {{ measurement.value }} {{ measurement.unit }} · confidence {{ Math.round(measurement.confidence * 100) }}%</p>
            <p>Target stability {{ targetPercent }}% · {{ result.scenarioCount }} scenarios</p>
          </div>
        </div>
      </template>

      <div v-else class="stable-state" role="status">
        <p><strong>Nothing else needs checking right now.</strong></p>
        <p>{{ rescueAction?.reason || 'Your measurements look consistent enough for this result.' }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.recommendation {
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  padding: 22px 24px;
  background: var(--surface);
}

.recommendation-kicker {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 0.78rem;
}

.recomputing { color: var(--text-secondary); }

.recommendation-title {
  margin: 8px 0 0;
  font-size: clamp(1.55rem, 2.4vw, 1.9rem);
  font-weight: 620;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.recommendation-title--review { color: var(--text-primary); }
.recommendation-title--stable { color: var(--success); }

.recommendation-copy {
  max-width: 52rem;
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.55;
}

.recommendation-copy strong {
  color: var(--text-primary);
  font-weight: 600;
}

.stability-block {
  margin-top: 18px;
  max-width: 36rem;
}

.stability-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.score-value {
  color: var(--text-primary);
  font-size: 1.35rem;
  font-weight: 620;
  letter-spacing: -0.02em;
}

.stability-plot {
  margin-top: 8px;
}

.track-ends {
  display: flex;
  justify-content: space-between;
  color: var(--text-tertiary);
  font-size: 0.72rem;
}

.stability-track {
  position: relative;
  display: block;
  height: 6px;
  margin-top: 6px;
  border-radius: 3px;
  background: var(--surface-subtle);
}

.stability-fill {
  display: block;
  max-width: 100%;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 200ms ease;
}

.stability-marker,
.target-marker {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-primary);
  transform: translate(-50%, -50%);
}

.stability-marker {
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--surface);
}

.target-marker {
  width: 2px;
  height: 14px;
  border-radius: 1px;
  background: var(--text-primary);
}

.target-caption {
  display: block;
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 0.72rem;
}

.action-prompt {
  margin: 18px 0 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.5;
}

.action-prompt strong { color: var(--text-primary); }

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  margin-top: 14px;
}

.verify-button {
  min-height: 44px;
  padding-inline: 18px;
}

.why-toggle,
.tech-toggle {
  min-height: 44px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.86rem;
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.why-toggle:hover,
.tech-toggle:hover { color: var(--text-primary); }

.why-panel {
  margin-top: 14px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
  color: var(--text-secondary);
  font-size: 0.86rem;
  line-height: 1.55;
}

.why-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 12px;
}

.why-facts dt {
  color: var(--text-tertiary);
  font-size: 0.74rem;
}

.why-facts dd {
  margin: 2px 0 0;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.why-panel > p { margin: 0; }

.tech-toggle { margin-top: 8px; }

.tech-panel {
  margin-top: 8px;
  color: var(--text-tertiary);
  font-size: 0.78rem;
}

.tech-panel p { margin: 0; }
.tech-panel p + p { margin-top: 4px; }

.stable-state {
  margin: 16px 0 0;
  border-left: 2px solid var(--success);
  padding-left: 12px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.stable-state p { margin: 0; }
.stable-state p + p { margin-top: 4px; }
.stable-state strong { color: var(--text-primary); }

.loading-state { display: grid; gap: 10px; margin-top: 12px; }
.skeleton--title { width: 40%; height: 28px; }
.skeleton--line { width: 78%; height: 14px; }
.skeleton--bar { width: 100%; max-width: 36rem; height: 6px; margin-top: 8px; }

.state-panel { margin-top: 12px; }
.state-panel p { margin: 0; }
.state-panel strong { color: var(--text-primary); }
.state-detail { margin-top: 4px !important; }
.state-panel .button { margin-top: 10px; }

@media (max-width: 640px) {
  .recommendation { padding: 18px; }
  .why-facts { grid-template-columns: 1fr; gap: 8px; }
  .action-row { flex-direction: column; align-items: stretch; }
  .verify-button,
  .why-toggle { width: 100%; text-align: center; }
}
</style>
