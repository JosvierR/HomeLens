import type { CapturedFrame } from '~/composables/useCamera'

export interface ScanGalleryView {
  captureId: string
  targetType: string
  label: string
  dataUrl: string
  capturedAt: string
}

const THUMBNAIL_EDGE = 640
const THUMBNAIL_QUALITY = 0.72

const TARGET_LABELS: Record<string, string> = {
  room_overview: 'Room overview',
  opposite_corner: 'Opposite corner',
  ceiling_edge: 'Floor and ceiling edge',
  ceiling_corner: 'Ceiling corner',
  far_wall: 'Far wall'
}

export const captureTargetLabel = (targetType: string) =>
  TARGET_LABELS[targetType] ?? targetType.replaceAll('_', ' ')

/**
 * Keeps a lightweight copy of the accepted views so the summary can show what the
 * estimate was actually built from. Thumbnails stay in memory for this session only;
 * the full-resolution originals live in private storage.
 */
export const useScanGallery = () => {
  const views = useState<ScanGalleryView[]>('scan-gallery', () => [])

  const toThumbnail = async (blob: Blob) => {
    const bitmap = await createImageBitmap(blob)
    try {
      const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(bitmap.width, bitmap.height, 1))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) return null
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY)
    } finally {
      bitmap.close()
    }
  }

  const recordView = async (frame: CapturedFrame) => {
    if (!import.meta.client) return
    try {
      const dataUrl = await toThumbnail(frame.blob)
      if (!dataUrl) return
      const next: ScanGalleryView = {
        captureId: frame.captureId,
        targetType: frame.targetType,
        label: captureTargetLabel(frame.targetType),
        dataUrl,
        capturedAt: frame.capturedAt
      }
      const existing = views.value.findIndex(view => view.targetType === frame.targetType)
      views.value = existing >= 0
        ? views.value.map((view, index) => index === existing ? next : view)
        : [...views.value, next]
    } catch {
      // A missing thumbnail only affects the summary strip, never the estimate.
    }
  }

  const clear = () => { views.value = [] }

  return { views, recordView, clear }
}
