<script setup lang="ts">
const { scan, updateMeasurement, resetScan } = useDemoScan()
const { result, pending, errorMessage } = useDecisionConfidence(scan)
const { action: rescueAction, pending: rescuePending } = useScanRescue(scan)
const floorArea = computed(() => { const width = scan.value.measurements.find(item => item.id === 'width')?.value ?? 0; const length = scan.value.measurements.find(item => item.id === 'length')?.value ?? 0; return Math.round(width * length) })
const needsVerification = computed(() => scan.value.measurements.filter(item => item.confidence < 0.75))
const prioritizedVerification = computed(() => result.value?.verificationQueue ?? [])
</script>

<template>
  <main class="min-h-screen bg-[#f7f7f5]">
    <header class="border-b border-neutral-200 bg-white"><div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><div><p class="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Room analysis</p><h1 class="mt-1 text-xl font-semibold">{{ scan.roomName }}</h1></div><div class="flex gap-2"><UButton color="neutral" variant="ghost" @click="resetScan">Reset</UButton><UButton to="/">Done</UButton></div></div></header>
    <div class="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1fr_340px]">
      <section>
        <div class="mb-5 flex items-end justify-between gap-5"><div><h2 class="text-2xl font-semibold tracking-tight">Measurements</h2><p class="mt-1 max-w-xl text-sm text-neutral-500">Edit any estimate. Human-verified values keep explicit provenance and immediately recompute downstream decision stability.</p></div><UBadge :color="needsVerification.length ? 'warning' : 'success'" variant="subtle">{{ needsVerification.length }} low-confidence inputs</UBadge></div>
        <div class="grid gap-4 md:grid-cols-2"><MeasurementCard v-for="measurement in scan.measurements" :key="measurement.id" :measurement="measurement" @save="updateMeasurement" /></div>
        <div class="mt-8 space-y-5"><DecisionStabilityPanel :result="result" :pending="pending" /><ScanRescueCard :action="rescueAction" :pending="rescuePending" /></div>
        <div v-if="errorMessage" class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Decision analysis failed: {{ errorMessage }}</div>
        <div class="mt-8 rounded-3xl border border-neutral-200 bg-white p-6">
          <div class="flex items-start justify-between gap-6"><div><p class="text-sm font-medium text-neutral-500">Physical context</p><h3 class="mt-1 text-xl font-semibold">Inspectable inputs, not hidden assumptions.</h3></div><UBadge color="neutral" variant="subtle">Human in the loop</UBadge></div>
          <div class="mt-6 grid gap-3 md:grid-cols-3"><div class="rounded-2xl bg-neutral-50 p-4"><p class="text-sm text-neutral-500">Estimated floor area</p><p class="mt-2 text-2xl font-semibold">{{ floorArea }} ft²</p></div><div class="rounded-2xl bg-neutral-50 p-4"><p class="text-sm text-neutral-500">Windows detected</p><p class="mt-2 text-2xl font-semibold">{{ scan.windows }}</p></div><div class="rounded-2xl bg-neutral-50 p-4"><p class="text-sm text-neutral-500">Doors detected</p><p class="mt-2 text-2xl font-semibold">{{ scan.doors }}</p></div></div>
          <div class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">HomeLens deliberately uses a non-certified planning proxy in this demo. The product idea is the decision-confidence layer: identify which uncertain input is worth verifying before it can alter a downstream decision.</div>
        </div>
      </section>
      <aside class="space-y-4">
        <div class="rounded-3xl bg-neutral-950 p-6 text-white"><p class="text-sm font-medium text-neutral-400">Room model</p><div class="relative mt-5 aspect-square overflow-hidden rounded-2xl border border-white/10 bg-neutral-900"><div class="absolute inset-[18%] skew-y-[-6deg] border border-white/70" /><div class="absolute left-[25%] top-[29%] h-[42%] w-[52%] border border-dashed border-white/25" /><div class="absolute bottom-4 left-4 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black">{{ floorArea }} ft²</div></div></div>
        <div class="rounded-3xl border border-neutral-200 bg-white p-6"><div class="flex items-center justify-between gap-3"><p class="font-semibold">Verification priority</p><span class="text-xs text-neutral-400">impact × uncertainty</span></div><p class="mt-1 text-sm leading-6 text-neutral-500">Low confidence alone is not enough. HomeLens asks which correction is most likely to change a downstream decision.</p><div v-if="prioritizedVerification.length" class="mt-5 space-y-3"><div v-for="(item, index) in prioritizedVerification" :key="item.measurementId" class="rounded-xl border border-neutral-100 bg-neutral-50 p-3"><div class="flex items-center justify-between gap-3"><p class="text-sm font-medium">{{ index + 1 }}. {{ item.label }}</p><span class="text-xs font-medium text-neutral-500">{{ item.impactPercent.toFixed(1) }}% impact</span></div><p class="mt-1 text-xs leading-5 text-neutral-500">{{ item.reason }}</p></div></div></div>
      </aside>
    </div>
  </main>
</template>
