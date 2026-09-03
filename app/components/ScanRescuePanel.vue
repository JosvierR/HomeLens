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
  <section class="rescue-panel" aria-labelledby="rescue-title" :aria-busy="pending">
    <h2 id="rescue-title" class="section-label">Needs verification</h2>

    <div v-if="pending && !action" class="rescue-loading">
      <div class="skeleton" />
      <div class="skeleton" />
    </div>

    <div v-else-if="errorMessage && !action" class="state-panel state-panel--error" role="alert">
      <div>
        <p><strong>Verification ranking is unavailable.</strong></p>
        <button type="button" class="button button--secondary button--small" @click="emit('retry')">Try again</button>
      </div>
    </div>

    <div v-else-if="!action" class="state-panel">
      <p>No verification recommendation is available.</p>
    </div>

    <p v-else-if="action.status === 'stable'" class="stable-state" role="status">
      Nothing left to verify. {{ action.reason }}
    </p>

    <div v-else class="rescue-body">
      <p class="rescue-target">{{ action.label }}</p>
      <p v-if="measurement" class="rescue-meta numeric">
        {{ measurement.value }} {{ measurement.unit }} · model estimate · {{ Math.round(measurement.confidence * 100) }}%
      </p>

      <p class="rescue-projection">
        <span>Projected stability</span>
        <span class="numeric">{{ currentPercent }}% <span aria-hidden="true">→</span> <strong>{{ projectedPercent }}%</strong></span>
      </p>

      <button
        type="button"
        class="button verify-button"
        :disabled="disabled || !action.measurementId"
        @click="action.measurementId && emit('verify', action.measurementId)"
      >
        Verify measurement
      </button>

      <button
        type="button"
        class="why-button"
        :aria-expanded="expanded"
        aria-controls="rescue-explanation"
        @click="expanded = !expanded"
      >Why this measurement?</button>
      <p v-show="expanded" id="rescue-explanation" class="explanation">
        {{ action.reason }} HomeLens tests each unresolved input against the planning model and stops asking for work once the stability target is reached.
      </p>
    </div>
  </section>
</template>

<style scoped>
/* The one contained region on the page: it is an action affordance,
   not a presentation surface. */
.rescue-body {
  margin-top: 8px;
  border-radius: var(--radius-panel);
  padding: 14px;
  background: var(--surface-subtle);
}

.rescue-target {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.rescue-meta {
  margin: 2px 0 0;
  color: var(--text-secondary);
  font-size: 0.79rem;
}

.rescue-projection {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 0 0;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  color: var(--text-secondary);
  font-size: 0.81rem;
}

.rescue-projection strong {
  color: var(--text-primary);
  font-weight: 600;
}

.verify-button {
  width: 100%;
  min-height: 38px;
  margin-top: 12px;
}

.why-button {
  display: block;
  width: 100%;
  min-height: 32px;
  border: 0;
  padding: 8px 0 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.79rem;
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.why-button:hover { color: var(--text-primary); }

.explanation {
  margin: 10px 0 0;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  color: var(--text-secondary);
  font-size: 0.79rem;
  line-height: 1.55;
}

.stable-state {
  margin: 8px 0 0;
  border-left: 2px solid var(--success);
  padding-left: 12px;
  color: var(--text-secondary);
  font-size: 0.83rem;
  line-height: 1.55;
}

.rescue-loading {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.rescue-loading .skeleton:first-child { height: 20px; width: 60%; }
.rescue-loading .skeleton:last-child { height: 76px; }

.state-panel { margin-top: 10px; }
.state-panel p { margin: 0; }
.state-panel strong { color: var(--text-primary); }
.state-panel .button { margin-top: 10px; }
</style>
