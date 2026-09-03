<script setup lang="ts">
import type { Measurement } from '~/types/scan'
import type { VerificationPriority } from '~~/shared/decision-confidence'

const props = withDefaults(defineProps<{
  measurement: Measurement
  priority?: VerificationPriority
  selected?: boolean
  recommended?: boolean
  forceEdit?: boolean
  disabled?: boolean
  saving?: boolean
  saved?: boolean
  errorMessage?: string | null
}>(), {
  priority: undefined,
  selected: false,
  recommended: false,
  forceEdit: false,
  disabled: false,
  saving: false,
  saved: false,
  errorMessage: null
})

const emit = defineEmits<{
  save: [id: string, value: number]
  select: [id: string]
  'edit-state': [id: string, editing: boolean]
}>()

const editing = ref(false)
const draftValue = ref(String(props.measurement.value))
const input = ref<HTMLInputElement | null>(null)
const parsedValue = computed(() => Number(draftValue.value))
const isValid = computed(() => Number.isFinite(parsedValue.value) && parsedValue.value > 0 && parsedValue.value <= 100)
const impactLabel = computed(() => {
  const impact = props.priority?.impactPercent ?? 0
  if (impact >= 7) return 'High'
  if (impact >= 3) return 'Moderate'
  return 'Low'
})

watch(() => props.measurement.value, value => { draftValue.value = String(value) })
watch(() => props.forceEdit, shouldEdit => { if (shouldEdit) beginEdit() })

const beginEdit = async () => {
  if (props.disabled) return
  editing.value = true
  emit('select', props.measurement.id)
  emit('edit-state', props.measurement.id, true)
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

const cancel = () => {
  draftValue.value = String(props.measurement.value)
  editing.value = false
  emit('edit-state', props.measurement.id, false)
}

const save = () => {
  if (!isValid.value || props.disabled) return
  emit('save', props.measurement.id, parsedValue.value)
}

watch(() => props.saved, wasSaved => {
  if (!wasSaved) return
  editing.value = false
  emit('edit-state', props.measurement.id, false)
})
</script>

<template>
  <article
    :id="`measurement-${measurement.id}`"
    class="measurement-card"
    :class="{ 'measurement-card--selected': selected, 'measurement-card--verified': measurement.source === 'manual' }"
  >
    <div class="measurement-topline">
      <button
        type="button"
        class="measurement-select"
        :aria-pressed="selected"
        :aria-label="`Select ${measurement.label} in room geometry`"
        @click="emit('select', measurement.id)"
      >
        <span class="measurement-label">{{ measurement.label }}</span>
        <span class="measurement-value">
          <span>{{ measurement.value }}</span>
          <span class="measurement-unit">{{ measurement.unit }}</span>
        </span>
      </button>

      <button v-if="!editing" type="button" class="edit-button" :disabled="disabled" @click="beginEdit">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10.9 2.8 2.3 2.3-7.1 7.1-3 .7.7-3Z" /><path d="m9.7 4 2.3 2.3" /></svg>
        Edit
      </button>
    </div>

    <form v-if="editing" class="edit-form" @submit.prevent="save">
      <label :for="`measurement-input-${measurement.id}`">Verified {{ measurement.label.toLowerCase() }}</label>
      <div class="input-row">
        <input
          :id="`measurement-input-${measurement.id}`"
          ref="input"
          v-model="draftValue"
          type="number"
          inputmode="decimal"
          min="0.1"
          max="100"
          step="0.1"
          :aria-invalid="!isValid"
          :disabled="saving"
          @keydown.esc.prevent="cancel"
        >
        <span>{{ measurement.unit }}</span>
      </div>
      <p v-if="!isValid" class="input-error">Enter a value between 0.1 and 100 feet.</p>
      <p v-if="errorMessage" class="input-error" role="alert">{{ errorMessage }}</p>
      <div class="edit-actions">
        <button type="submit" class="button button--small" :disabled="!isValid || saving">{{ saving ? 'Saving verification…' : 'Save verified value' }}</button>
        <button type="button" class="button button--ghost button--small" :disabled="saving" @click="cancel">Cancel</button>
      </div>
    </form>

    <template v-else>
      <div class="measurement-status">
        <ConfidenceBadge :confidence="measurement.confidence" />
        <span class="source">
          <svg v-if="measurement.source === 'manual'" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.2 3.1 3.1L13 4.7" /></svg>
          {{ measurement.source === 'manual' ? 'Human verified' : 'Estimated' }}
        </span>
      </div>

      <p v-if="measurement.source === 'manual' && measurement.originalEstimate" class="original-estimate">
        Original estimate: {{ measurement.originalEstimate.value }} {{ measurement.unit }} · {{ Math.round(measurement.originalEstimate.confidence * 100) }}% model confidence
      </p>

      <div class="measurement-impact">
        <span>Decision impact</span>
        <strong>{{ impactLabel }}</strong>
        <span v-if="priority" class="impact-number">{{ priority.impactPercent.toFixed(1) }}% range</span>
      </div>

      <p v-if="recommended && measurement.source !== 'manual'" class="recommendation">
        <span aria-hidden="true">↑</span> Recommended verification
      </p>
      <p v-if="saved" class="saved-state" role="status">
        <span aria-hidden="true">✓</span> Verified value saved
      </p>
    </template>
  </article>
</template>

<style scoped>
.measurement-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 18px;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-sm);
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.measurement-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--color-accent);
  content: "";
  opacity: 0;
  transition: opacity 180ms ease;
}

