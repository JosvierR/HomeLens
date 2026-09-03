<script setup lang="ts">
import type { FitVerdict } from '~~/shared/fit-check'
import { evaluateRoomFit, summarizeRoomFit } from '~~/shared/fit-check'
import { formatPercent, formatSignedFeet } from '~~/shared/format'
import type { RoomScan } from '~/types/scan'

const props = withDefaults(defineProps<{
  scan: RoomScan
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ verify: [measurementId: string] }>()

const results = computed(() => evaluateRoomFit(props.scan))
const summary = computed(() => summarizeRoomFit(results.value))
const undecided = computed(() => results.value.filter(result => result.verdict === 'uncertain'))
const decidingLabel = computed(() =>
  props.scan.measurements.find(item => item.id === summary.value.decidingMeasurementId)?.label
  ?? summary.value.decidingLabel
)

const verdictLabel: Record<FitVerdict, string> = {
  fits: 'Fits',
  uncertain: 'Uncertain',
  does_not_fit: "Doesn't fit",
  unsupported: 'Not checked'
}
</script>

<template>
  <section class="fit-check" aria-labelledby="fit-check-title">
    <h2 id="fit-check-title" class="section-label">Will it fit?</h2>
    <p class="fit-headline">{{ summary.headline }}</p>
    <p class="fit-note">
      Common furniture checked against your measured room, including the walkway each item needs.
      Clearance is what remains after that walkway.
    </p>

    <ul class="fit-list">
      <li v-for="result in results" :key="result.item.id" :class="`verdict--${result.verdict}`">
        <div class="fit-row">
          <span class="fit-label">{{ result.item.label }}</span>
          <span class="fit-verdict">{{ verdictLabel[result.verdict] }}</span>
          <span class="fit-probability numeric">{{ formatPercent(result.probability) }}</span>
          <span class="fit-margin numeric">
            {{ formatSignedFeet(result.clearanceFeet) }}
            <span class="sr-only">clearance after the required walkway</span>
          </span>
        </div>
        <p class="fit-summary">{{ result.summary }}</p>
        <p class="fit-rationale">{{ result.item.rationale }}</p>
      </li>
    </ul>

    <div v-if="undecided.length && summary.decidingMeasurementId" class="fit-action">
      <div>
        <p class="fit-action-title">What would make this certain?</p>
        <p>
          <strong>{{ decidingLabel }}</strong> is the measurement holding
          {{ undecided.length }} item{{ undecided.length === 1 ? '' : 's' }} undecided.
          Taping it turns those into a definite answer.
        </p>
      </div>
      <button
        type="button"
        class="button button--secondary button--small"
        :disabled="disabled"
        @click="emit('verify', summary.decidingMeasurementId)"
      >Check {{ decidingLabel?.toLowerCase() }}</button>
    </div>
    <p v-else class="fit-action fit-action--settled">All fit results are resolved.</p>
  </section>
</template>

<style scoped>
.fit-headline {
  margin: 6px 0 0;
  color: var(--text-primary);
  font-size: 0.98rem;
  font-weight: 560;
}

.fit-note {
  max-width: 46rem;
  margin: 4px 0 0;
  color: var(--text-tertiary);
  font-size: 0.79rem;
  line-height: 1.5;
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
  grid-template-columns: minmax(0, 1fr) 84px 52px 66px;
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
  white-space: nowrap;
}

.verdict--fits .fit-verdict { border-color: var(--success); color: var(--success); }
.verdict--uncertain .fit-verdict { border-color: #b58224; color: #96691a; }
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

.fit-action-title {
  color: var(--text-primary) !important;
  font-weight: 560;
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

  .fit-action { align-items: stretch; flex-direction: column; }
}
</style>
