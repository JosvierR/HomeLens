export type CameraLifecycleState =
  | 'idle'
  | 'requesting_permission'
  | 'active'
  | 'capturing'
  | 'processing'
  | 'error'
  | 'denied'
  | 'unavailable'
  | 'stopped'

export interface CapturedFrame {
  blob: Blob
  width: number
  height: number
  capturedAt: string
  targetType: string
  brightness: number
  sharpness: number
}

const MAX_EDGE = 1920

const mapPermissionError = (error: unknown): { state: CameraLifecycleState, message: string } => {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return { state: 'denied', message: 'Camera access is blocked.' }
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return { state: 'unavailable', message: 'No camera was found on this device.' }
  }
  return { state: 'unavailable', message: 'Camera access is unavailable right now.' }
}

const sampleQuality = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const step = Math.max(4, Math.floor(Math.min(width, height) / 64))
  let sum = 0
  let count = 0
  let lap = 0
  const data = ctx.getImageData(0, 0, width, height).data
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const i = (y * width + x) * 4
      const luma = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!
      const left = 0.2126 * data[i - 4]! + 0.7152 * data[i - 3]! + 0.0722 * data[i - 2]!
      sum += luma
      lap += Math.abs(luma - left)
      count += 1
    }
  }
  return {
    brightness: count ? sum / count : 0,
    sharpness: count ? lap / count : 0
  }
}

export const useCamera = () => {
  const state = ref<CameraLifecycleState>('idle')
  const stream = ref<MediaStream | null>(null)
  const devices = ref<MediaDeviceInfo[]>([])
  const currentDeviceId = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)
  const videoEl = ref<HTMLVideoElement | null>(null)

  const stopTracks = () => {
    stream.value?.getTracks().forEach(track => track.stop())
    stream.value = null
  }

  const enumerate = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const list = await navigator.mediaDevices.enumerateDevices()
    devices.value = list.filter(item => item.kind === 'videoinput')
  }

  const bindVideo = async (el: HTMLVideoElement | null) => {
    videoEl.value = el
    if (!el || !stream.value) return
    el.srcObject = stream.value
    await el.play().catch(() => undefined)
  }

  const startCamera = async (deviceId?: string) => {
    if (!import.meta.client) return
    errorMessage.value = null
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      state.value = 'unavailable'
      errorMessage.value = 'Camera access needs a secure connection.'
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      state.value = 'unavailable'
      errorMessage.value = 'This browser cannot access a camera.'
      return
    }

    state.value = 'requesting_permission'
    try {
      stopTracks()
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } }
      }
      const media = await navigator.mediaDevices.getUserMedia(constraints)
      stream.value = media
      currentDeviceId.value = media.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? null
      state.value = 'active'
      await enumerate()
      if (videoEl.value) await bindVideo(videoEl.value)
    } catch (error) {
      stopTracks()
      const mapped = mapPermissionError(error)
      state.value = mapped.state
      errorMessage.value = mapped.message
    }
  }

  const switchCamera = async () => {
    if (devices.value.length < 2) return
    const ids = devices.value.map(item => item.deviceId)
    const idx = Math.max(0, ids.indexOf(currentDeviceId.value ?? ''))
    const next = ids[(idx + 1) % ids.length]
    if (next) await startCamera(next)
  }

  const captureFrame = async (targetType: string): Promise<CapturedFrame | null> => {
    const video = videoEl.value
    if (!video || !stream.value || state.value !== 'active') return null
    state.value = 'capturing'
    try {
      let blob: Blob | null = null
      let width = video.videoWidth
      let height = video.videoHeight
      const track = stream.value.getVideoTracks()[0]
      const ImageCaptureCtor = (window as unknown as { ImageCapture?: new (track: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture
      if (ImageCaptureCtor && track) {
        try {
          blob = await new ImageCaptureCtor(track).takePhoto()
        } catch {
          blob = null
        }
      }

      const canvas = document.createElement('canvas')
      const scale = Math.min(1, MAX_EDGE / Math.max(width, height || 1))
      const outW = Math.max(1, Math.round(width * scale))
      const outH = Math.max(1, Math.round(height * scale))
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        state.value = 'error'
        errorMessage.value = 'Could not capture frame.'
        return null
      }

      if (blob) {
        const bitmap = await createImageBitmap(blob)
        width = bitmap.width
        height = bitmap.height
        const s = Math.min(1, MAX_EDGE / Math.max(width, height))
        canvas.width = Math.max(1, Math.round(width * s))
        canvas.height = Math.max(1, Math.round(height * s))
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
      } else {
        ctx.drawImage(video, 0, 0, outW, outH)
      }

      const quality = sampleQuality(ctx, canvas.width, canvas.height)
      const normalized = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.82)
      })
      if (!normalized) {
        state.value = 'error'
        errorMessage.value = 'Could not encode frame.'
        return null
      }

      state.value = 'active'
      return {
        blob: normalized,
        width: canvas.width,
        height: canvas.height,
        capturedAt: new Date().toISOString(),
        targetType,
        brightness: quality.brightness,
        sharpness: quality.sharpness
      }
    } catch {
      state.value = 'error'
      errorMessage.value = 'Frame capture failed.'
      return null
    }
  }

  const stopCamera = () => {
    stopTracks()
    state.value = 'stopped'
  }

  onBeforeUnmount(() => stopCamera())

  return {
    state,
    stream,
    devices,
    currentDeviceId,
    errorMessage,
    videoEl,
    bindVideo,
    startCamera,
    switchCamera,
    captureFrame,
    stopCamera,
    enumerate
  }
}
