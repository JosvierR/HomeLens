<script setup lang="ts">
import type { DecisionConfidenceResult, RecommendationBand } from '../../shared/decision-confidence'

const props = defineProps<{
  result: DecisionConfidenceResult | null
  pending?: boolean
}>()

const bandLabel: Record<RecommendationBand, string> = {
  compact: 'Compact planning band',
  standard: 'Standard planning band',
  'high-capacity': 'High-capacity planning band'
}

const stabilityPercent = computed(() => Math.round((props.result?.bandStability ?? 0) * 100))

const tone = computed(() => {
  if (!props.result) return 'neutral'
  if (props.result.stabilityLabel === 'stable') return 'success'
  if (props.result.stabilityLabel === 'watch') return 'warning'
  return 'error'
})
</script>

<template>
  <div class="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
    <div class="flex items-start justify-between gap-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Decision confidence</p>
        <h3 class="mt-2 text-xl font-semibold tracking-tight">Will uncertainty change the recommendation?</h3>
      </div>
      <UBadge :color="tone" variant="subtle">
        {{ pending ? 'Recomputing…' : result ? `${stabilityPercent}% stable` : 'Loading' }}
      </UBadge>
    </div>

    <template v-if="result">
      <div class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl bg-neutral-50 p-4"><p class="text-xs font-medium text-neutral-500">Expected band</p><p class="mt-2 font-semibold">{{ bandLabel[result.expectedBand] }}</p></div>
        <div class="rounded-2xl bg-neutral-50 p-4"><p class="text-xs font-medium text-neutral-500">Planning index</p><p class="mt-2 text-2xl font-semibold">{{ result.baselineIndex }}</p></div>
        <div class="rounded-2xl bg-neutral-50 p-4"><p class="text-xs font-medium text-neutral-500">90% likely range</p><p class="mt-2 text-2xl font-semibold">{{ result.likelyRange.low }}–{{ result.likelyRange.high }}</p></div>
      </div>

      <div class="mt-5 rounded-2xl border border-neutral-200 p-4">
        <div class="flex items-center justify-between gap-4"><p class="text-sm font-medium">Recommendation distribution</p><p class="text-xs text-neutral-500">600 deterministic scenarios</p></div>
        <div class="mt-4 space-y-3">
          <div v-for="band in (['compact', 'standard', 'high-capacity'] as RecommendationBand[])" :key="band">
            <div class="mb-1 flex justify-between text-xs text-neutral-500"><span>{{ bandLabel[band] }}</span><span>{{ Math.round(result.bandDistribution[band] * 100) }}%</span></div>
            <div class="h-2 overflow-hidden rounded-full bg-neutral-100"><div class="h-full rounded-full bg-neutral-900" :style="{ width: `${result.bandDistribution[band] * 100}%` }" /></div>
          </div>
        </div>
      </div>

      <div class="mt-5 rounded-2xl bg-neutral-950 p-4 text-white"><p class="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">Next best verification</p><p class="mt-2 text-sm leading-6">{{ result.summary }}</p></div>
    </template>
  </div>
</template>
