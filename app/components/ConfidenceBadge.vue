<script setup lang="ts">
const props = defineProps<{
  confidence: number
}>()

const label = computed(() => {
  if (props.confidence >= 0.9) return 'High confidence'
  if (props.confidence >= 0.75) return 'Medium confidence'
  return 'Verify manually'
})

const tone = computed(() => {
  if (props.confidence >= 0.9) return 'success'
  if (props.confidence >= 0.75) return 'warning'
  return 'error'
})
</script>

<template>
  <UBadge :color="tone" variant="subtle" size="sm">
    {{ label }} · {{ Math.round(confidence * 100) }}%
  </UBadge>
</template>
