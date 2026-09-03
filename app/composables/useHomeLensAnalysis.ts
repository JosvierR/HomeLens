import type { HomeLensAnalysisResult } from '~~/shared/analysis'
import type { RoomScan } from '~/types/scan'

export const useHomeLensAnalysis = (scan: Ref<RoomScan>) => {
  const analysis = ref<HomeLensAnalysisResult | null>(null)
  const pending = ref(true)
  const errorMessage = ref<string | null>(null)
  const requestCount = ref(0)
  let requestId = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  const analyze = async () => {
    const currentRequest = ++requestId
    controller?.abort()
    controller = new AbortController()
    pending.value = true
    errorMessage.value = null
    requestCount.value += 1
    try {
      const response = await $fetch<HomeLensAnalysisResult>('/api/analysis', {
        method: 'POST',
        body: scan.value,
        signal: controller.signal
      })
      if (currentRequest === requestId) analysis.value = response
    } catch (error) {
      if (currentRequest === requestId && !(error instanceof Error && error.name === 'AbortError')) {
        errorMessage.value = error instanceof Error ? error.message : 'Analysis failed'
      }
    } finally {
      if (currentRequest === requestId) pending.value = false
    }
  }

  watch(scan, () => {
    clearTimeout(timer)
    timer = setTimeout(analyze, 120)
  }, { deep: true, immediate: true })

  onBeforeUnmount(() => {
    clearTimeout(timer)
    controller?.abort()
  })

  return { analysis, pending, errorMessage, requestCount, analyze }
}
