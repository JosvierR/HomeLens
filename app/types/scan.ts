export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface Measurement {
  id: string
  label: string
  value: number
  unit: 'ft'
  confidence: number
  source: 'estimated' | 'manual'
}

export interface RoomScan {
  id: string
  roomName: string
  createdAt: string
  measurements: Measurement[]
  windows: number
  doors: number
}
