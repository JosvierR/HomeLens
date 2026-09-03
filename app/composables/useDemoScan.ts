import type { RoomScan } from '~/types/scan'
import type { ManualVerificationResponse } from '~~/shared/verification'
import { SYNTHETIC_DEMO_CAPTURE_METHOD, createUncertainFitDemoScan } from '~~/shared/demo-fixtures'

/** The reference synthetic room: settled planning band, undecided sectional, width decides it. */
const createDemoScan = (): RoomScan => createUncertainFitDemoScan()

export const useDemoScan = () => {
  const scan = useState<RoomScan>('demo-scan', createDemoScan)
  const isDemo = computed(() => scan.value.captureMethod === SYNTHETIC_DEMO_CAPTURE_METHOD)
  const verificationPending = useState<boolean>('demo-verification-pending', () => false)
  const verificationError = useState<string | null>('demo-verification-error', () => null)
  const lastEvidenceId = useState<string | null>('demo-last-evidence-id', () => null)
  let controller: AbortController | undefined

  const verifyMeasurement = async (id: string, value: number) => {
    if (verificationPending.value) return null
    verificationPending.value = true
    verificationError.value = null
    controller = new AbortController()
    try {
      const measurement = scan.value.measurements.find(item => item.id === id)
      const response = measurement?.persistenceId
        ? await $fetch<ManualVerificationResponse>(`/api/measurements/${measurement.persistenceId}/verify`, {
            method: 'POST',
            body: {
              scanId: scan.value.id,
              measurementId: measurement.persistenceId,
              verifiedValue: value,
              expectedRevision: measurement.revision,
              idempotencyKey: crypto.randomUUID()
            },
            signal: controller.signal
          })
        : await $fetch<ManualVerificationResponse>('/api/measurements/verify', {
            method: 'POST',
            body: { scan: scan.value, measurementId: id, verifiedValue: value },
            signal: controller.signal
          })
      scan.value = response.scan
      lastEvidenceId.value = response.evidence.id
      return response
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        verificationError.value = error instanceof Error ? error.message : 'Verification could not be saved.'
      }
      throw error
    } finally {
      verificationPending.value = false
      controller = undefined
    }
  }

  const resetScan = () => {
    controller?.abort()
    scan.value = createDemoScan()
    verificationPending.value = false
    verificationError.value = null
    lastEvidenceId.value = null
  }

  const replaceScan = (nextScan: RoomScan) => {
    controller?.abort()
    scan.value = structuredClone(nextScan)
    verificationPending.value = false
    verificationError.value = null
    lastEvidenceId.value = null
  }

  onBeforeUnmount(() => controller?.abort())
  return {
    scan,
    isDemo,
    replaceScan,
    verifyMeasurement,
    resetScan,
    verificationPending,
    verificationError,
    lastEvidenceId
  }
}
