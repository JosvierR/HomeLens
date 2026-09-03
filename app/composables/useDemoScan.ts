import type { RoomScan } from '~/types/scan'
import type { ManualVerificationResponse } from '~~/shared/verification'

const capturedAt = '2026-09-02T12:00:00.000Z'

const createDemoScan = (): RoomScan => ({
  id: 'scan_demo_001',
  roomId: 'room_demo_living',
  roomName: 'Living Room',
  createdAt: capturedAt,
  windows: 3,
  doors: 0,
  modelVersion: 'geometry-v1',
  captureMethod: 'simulated-geometry',
  deviceFamily: 'demo-phone',
  roomCategory: 'living-area',
  measurements: [
    {
      id: 'width', label: 'Width', value: 14.2, unit: 'ft', confidence: 0.94, rawConfidence: 0.94, source: 'estimated',
      originalEstimate: { value: 14.2, confidence: 0.94, capturedAt }
    },
    {
      id: 'length', label: 'Length', value: 18.6, unit: 'ft', confidence: 0.88, rawConfidence: 0.88, source: 'estimated',
      originalEstimate: { value: 18.6, confidence: 0.88, capturedAt }
    },
    {
      id: 'height', label: 'Ceiling height', value: 9.1, unit: 'ft', confidence: 0.71, rawConfidence: 0.71, source: 'estimated',
      originalEstimate: { value: 9.1, confidence: 0.71, capturedAt }
    }
  ]
})

export const useDemoScan = () => {
  const scan = useState<RoomScan>('demo-scan', createDemoScan)
  const isDemo = computed(() => scan.value.captureMethod === 'simulated-geometry')
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
      const response = await $fetch<ManualVerificationResponse>('/api/measurements/verify', {
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