.measurement-card--selected {
  border-color: #86aaa4;
  box-shadow: 0 0 0 3px rgb(29 92 88 / 8%), var(--shadow-sm);
}

.measurement-card--selected::before,
.measurement-card--verified::before {
  opacity: 1;
}

.measurement-card--verified::before {
  background: var(--color-high);
}

.measurement-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.measurement-select {
  display: block;
  min-width: 0;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.measurement-label {
  display: block;
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 660;
  letter-spacing: 0.01em;
}

.measurement-value {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 5px;
  margin-top: 4px;
  font-size: clamp(1.7rem, 3vw, 2.1rem);
  font-weight: 680;
  letter-spacing: -0.04em;
  line-height: 1.15;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.measurement-unit {
  color: var(--color-muted);
  font-size: 0.8rem;
  font-weight: 560;
  letter-spacing: 0;
}

.edit-button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 5px;
  border: 0;
  border-radius: 8px;
  padding: 7px 9px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 650;
}

.edit-button:hover {
  background: var(--color-canvas);
  color: var(--color-ink);
}

.edit-button svg {
  width: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.25;
}

.measurement-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 16px;
}

.source {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-muted);
  font-size: 0.7rem;
  font-weight: 580;
  white-space: nowrap;
}

.source svg {
  width: 14px;
  fill: none;
  stroke: var(--color-high);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.original-estimate {
  margin: 10px 0 0;
  color: var(--color-muted);
  font-size: .62rem;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
}

.measurement-impact {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  border-top: 1px solid var(--color-border);
  padding-top: 12px;
  color: var(--color-muted);
  font-size: 0.7rem;
}

.measurement-impact strong {
  color: var(--color-ink-soft);
  font-size: inherit;
}

.impact-number {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.recommendation,
.saved-state {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 12px -18px -18px;
  padding: 10px 18px;
  background: var(--color-review-soft);
  color: var(--color-review);
  font-size: 0.72rem;
  font-weight: 670;
}

.saved-state {
  background: var(--color-high-soft);
  color: var(--color-high);
  animation: reveal-status 180ms ease-out;
}

.edit-form {
  margin-top: 18px;
  border-top: 1px solid var(--color-border);
  padding-top: 16px;
}

.edit-form label {
  display: block;
  color: var(--color-ink-soft);
  font-size: 0.76rem;
  font-weight: 650;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 8px;
}

.input-row input {
  width: min(150px, calc(100% - 36px));
  min-height: 44px;
  border: 1px solid var(--color-border-strong);
  border-radius: 9px;
  padding: 8px 11px;
  background: #fff;
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.input-row span {
  color: var(--color-muted);
  font-size: 0.8rem;
}

.input-error {
  margin: 7px 0 0;
  color: var(--color-danger);
  font-size: 0.72rem;
}

.edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 14px;
}

@keyframes reveal-status {
  from { opacity: 0; transform: translateY(4px); }
}

@media (max-width: 374px) {
  .measurement-status {
    align-items: flex-start;
    flex-direction: column;
  }

  .impact-number {
    display: none;
  }
}
</style>
