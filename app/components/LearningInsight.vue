<script setup lang="ts">
import type { CalibrationEvidenceOrigin } from '~~/shared/calibration'
import { formatCount, formatPercent } from '~~/shared/format'

const props = withDefaults(defineProps<{
  rawConfidence: number
  calibratedConfidence: number | null
  applied: boolean
  sampleCount: number
  origin?: CalibrationEvidenceOrigin
  updatedLabel?: string
  explanation?: string
}>(), { origin: 'none', updatedLabel: undefined, explanation: undefined })

/**
 * Three distinct states. Synthetic history must never be dressed as production
 * learning, and no adjustment is invented before real evidence exists.
 */
const state = computed(() => {
  if (!props.applied || props.calibratedConfidence == null) return 'no_evidence' as const
  return props.origin === 'real_user_verification' ? 'real' as const : 'preview' as const
})
</script>

<template>
  <section class="learning-insight" :class="{ 'learning-insight--preview': state === 'preview' }" aria-labelledby="learning-title">
    <div class="learning-heading">
      <h2 id="learning-title" class="section-label">
        {{ state === 'preview' ? 'Calibration preview' : 'How sure is the system?' }}
      </h2>
      <span v-if="state === 'preview'" class="demo-chip">Demo</span>
    </div>

    <dl>
      <div>
        <dt>Model confidence</dt>
        <dd class="numeric">{{ formatPercent(rawConfidence) }}</dd>
      </div>

      <template v-if="state === 'no_evidence'">
        <div>
          <dt>Historical calibration</dt>
          <dd>Not available yet</dd>
        </div>
      </template>

      <template v-else-if="state === 'preview'">
        <div>
          <dt>Demo-adjusted confidence</dt>
          <dd class="numeric">{{ formatPercent(calibratedConfidence) }}</dd>
        </div>
        <div>
          <dt>Based on</dt>
          <dd>{{ formatCount(sampleCount) }} synthetic comparison samples</dd>
        </div>
      </template>

      <template v-else>
        <div>
          <dt>Historically adjusted</dt>
          <dd class="numeric">{{ formatPercent(calibratedConfidence) }}</dd>
        </div>
        <div>
          <dt>Based on</dt>
          <dd>{{ formatCount(sampleCount) }} comparable verified measurements</dd>
        </div>
      </template>

      <div v-if="updatedLabel">
        <dt>Updated</dt>
        <dd>{{ updatedLabel }}</dd>
      </div>
    </dl>

    <p v-if="state === 'no_evidence'" class="learning-copy">
      Not enough real verified measurements yet. HomeLens is using the model's original confidence.
    </p>
    <p v-else-if="state === 'preview'" class="learning-copy learning-copy--preview">
      Synthetic history is shown only to demonstrate how calibration works. It is not production evidence.
    </p>

    <details v-if="explanation">
      <summary>How was this confidence adjusted?</summary>
      <p>{{ explanation }}</p>
    </details>
  </section>
</template>

<style scoped>
.learning-insight {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.learning-heading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.demo-chip {
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  padding: 1px 8px;
  color: var(--text-tertiary);
  font-size: 0.68rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.learning-insight--preview .demo-chip {
  border-color: #d8bd86;
  color: #96691a;
}

dl {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;
}

dl > div {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  font-size: 0.9rem;
}

dt { color: var(--text-secondary); }
dd { margin: 0; text-align: right; }

.learning-copy {
  max-width: 44rem;
  margin: 10px 0 0;
  color: var(--text-tertiary);
  font-size: 0.79rem;
  line-height: 1.55;
}

.learning-copy--preview { color: #96691a; }

details {
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

summary { cursor: pointer; color: var(--text-primary); min-height: 32px; }
</style>
