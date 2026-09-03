import type { RoomScan } from '~/types/scan'
import type { RescueAction } from '../../shared/scan-rescue'

export const useScanRescue = (scan: Ref<RoomScan>) => {
  const action = ref<RescueAction | null>(null)
  const pending = ref(false)
  const refresh = async () => {
    pending.value = true
    try { action.value = await $fetch<RescueAction>('/api/scan-rescue', { method: 'POST', body: scan.value }) }
    finally { pending.value = false }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(scan, () => { clearTimeout(timer); timer = setTimeout(refresh, 140) }, { deep: true, immediate: true })
  onBeforeUnmount(() => clearTimeout(timer))
  return { action, pending, refresh }
}
