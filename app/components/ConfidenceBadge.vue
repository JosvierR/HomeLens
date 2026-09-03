<script setup lang="ts">
const props = withDefaults(defineProps<{
  confidence: number
  tone?: 'light' | 'dark'
}>(), { tone: 'light' })

const needsReview = computed(() => props.confidence < 0.75)
const percent = computed(() => Math.round(props.confidence * 100))
</script>

<template>
  <span class="confidence" :class="[`confidence--${tone}`, { 'confidence--review': needsReview }]">
    <span class="confidence-number numeric">{{ percent }}%</span>
    <span v-if="needsReview" class="confidence-state">
      <span class="confidence-mark" aria-hidden="true">▲</span>
      Needs review
    </span>
  </span>
</template>

<style scoped>
/* Confidence never relies on hue alone: the figure carries it, and the
   review state adds both a word and a shape. */
.confidence {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.confidence-number {
  color: var(--text-primary);
  font-size: 0.83rem;
  font-weight: 600;
}

.confidence--dark .confidence-number {
  color: var(--text-inverse);
}

.confidence-state {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  color: var(--warning);
  font-size: 0.74rem;
  font-weight: 560;
}

.confidence--dark .confidence-state {
  color: #d9ae63;
}

.confidence-mark {
  font-size: 0.58rem;
}
</style>
