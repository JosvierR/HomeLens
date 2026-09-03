<script setup lang="ts">
import type { Measurement } from '~/types/scan'
import type { RescueAction } from '~~/shared/scan-rescue'

const props = withDefaults(defineProps<{
  action: RescueAction | null
  measurement?: Measurement
  pending?: boolean
  errorMessage?: string | null
  disabled?: boolean
}>(), {
  measurement: undefined,
  pending: false,
  errorMessage: null,
  disabled: false
})

const emit = defineEmits<{ verify: [id: string]; retry: [] }>()
const expanded = ref(false)
const currentPercent = computed(() => Math.round((props.action?.currentStability ?? 0) * 100))
const projectedPercent = computed(() => Math.round((props.action?.projectedStability ?? 0) * 100))
</script>

<template>
  <section class="rescue-card surface" aria-labelledby="rescue-title" :aria-busy="pending">
    <div class="rescue-kicker">
      <span class="rescue-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>Scan Rescue</span>
      <span v-if="action?.status === 'needs_verification'" class="action-count">{{ action.actions.length || 1 }} {{ action.actions.length === 1 ? 'action' : 'planned' }}</span>
    </div>
    <h2 id="rescue-title">Resolve the uncertainty that matters.</h2>

    <div v-if="pending && !action" class="rescue-loading">
      <div class="skeleton" />
      <div class="skeleton" />
      <p>Finding the highest-impact verification…</p>
    </div>

    <div v-else-if="errorMessage && !action" class="state-panel state-panel--error" role="alert">
      <div>
        <strong>Scan Rescue is unavailable.</strong>
        <p>We could not rank the next verification.</p>
        <button type="button" class="button button--secondary button--small" @click="emit('retry')">Try again</button>
      </div>
    </div>

    <div v-else-if="!action" class="state-panel">
      <p>No verification recommendation is available.</p>
    </div>

    <div v-else-if="action.status === 'stable'" class="stable-state" role="status">
      <span aria-hidden="true">✓</span>
      <div><strong>No rescue needed</strong><p>{{ action.reason }}</p></div>
    </div>

    <template v-else>
      <p class="rescue-summary">Your downstream decision is unstable. Start with the measurement projected to produce the largest useful gain.</p>

      <div class="recommendation-block">
        <p class="eyebrow">Recommended verification</p>
        <div class="recommended-title">
          <div>
            <h3>{{ action.label }}</h3>
            <p v-if="measurement">Current · {{ measurement.value }} {{ measurement.unit }}</p>
          </div>
          <ConfidenceBadge v-if="measurement" :confidence="measurement.confidence" />
        </div>

        <div class="projected-gain">
          <span>Projected stability gain</span>
          <div><strong>{{ currentPercent }}%</strong><span aria-hidden="true">→</span><strong>{{ projectedPercent }}%</strong></div>
        </div>
        <div v-if="action.actions[0]?.calibrationApplied" class="calibrated-reliability">
          <span>{{ action.actions[0].calibrationDemoEvidence ? 'Includes demo evidence' : 'Historical evidence' }}</span>
          <p>Raw confidence <strong>{{ Math.round(action.actions[0].rawConfidence * 100) }}%</strong> · Calibrated reliability <strong>{{ Math.round((action.actions[0].calibratedConfidence ?? action.actions[0].rawConfidence) * 100) }}%</strong></p>
        </div>
      </div>

      <button
        type="button"
        class="button verify-button"
        :disabled="disabled || !action.measurementId"
        @click="action.measurementId && emit('verify', action.measurementId)"
      >
        Verify measurement
      </button>
      <button type="button" class="why-button" :aria-expanded="expanded" aria-controls="rescue-explanation" @click="expanded = !expanded">
        Why this measurement?
        <svg viewBox="0 0 16 16" aria-hidden="true" :class="{ 'is-open': expanded }"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <div v-show="expanded" id="rescue-explanation" class="explanation">
        {{ action.reason }} HomeLens tests each unresolved input against the downstream planning model and stops requesting work once no useful action remains or the stability target is reached.
      </div>
    </template>
  </section>
