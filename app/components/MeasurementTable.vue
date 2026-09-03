<script setup lang="ts">
import type { Measurement } from '~/types/scan'
import type { VerificationPriority } from '~~/shared/decision-confidence'

const props = withDefaults(defineProps<{
  measurements: Measurement[]
  priorities?: VerificationPriority[]
  selectedId?: string | null
  recommendedId?: string | null
  editingId?: string | null
  savingId?: string | null
  savedId?: string | null
  errorId?: string | null
  errorMessage?: string | null
  disabled?: boolean
}>(), {
  priorities: () => [],
  selectedId: null,
  recommendedId: null,
  editingId: null,
  savingId: null,
  savedId: null,
  errorId: null,
  errorMessage: null,
  disabled: false
})

const emit = defineEmits<{
  save: [id: string, value: number]
  select: [id: string]
  'edit-state': [id: string, editing: boolean]
}>()

const openEditorId = ref<string | null>(null)
const draftValue = ref('')
const inputs = ref<Record<string, HTMLInputElement | null>>({})

const priorityFor = (id: string) => props.priorities.find(item => item.measurementId === id)
const parsedValue = computed(() => Number(draftValue.value))
const isValid = computed(() => Number.isFinite(parsedValue.value) && parsedValue.value > 0 && parsedValue.value <= 100)

const impactLabel = (id: string) => {
  const impact = priorityFor(id)?.impactPercent ?? 0
  if (impact >= 7) return 'High'
  if (impact >= 3) return 'Medium'
  return 'Low'
}

const isRecommended = (measurement: Measurement) =>
  props.recommendedId === measurement.id && measurement.source !== 'manual'

const beginEdit = async (id: string) => {
  if (props.disabled) return
  const measurement = props.measurements.find(item => item.id === id)
  if (!measurement) return
  draftValue.value = String(measurement.value)
  openEditorId.value = id
  emit('select', id)
  emit('edit-state', id, true)
  await nextTick()
  const input = inputs.value[id]
  input?.focus()
  input?.select()
}

const cancel = (id: string) => {
  openEditorId.value = null
  emit('edit-state', id, false)
}

const save = (id: string) => {
  if (!isValid.value || props.disabled) return
  emit('save', id, parsedValue.value)
}

watch(() => props.editingId, id => { if (id && id !== openEditorId.value) beginEdit(id) })
watch(() => props.savedId, id => {
  if (id && id === openEditorId.value) {
    openEditorId.value = null
    emit('edit-state', id, false)
  }
})
</script>

