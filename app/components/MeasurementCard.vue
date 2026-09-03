<script setup lang="ts">
import type { Measurement } from '~/types/scan'

const props = defineProps<{ measurement: Measurement }>()
const emit = defineEmits<{ save: [id: string, value: number] }>()
const editing = ref(false)
const draftValue = ref(props.measurement.value)
watch(() => props.measurement.value, value => { draftValue.value = value })
const save = () => { emit('save', props.measurement.id, Number(draftValue.value)); editing.value = false }
</script>

<template>
  <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-neutral-500">{{ measurement.label }}</p>
        <div v-if="!editing" class="mt-1 flex items-end gap-1"><span class="text-3xl font-semibold tracking-tight">{{ measurement.value }}</span><span class="mb-1 text-sm text-neutral-500">{{ measurement.unit }}</span></div>
        <div v-else class="mt-3 flex items-center gap-2"><UInput v-model="draftValue" type="number" step="0.1" class="w-32" /><span class="text-sm text-neutral-500">{{ measurement.unit }}</span></div>
      </div>
      <UButton v-if="!editing" color="neutral" variant="ghost" size="sm" @click="editing = true">Edit</UButton>
    </div>
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><ConfidenceBadge :confidence="measurement.confidence" /><span v-if="measurement.source === 'manual'" class="text-xs text-neutral-500">Manually verified</span></div>
    <div v-if="editing" class="mt-4 flex gap-2"><UButton size="sm" @click="save">Save measurement</UButton><UButton color="neutral" variant="ghost" size="sm" @click="editing = false">Cancel</UButton></div>
  </div>
</template>