</template>

<style scoped>
.rescue-card {
  overflow: hidden;
  border-color: #c7d7d3;
  padding: 22px;
  background: #f8fbf9;
}

.rescue-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-accent);
  font-size: 0.69rem;
  font-weight: 760;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.rescue-mark {
  display: flex;
  align-items: flex-end;
  gap: 2px;
}

.rescue-mark i {
  display: block;
  width: 2px;
  height: 7px;
  background: currentColor;
}

.rescue-mark i:nth-child(2) { height: 11px; }
.rescue-mark i:nth-child(3) { height: 5px; }

.action-count {
  margin-left: auto;
  border: 1px solid #c5dad5;
  border-radius: 999px;
  padding: 3px 7px;
  background: var(--color-accent-soft);
  font-size: 0.59rem;
  letter-spacing: 0.04em;
}

h2 {
  margin: 8px 0 0;
  font-size: 1.08rem;
  font-weight: 680;
  letter-spacing: -0.025em;
  line-height: 1.35;
}

.rescue-summary {
  margin: 12px 0 0;
  color: var(--color-muted);
  font-size: 0.78rem;
  line-height: 1.55;
}

.recommendation-block {
  margin-top: 17px;
  border: 1px solid #d2dfdc;
  border-radius: 11px;
  padding: 15px;
  background: #fff;
}

.recommended-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: 9px;
}

.recommended-title h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 690;
  letter-spacing: -0.02em;
}

.recommended-title p {
  margin: 3px 0 0;
  color: var(--color-muted);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.projected-gain {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-top: 16px;
  border-top: 1px solid var(--color-border);
  padding-top: 12px;
}

.projected-gain > span {
  color: var(--color-muted);
  font-size: 0.68rem;
}

.projected-gain div {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.projected-gain strong {
  color: var(--color-ink);
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}

.projected-gain strong:last-child {
  color: var(--color-accent);
}

.calibrated-reliability {
  margin-top: 12px;
  border-top: 1px solid var(--color-border);
  padding-top: 11px;
}

.calibrated-reliability > span {
  color: var(--color-accent);
  font-size: .57rem;
  font-weight: 720;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.calibrated-reliability p {
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: .65rem;
  line-height: 1.45;
}

.calibrated-reliability strong { color: var(--color-ink); }

.verify-button {
  width: 100%;
  margin-top: 14px;
}

.why-button {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  padding: 9px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 650;
}

.why-button:hover {
  color: var(--color-ink);
}

.why-button svg {
  width: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
  transition: transform 160ms ease;
}

.why-button svg.is-open {
  transform: rotate(180deg);
}

.explanation {
  border-top: 1px solid #d2dfdc;
  padding-top: 13px;
  color: var(--color-muted);
  font-size: 0.73rem;
  line-height: 1.55;
}

.rescue-loading {
  padding-top: 24px;
}

.rescue-loading .skeleton:first-child {
  width: 72%;
  height: 16px;
}

.rescue-loading .skeleton:nth-child(2) {
  width: 100%;
  height: 72px;
  margin-top: 14px;
}

.rescue-loading p {
  margin: 12px 0 0;
  color: var(--color-muted);
  font-size: 0.72rem;
}

.state-panel {
  min-height: 145px;
  margin-top: 18px;
}

.state-panel--error {
  border-color: #e1b8b1;
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.state-panel strong {
  display: block;
  color: var(--color-ink);
}

.state-panel p,
.state-panel .button {
  margin-top: 8px;
}

.stable-state {
  display: flex;
  gap: 12px;
  margin-top: 18px;
  border: 1px solid #cbe1d3;
  border-radius: 11px;
  padding: 15px;
  background: var(--color-high-soft);
  color: var(--color-high);
}

.stable-state > span {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--color-high);
  color: #fff;
  font-size: 0.75rem;
}

.stable-state strong {
  color: var(--color-ink);
  font-size: 0.82rem;
}

.stable-state p {
  margin: 3px 0 0;
  font-size: 0.72rem;
  line-height: 1.5;
}
</style>