<template>
  <table class="measurement-table">
    <caption class="sr-only">Room measurements with source, model confidence and decision impact. Select a row to trace it in the room geometry.</caption>
    <thead>
      <tr>
        <th scope="col">Measurement</th>
        <th scope="col" class="align-right">Value</th>
        <th scope="col">Source</th>
        <th scope="col">Confidence</th>
        <th scope="col" class="align-right">Decision impact</th>
        <th scope="col"><span class="sr-only">Action</span></th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="measurement in measurements"
        :id="`measurement-${measurement.id}`"
        :key="measurement.id"
        class="measurement-row"
        :class="{
          'measurement-row--selected': selectedId === measurement.id,
          'measurement-row--editing': openEditorId === measurement.id
        }"
      >
        <th scope="row" data-label="Measurement">
          <button
            type="button"
            class="measurement-select"
            :aria-pressed="selectedId === measurement.id"
            :aria-label="`Trace ${measurement.label} in the room geometry`"
            @click="emit('select', measurement.id)"
          >{{ measurement.label }}</button>
          <span v-if="isRecommended(measurement)" class="row-flag">Needs verification</span>
        </th>

        <td class="value-cell" data-label="Value">
          <form
            v-if="openEditorId === measurement.id"
            :id="`measurement-form-${measurement.id}`"
            class="edit-form"
            @submit.prevent="save(measurement.id)"
          >
            <label :for="`measurement-input-${measurement.id}`" class="sr-only">Verified {{ measurement.label.toLowerCase() }} in {{ measurement.unit }}</label>
            <input
              :id="`measurement-input-${measurement.id}`"
              :ref="element => { inputs[measurement.id] = element as HTMLInputElement | null }"
              v-model="draftValue"
              type="number"
              inputmode="decimal"
              min="0.1"
              max="100"
              step="0.1"
              class="numeric"
              :aria-invalid="!isValid"
              :disabled="savingId === measurement.id"
              @keydown.esc.prevent="cancel(measurement.id)"
            >
            <span class="unit">{{ measurement.unit }}</span>
          </form>
          <span v-else class="measurement-value numeric">
            {{ measurement.value }}<span class="unit">{{ measurement.unit }}</span>
          </span>
          <span v-if="measurement.source === 'estimated' && measurement.uncertaintyLow !== undefined && measurement.uncertaintyHigh !== undefined" class="uncertainty-range numeric">
            {{ measurement.uncertaintyLow.toFixed(1) }}-{{ measurement.uncertaintyHigh.toFixed(1) }} {{ measurement.unit }}
          </span>
          <p v-if="openEditorId === measurement.id && !isValid" class="input-error">Enter a value between 0.1 and 100 ft.</p>
          <p v-if="errorId === measurement.id && errorMessage" class="input-error" role="alert">{{ errorMessage }}</p>
        </td>

        <td data-label="Source">
          <span class="source">{{ measurement.source === 'manual' ? 'Verified' : measurement.provenance?.measurementMethod === 'photo_metric_depth' ? 'Metric depth' : 'Estimated' }}</span>
          <span v-if="measurement.source === 'estimated' && measurement.provenance" class="original-estimate">
            {{ measurement.provenance.supportingViewCount }} supporting view{{ measurement.provenance.supportingViewCount === 1 ? '' : 's' }}
          </span>
          <span v-if="measurement.source === 'manual' && measurement.originalEstimate" class="original-estimate numeric">
            was {{ measurement.originalEstimate.value }} {{ measurement.unit }} at {{ Math.round(measurement.originalEstimate.confidence * 100) }}%
          </span>
        </td>

        <td data-label="Confidence">
          <ConfidenceBadge :confidence="measurement.confidence" />
        </td>

        <td class="impact-cell align-right" data-label="Impact">
          <span class="numeric">{{ (priorityFor(measurement.id)?.impactPercent ?? 0).toFixed(1) }}%</span>
          <span class="impact-word">{{ impactLabel(measurement.id) }}</span>
        </td>

        <td class="action-cell">
          <div v-if="openEditorId === measurement.id" class="edit-actions">
            <button
              type="submit"
              class="button button--small"
              :form="`measurement-form-${measurement.id}`"
              :disabled="!isValid || savingId === measurement.id"
            >{{ savingId === measurement.id ? 'Saving…' : 'Save verified value' }}</button>
            <button
              type="button"
              class="button button--ghost button--small"
              :disabled="savingId === measurement.id"
              @click="cancel(measurement.id)"
            >Cancel</button>
          </div>
          <span v-else-if="savedId === measurement.id" class="row-saved" role="status">Verified</span>
          <button
            v-else-if="isRecommended(measurement)"
            type="button"
            class="button button--small row-verify"
            :disabled="disabled"
            :aria-label="`Check ${measurement.label}`"
            @click="beginEdit(measurement.id)"
          >Check</button>
          <button
            v-else
            type="button"
            class="edit-button"
            :disabled="disabled"
            :aria-label="`Edit ${measurement.label}`"
            @click="beginEdit(measurement.id)"
          >Edit</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.measurement-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

thead th {
  border-bottom: 1px solid var(--border);
  padding: 0 12px 8px;
  color: var(--text-tertiary);
  font-size: 0.73rem;
  font-weight: 560;
  white-space: nowrap;
}

thead th:first-child { padding-left: 0; }
thead th:last-child { padding-right: 0; }

.align-right { text-align: right; }

