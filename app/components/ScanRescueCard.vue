<script setup lang="ts">
import type { RescueAction } from '../../shared/scan-rescue'
const props = defineProps<{ action: RescueAction | null; pending?: boolean }>()
const currentPercent = computed(() => Math.round((props.action?.currentStability ?? 0) * 100))
const projectedPercent = computed(() => Math.round((props.action?.projectedStability ?? 0) * 100))
</script>

<template>
  <div class="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div><p class="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Scan Rescue</p><h3 class="mt-2 text-xl font-semibold tracking-tight">Ask for less. Learn what matters.</h3></div>
      <UBadge :color="action?.status === 'stable' ? 'success' : 'warning'" variant="subtle">{{ pending ? 'Evaluating…' : action?.status === 'stable' ? 'No action needed' : '1 action' }}</UBadge>
    </div>
    <div v-if="action" class="mt-5">
      <p class="text-sm leading-6 text-neutral-600">{{ action.reason }}</p>
      <div v-if="action.status === 'needs_verification'" class="mt-5 rounded-2xl bg-neutral-950 p-5 text-white">
        <p class="text-xs uppercase tracking-[0.14em] text-neutral-400">Next best action</p><p class="mt-2 text-lg font-semibold">Verify {{ action.label }}</p>
        <div class="mt-4 flex items-center gap-3 text-sm"><span class="text-neutral-400">Decision stability</span><span>{{ currentPercent }}%</span><span class="text-neutral-500">→</span><span class="font-semibold">{{ projectedPercent }}%</span></div>
      </div>
    </div>
  </div>
</template>
