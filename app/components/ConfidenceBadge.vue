<script setup lang="ts">
const props = defineProps<{
  confidence: number
}>()

const state = computed(() => {
  if (props.confidence >= 0.9) return { label: 'High', tone: 'high', symbol: '●' }
  if (props.confidence >= 0.75) return { label: 'Moderate', tone: 'medium', symbol: '◆' }
  return { label: 'Review', tone: 'low', symbol: '▲' }
})

const percent = computed(() => Math.round(props.confidence * 100))
</script>

<template>
  <span
    class="confidence"
    :class="`confidence--${state.tone}`"
    :aria-label="`${state.label} confidence, ${percent} percent`"
  >
    <span class="confidence-symbol" aria-hidden="true">{{ state.symbol }}</span>
    <span>{{ state.label }}</span>
    <span class="confidence-divider" aria-hidden="true">·</span>
    <span class="confidence-number">{{ percent }}%</span>
  </span>
</template>

<style scoped>
.confidence {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 3px 9px 3px 7px;
  font-size: 0.73rem;
  font-weight: 670;
  line-height: 1;
  white-space: nowrap;
}

.confidence--high {
  border-color: #cbe1d3;
  background: var(--color-high-soft);
  color: var(--color-high);
}

.confidence--medium {
  border-color: #ead6ad;
  background: var(--color-review-soft);
  color: var(--color-review);
}

.confidence--low {
  border-color: #ebc9bd;
  background: var(--color-low-soft);
  color: var(--color-low);
}

.confidence-symbol {
  font-size: 0.62rem;
  line-height: 1;
}

.confidence-divider {
  opacity: 0.52;
}

.confidence-number {
  font-variant-numeric: tabular-nums;
}
</style>
