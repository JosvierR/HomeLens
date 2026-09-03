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
  <section class="queue" aria-labelledby="queue-title" :aria-busy="pending">
    <h2 id="queue-title" class="section-label">Verification queue</h2>
    <p class="queue-note">Ranked by how much each input can move the planning band.</p>

    <div v-if="pending && !items.length" class="queue-loading">
      <div v-for="index in 3" :key="index" class="skeleton" />
    </div>
    <p v-else-if="!items.length" class="queue-empty">Every measurement is verified.</p>
    <ol v-else class="queue-list">
      <li v-for="(item, index) in items" :key="item.measurementId">
        <button
          type="button"
          :class="{ 'queue-item--selected': selectedId === item.measurementId }"
          :aria-pressed="selectedId === item.measurementId"
          @click="emit('select', item.measurementId)"
        >
          <span class="queue-rank numeric">{{ index + 1 }}</span>
          <span class="queue-label">{{ item.label }}</span>
          <span class="queue-impact numeric">{{ item.impactPercent.toFixed(1) }}%</span>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.queue-note {
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 0.77rem;
  line-height: 1.45;
}

.queue-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.queue-list button {
  display: grid;
  width: 100%;
  min-height: 34px;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 8px;
  border: 0;
  border-radius: var(--radius-control);
  padding: 6px 6px 6px 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: color 140ms ease;
}

.queue-list button:hover { color: var(--accent); }

.queue-item--selected {
  padding-left: 8px !important;
  box-shadow: inset 2px 0 0 var(--accent);
}

.queue-rank {
  color: var(--text-tertiary);
  font-size: 0.76rem;
}

.queue-label {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 0.84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-impact {
  color: var(--text-secondary);
  font-size: 0.81rem;
  font-weight: 560;
}

.queue-empty {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 0.81rem;
}

.queue-loading {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.queue-loading .skeleton { height: 30px; }
</style>
