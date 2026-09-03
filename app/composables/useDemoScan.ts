import type { RoomScan } from '~/types/scan'

const demoScan: RoomScan = {
  id: 'scan_demo_001', roomName: 'Living Room', createdAt: new Date().toISOString(), windows: 3, doors: 2,
  measurements: [
    { id: 'width', label: 'Width', value: 14.2, unit: 'ft', confidence: 0.94, source: 'estimated' },
    { id: 'length', label: 'Length', value: 18.6, unit: 'ft', confidence: 0.88, source: 'estimated' },
    { id: 'height', label: 'Ceiling height', value: 9.1, unit: 'ft', confidence: 0.71, source: 'estimated' }
  ]
}

export const useDemoScan = () => {
  const scan = useState<RoomScan>('demo-scan', () => structuredClone(demoScan))
  const updateMeasurement = (id: string, value: number) => {
    const measurement = scan.value.measurements.find(item => item.id === id)
    if (!measurement || Number.isNaN(value) || value <= 0) return
    measurement.value = value; measurement.source = 'manual'; measurement.confidence = 1
  }
  const resetScan = () => { scan.value = structuredClone(demoScan) }
  return { scan, updateMeasurement, resetScan }
}