.measurement-row > * {
  border-bottom: 1px solid var(--border);
  padding: 11px 12px;
  vertical-align: baseline;
  font-weight: 400;
  transition: background-color 140ms ease;
}

.measurement-row > *:first-child { padding-left: 0; }
.measurement-row > *:last-child { padding-right: 0; }

/* Selection raises contrast with a rule, not a floating outlined box. */
.measurement-row--selected > * {
  background: var(--surface-subtle);
}

.measurement-row--selected > *:first-child {
  box-shadow: inset 2px 0 0 var(--accent);
}

.measurement-select {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 560;
  text-align: left;
}

.measurement-select:hover { color: var(--accent); }

.row-flag {
  display: block;
  margin-top: 2px;
  color: var(--warning);
  font-size: 0.72rem;
}

.value-cell { text-align: right; }

.measurement-value {
  font-size: 1.02rem;
  font-weight: 600;
  letter-spacing: -0.012em;
}

.unit {
  margin-left: 3px;
  color: var(--text-tertiary);
  font-size: 0.76rem;
  font-weight: 400;
  letter-spacing: 0;
}

.uncertainty-range {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 0.7rem;
}

.edit-form {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 4px;
}

.edit-form input {
  width: 78px;
  min-height: 32px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-control);
  padding: 4px 8px;
  background: #fff;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 600;
  text-align: right;
}

.edit-form input:focus-visible { outline-offset: 1px; }

.input-error {
  margin: 5px 0 0;
  color: var(--danger);
  font-size: 0.73rem;
  text-align: right;
}

.source {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.original-estimate {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 0.72rem;
}

.impact-cell .numeric {
  color: var(--text-primary);
  font-size: 0.83rem;
  font-weight: 600;
}

.impact-word {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 0.72rem;
}

.action-cell { text-align: right; white-space: nowrap; }

.edit-button {
  min-height: 28px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  padding: 4px 9px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
}

.edit-button:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.edit-button:disabled { cursor: not-allowed; opacity: 0.4; }

.edit-actions {
  display: inline-flex;
  gap: 4px;
}

.row-saved {
  color: var(--success);
  font-size: 0.79rem;
}

.row-verify {
  min-height: 32px;
}

/* Below the table breakpoint each measurement becomes a labelled block,
   keeping the same reading order rather than a horizontal scroller. */
@media (max-width: 700px) {
  .measurement-table,
  .measurement-table tbody,
  .measurement-row,
  .measurement-row > * {
    display: block;
  }

  thead { display: none; }

  .measurement-row {
    border-bottom: 1px solid var(--border);
    padding: 12px 0;
  }

  .measurement-row > * {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 0;
    padding: 3px 0;
    text-align: left;
  }

  .measurement-row > *[data-label]::before {
    color: var(--text-tertiary);
    content: attr(data-label);
    font-size: 0.78rem;
    font-weight: 400;
  }

  .measurement-row > *:first-child::before { content: none; }

  .measurement-row > *:first-child {
    display: block;
    padding-bottom: 6px;
  }

  .measurement-row--selected > * { background: transparent; }

  .measurement-row--selected {
    box-shadow: inset 2px 0 0 var(--accent);
    padding-left: 12px;
  }

  .measurement-row--selected > *:first-child { box-shadow: none; }

  .value-cell { text-align: right; }

  .impact-cell { justify-content: flex-start; }
  .impact-cell .numeric { margin-left: auto; }

  .impact-cell .impact-word,
  .original-estimate { display: inline; margin-left: 6px; }

  .measurement-row > td { flex-wrap: wrap; }

  .value-cell .input-error {
    flex: 1 0 100%;
    text-align: right;
  }

  .action-cell {
    justify-content: flex-start;
    padding-top: 8px;
  }

  .action-cell::before { content: none !important; }

  .edit-button {
    min-height: 32px;
    border-color: var(--border-strong);
  }

  .edit-form { justify-content: flex-start; }
  .input-error { text-align: left; }
}
</style>
