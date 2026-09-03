import type { DecisionConfidenceResult } from '../../shared/decision-confidence'
import type { RoomScan } from '~/types/scan'

export const useDecisionConfidence = (scan: Ref<RoomScan>) => {
  const result = ref<DecisionConfidenceResult | null>(null)
  const pending = ref(false)
  const errorMessage = ref<string | null>(null)
  let requestId = 0

  const analyze = async () => {
    const currentRequest = ++requestId
    pending.value = true
    errorMessage.value = null
    try {
      const response = await $fetch<DecisionConfidenceResult>('/api/decision-confidence', { method: 'POST', body: scan.value })
      if (currentRequest === requestId) result.value = response
    } catch (error) {
      if (currentRequest === requestId) errorMessage.value = error instanceof Error ? error.message : 'Analysis failed'
    } finally {
      if (currentRequest === requestId) pending.value = false
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(scan, () => { clearTimeout(timer); timer = setTimeout(analyze, 120) }, { deep: true, immediate: true })
  onBeforeUnmount(() => clearTimeout(timer))
  return { result, pending, errorMessage, analyze }
}
