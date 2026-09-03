<script setup lang="ts">
import type { VerificationPriority } from '~~/shared/decision-confidence'

withDefaults(defineProps<{
  items: VerificationPriority[]
  selectedId?: string | null
  pending?: boolean
}>(), {
  selectedId: null,
  pending: false
})

const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <section class="queue surface" aria-labelledby="queue-title" :aria-busy="pending">
    <div class="queue-heading">
      <div><p class="eyebrow">Verification queue</p><h2 id="queue-title">Ranked by decision impact</h2></div>
      <span>impact × uncertainty</span>
    </div>

    <div v-if="pending && !items.length" class="queue-loading">
      <div v-for="index in 3" :key="index" class="skeleton" />
    </div>
    <div v-else-if="!items.length" class="state-panel">
      <p>No measurements need prioritization.</p>
    </div>
    <ol v-else class="queue-list">
      <li v-for="(item, index) in items" :key="item.measurementId">
        <button
          type="button"
          :class="{ 'queue-item--selected': selectedId === item.measurementId }"
          :aria-pressed="selectedId === item.measurementId"
          @click="emit('select', item.measurementId)"
        >
          <span class="queue-rank">0{{ index + 1 }}</span>
          <span class="queue-detail">
            <strong>{{ item.label }}</strong>
            <span v-if="item.calibrationApplied">{{ Math.round(item.rawConfidence * 100) }}% raw → {{ Math.round(item.confidence * 100) }}% calibrated</span>
            <span v-else>{{ Math.round(item.confidence * 100) }}% confidence</span>
          </span>
          <span class="queue-impact">{{ item.impactPercent.toFixed(1) }}%<small>impact</small></span>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.queue {
  padding: 20px;
}

.queue-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.queue-heading h2 {
  margin: 5px 0 0;
  font-size: 0.97rem;
  font-weight: 680;
  letter-spacing: -0.02em;
}

.queue-heading > span {
  color: var(--color-faint);
  font-size: 0.6rem;
  white-space: nowrap;
}

.queue-list {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.queue-list li + li {
  border-top: 1px solid var(--color-border);
}

.queue-item--selected {
  background: var(--color-accent-soft) !important;
}

.queue-list button {
  display: grid;
  width: 100%;
  min-height: 58px;
  grid-template-columns: 27px 1fr auto;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 8px;
  padding: 9px 7px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.queue-list button:hover {
  background: var(--color-canvas);
}

.queue-rank {
  color: var(--color-faint);
  font-size: 0.65rem;
  font-weight: 680;
  font-variant-numeric: tabular-nums;
}

.queue-detail {
  min-width: 0;
}

.queue-detail strong,
.queue-detail span {
  display: block;
}

.queue-detail strong {
  overflow: hidden;
  font-size: 0.76rem;
  font-weight: 670;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-detail span {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 0.63rem;
}

.queue-impact {
  color: var(--color-ink);
  font-size: 0.74rem;
  font-weight: 690;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.queue-impact small {
  display: block;
  color: var(--color-faint);
  font-size: 0.55rem;
  font-weight: 560;
}

.queue-loading {
  display: grid;
  gap: 9px;
  margin-top: 16px;
}

.queue-loading .skeleton {
  height: 50px;
}

.state-panel {
  min-height: 120px;
  margin-top: 16px;
}
</style>
