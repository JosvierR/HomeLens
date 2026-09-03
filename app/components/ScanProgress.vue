<script setup lang="ts">
withDefaults(defineProps<{
  current: number
  labels?: string[]
}>(), {
  labels: () => ['Capture geometry', 'Review uncertainty', 'Analyze']
})
</script>

<template>
  <ol class="scan-progress" :aria-label="`Scan step ${current} of ${labels.length}`">
    <li v-for="(label, index) in labels" :key="label" :class="{ 'is-current': current === index + 1, 'is-complete': current > index + 1 }">
      <span class="step-node"><span>{{ current > index + 1 ? '✓' : index + 1 }}</span></span>
      <span class="step-label">{{ label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.scan-progress {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}

.scan-progress li {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: #77837f;
}

.scan-progress li:not(:last-child)::after {
  position: absolute;
  z-index: 0;
  top: 14px;
  left: 30px;
  width: calc(100% - 30px);
  border-top: 1px solid #35413e;
  content: "";
}

.step-node {
  position: relative;
  z-index: 1;
  display: grid;
  width: 29px;
  height: 29px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #43504d;
  border-radius: 50%;
  background: #17201f;
}

.step-node span {
  font-size: 0.65rem;
  font-weight: 690;
}

.step-label {
  overflow: hidden;
  font-size: 0.7rem;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-current {
  color: #f1f6f4 !important;
}

.is-current .step-node {
  border-color: #8ec7bd;
  box-shadow: 0 0 0 4px rgb(142 199 189 / 10%);
  color: #a9d8cf;
}

.is-complete {
  color: #9fb1ac !important;
}

.is-complete .step-node {
  border-color: #4d8077;
  background: #254941;
  color: #d9eee9;
}

@media (max-width: 580px) {
  .scan-progress li {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .scan-progress li:not(:last-child)::after {
    width: calc(100% - 22px);
  }

  .step-label {
    width: calc(100% - 6px);
    white-space: normal;
  }
}
</style>
