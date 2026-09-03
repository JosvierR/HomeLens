<script setup lang="ts">
defineProps<{
  rawConfidence: number
  calibratedConfidence: number | null
  applied: boolean
  sampleCount: number
  updatedLabel?: string
  explanation?: string
}>()
</script>

<template>
  <section class="learning-insight" aria-labelledby="learning-title">
    <h2 id="learning-title" class="section-label">How sure is the system?</h2>
    <dl>
      <div>
        <dt>Model confidence</dt>
        <dd class="numeric">{{ Math.round(rawConfidence * 100) }}%</dd>
      </div>
      <div>
        <dt>Historically adjusted</dt>
        <dd class="numeric">
          <template v-if="applied && calibratedConfidence != null">{{ Math.round(calibratedConfidence * 100) }}%</template>
          <template v-else>Not enough comparable history yet</template>
        </dd>
      </div>
      <div>
        <dt>Based on</dt>
        <dd>{{ sampleCount }} comparable verified measurements</dd>
      </div>
      <div v-if="updatedLabel">
        <dt>Updated</dt>
        <dd>{{ updatedLabel }}</dd>
      </div>
    </dl>
    <details v-if="explanation">
      <summary>Why was confidence adjusted?</summary>
      <p>{{ explanation }}</p>
    </details>
  </section>
</template>

<style scoped>
.learning-insight {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
dl {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;
}
div {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  font-size: 0.9rem;
}
dt { color: var(--text-secondary); }
dd { margin: 0; text-align: right; }
details {
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 0.88rem;
}
summary { cursor: pointer; color: var(--text-primary); }
</style>
