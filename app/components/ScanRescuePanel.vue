<script setup lang="ts">
import type { Measurement } from '~/types/scan'
import type { VerificationPriority } from '~~/shared/decision-confidence'
import type { RescueAction } from '~~/shared/scan-rescue'
import { formatFeet, formatPercent, formatPercentPoints } from '~~/shared/format'

const props = withDefaults(defineProps<{
  action: RescueAction | null
  measurement?: Measurement
  queue?: VerificationPriority[]
  selectedId?: string | null
  pending?: boolean
  errorMessage?: string | null
  disabled?: boolean
}>(), {
  measurement: undefined,
  queue: () => [],
  selectedId: null,
  pending: false,
  errorMessage: null,
  disabled: false
})

const emit = defineEmits<{
  verify: [id: string]
  retry: []
  select: [id: string]
}>()

const currentPercent = computed(() => Math.round((props.action?.currentStability ?? 0) * 100))
const projectedPercent = computed(() => Math.round((props.action?.projectedStability ?? 0) * 100))

const otherItems = computed(() =>
  props.queue.filter(item => item.measurementId !== props.action?.measurementId).slice(0, 3)
)
</script>

<template>
  <section class="check-panel" aria-labelledby="check-title" :aria-busy="pending">
    <div class="check-heading">
      <h2 id="check-title">What to check next</h2>
    </div>

    <div v-if="pending && !action" class="check-loading">
      <div class="skeleton" />
      <div class="skeleton" />
    </div>

    <div v-else-if="errorMessage && !action" class="state-panel state-panel--error" role="alert">
      <div>
        <p><strong>We could not rank the next check.</strong></p>
        <button type="button" class="button button--secondary button--small" @click="emit('retry')">Try again</button>
      </div>
    </div>

    <div v-else-if="!action" class="state-panel">
      <p>No verification recommendation is available.</p>
    </div>

    <div v-else class="check-body">
      <p class="check-target">Check {{ action.label?.toLowerCase() }}</p>
      <p v-if="measurement" class="check-meta numeric">
        {{ formatFeet(measurement.value, measurement.unit) }}
        <span aria-hidden="true">·</span>
        Photo estimate
        <span aria-hidden="true">·</span>
        {{ formatPercent(measurement.confidence) }} confidence
      </p>

      <p class="check-reason">
        This is the one measurement most likely to change the result.
      </p>

      <p class="check-projection">
        <span>If you check it</span>
        <span class="numeric">{{ currentPercent }}% <span aria-hidden="true">→</span> <strong>{{ projectedPercent }}%</strong></span>
      </p>

      <button
        type="button"
        class="button verify-button"
        :disabled="disabled || !action.measurementId"
        @click="action.measurementId && emit('verify', action.measurementId)"
      >
        Verify {{ action.label?.toLowerCase() }}
      </button>

      <div v-if="otherItems.length" class="other-checks">
        <h3>Other things worth checking</h3>
        <ol>
          <li v-for="item in otherItems" :key="item.measurementId">
            <button
              type="button"
              :class="{ 'is-selected': selectedId === item.measurementId }"
              :aria-pressed="selectedId === item.measurementId"
              @click="emit('select', item.measurementId)"
            >
              <span>{{ item.label }}</span>
              <span class="numeric">{{ formatPercentPoints(item.impactPercent) }}</span>
            </button>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.check-panel {
  min-width: 0;
}

.check-heading h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 620;
  letter-spacing: -0.015em;
}

.check-body {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  padding: 16px;
  background: var(--surface-subtle);
}

.check-target {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 620;
  letter-spacing: -0.015em;
}

.check-meta {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.check-reason {
  margin: 12px 0 0;
  color: var(--text-secondary);
  font-size: 0.84rem;
  line-height: 1.5;
}

.check-projection {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 0 0;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.check-projection strong {
  color: var(--text-primary);
  font-weight: 620;
}

.verify-button {
  width: 100%;
  min-height: 44px;
  margin-top: 14px;
}

.other-checks {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.other-checks h3 {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.76rem;
  font-weight: 560;
}

.other-checks ol {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.other-checks button {
  display: flex;
  width: 100%;
  min-height: 36px;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  border: 0;
  border-radius: var(--radius-control);
  padding: 6px 4px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.84rem;
  text-align: left;
}

.other-checks button:hover,
.other-checks .is-selected {
  color: var(--accent);
}

.other-checks .numeric {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.check-loading {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.check-loading .skeleton:first-child { height: 20px; width: 55%; }
.check-loading .skeleton:last-child { height: 120px; }

.state-panel { margin-top: 12px; }
.state-panel p { margin: 0; }
.state-panel strong { color: var(--text-primary); }
.state-panel .button { margin-top: 10px; }
</style>
