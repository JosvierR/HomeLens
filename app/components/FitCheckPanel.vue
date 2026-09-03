<script setup lang="ts">
import type { FitCheckResult, FitVerdict } from '~~/shared/fit-check'
import { evaluateRoomFit, summarizeRoomFit } from '~~/shared/fit-check'
import type { RoomScan } from '~/types/scan'

const props = withDefaults(defineProps<{
  scan: RoomScan
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ verify: [measurementId: string] }>()

const results = computed(() => evaluateRoomFit(props.scan))
const summary = computed(() => summarizeRoomFit(results.value))
const undecided = computed(() => results.value.filter(result => result.verdict === 'tight'))
const decidingLabel = computed(() =>
  props.scan.measurements.find(item => item.id === summary.value.decidingMeasurementId)?.label ?? null
)

const verdictLabel: Record<FitVerdict, string> = {
  fits: 'Fits',
  tight: 'Tight',
  does_not_fit: 'No',
  unsupported: 'Unknown'
}

const percent = (value: number) => `${Math.round(value * 100)}%`
const marginLabel = (result: FitCheckResult) => Number.isFinite(result.marginFeet)
  ? `${result.marginFeet >= 0 ? '+' : ''}${result.marginFeet.toFixed(1)} ft`
  : '--'
</script>

<template>
  <section class="fit-check" aria-labelledby="fit-check-title">
    <h2 id="fit-check-title" class="section-label">Will it fit?</h2>
    <p class="fit-note">
      Standard furniture checked against your measured room, including the walkway each item needs.
      Answers are given over the measured range, not a single number.
    </p>

    <p class="fit-headline">{{ summary.headline }}</p>

    <ul class="fit-list">
      <li v-for="result in results" :key="result.item.id" :class="`verdict--${result.verdict}`">
        <div class="fit-row">
          <span class="fit-label">{{ result.item.label }}</span>
          <span class="fit-verdict">{{ verdictLabel[result.verdict] }}</span>
          <span class="fit-probability numeric">{{ percent(result.probability) }}</span>
          <span class="fit-margin numeric" :title="`Tightest clearance in the best orientation`">{{ marginLabel(result) }}</span>
        </div>
        <p class="fit-summary">{{ result.summary }}</p>
        <p class="fit-rationale">{{ result.item.rationale }}</p>
      </li>
    </ul>

    <div v-if="undecided.length && decidingLabel" class="fit-action">
      <p>
        <strong>{{ decidingLabel }}</strong> is what keeps
        {{ undecided.length }} item{{ undecided.length === 1 ? '' : 's' }} undecided.
        Measuring it with a tape turns those into a definitive answer.
      </p>
      <button
        type="button"
        class="button button--secondary button--small"
        :disabled="disabled"
        @click="emit('verify', summary.decidingMeasurementId!)"
      >Check {{ decidingLabel.toLowerCase() }}</button>
    </div>
    <p v-else class="fit-action fit-action--settled">
      Nothing here is waiting on measurement uncertainty.
    </p>
  </section>
</template>

<style scoped>
.fit-note {
  max-width: 46rem;
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 0.79rem;
  line-height: 1.5;
}

.fit-headline {
  margin: 14px 0 0;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 560;
}

.fit-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.fit-list li {
  border-top: 1px solid var(--border);
  padding: 12px 0;
}

.fit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 62px 52px 62px;
  align-items: baseline;
  gap: 12px;
}

.fit-label {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 0.92rem;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fit-verdict {
  justify-self: start;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  padding: 2px 9px;
  color: var(--text-secondary);
  font-size: 0.71rem;
}

.verdict--fits .fit-verdict { border-color: var(--success); color: var(--success); }
.verdict--tight .fit-verdict { border-color: #b58224; color: #96691a; }
.verdict--does_not_fit .fit-verdict { color: var(--text-tertiary); }

.fit-probability,
.fit-margin {
  color: var(--text-secondary);
  font-size: 0.81rem;
  text-align: right;
}

.fit-summary {
  margin: 5px 0 0;
  max-width: 52rem;
  color: var(--text-secondary);
  font-size: 0.84rem;
  line-height: 1.5;
}

.fit-rationale {
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 0.75rem;
}

.fit-action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 0;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}

.fit-action p {
  max-width: 42rem;
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}

.fit-action strong { color: var(--text-primary); }

.fit-action--settled {
  display: block;
  color: var(--text-tertiary);
  font-size: 0.82rem;
}

@media (max-width: 620px) {
  .fit-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 10px;
  }

  .fit-verdict { grid-row: 1; grid-column: 2; justify-self: end; }
  .fit-probability { grid-column: 1; text-align: left; }
  .fit-margin { grid-column: 2; }
}
</style>
