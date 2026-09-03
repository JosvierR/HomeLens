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
  contrast: number
  shadowClipping: number
  highlightClipping: number
}

interface DrawableImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

const MAX_EDGE = 1920
const CAMERA_START_TIMEOUT = 6000

const errorName = (error: unknown) => error instanceof DOMException
  ? error.name
  : error instanceof Error
    ? error.name
    : ''

const mapPermissionError = (error: unknown): { state: CameraLifecycleState, message: string } => {
  const name = errorName(error)
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return { state: 'denied', message: 'Camera access is blocked. Allow it in the browser settings and try again.' }
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return { state: 'unavailable', message: 'No camera was found on this device.' }
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return { state: 'error', message: 'The camera is being used by another app or could not start. Close other camera apps and try again.' }
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return { state: 'error', message: 'This camera does not support the requested mode.' }
  }
  return { state: 'unavailable', message: 'Camera access is unavailable right now.' }
}

const waitForVideo = async (video: HTMLVideoElement) => {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) return
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Camera preview timed out.'))
    }, CAMERA_START_TIMEOUT)
    const onReady = () => {
      if (!video.videoWidth) return
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Camera preview could not be displayed.'))
    }
    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadedmetadata', onReady)
    video.addEventListener('canplay', onReady)
    video.addEventListener('error', onError)
  })
}

const sampleQuality = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const step = Math.max(4, Math.floor(Math.min(width, height) / 80))
  let sum = 0
  let sumSquares = 0
  let count = 0
  let gradient = 0
  let shadowCount = 0
  let highlightCount = 0
  const data = ctx.getImageData(0, 0, width, height).data
  const lumaAt = (x: number, y: number) => {
    const index = (y * width + x) * 4
    return (0.2126 * data[index]!) + (0.7152 * data[index + 1]!) + (0.0722 * data[index + 2]!)
  }

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const luma = lumaAt(x, y)
      sum += luma
      sumSquares += luma * luma
      gradient += (Math.abs(luma - lumaAt(x - step, y)) + Math.abs(luma - lumaAt(x, y - step))) / 2
      if (luma < 18) shadowCount += 1
      if (luma > 240) highlightCount += 1
      count += 1
    }
  }
  const brightness = count ? sum / count : 0
  return {
    brightness,
    sharpness: count ? gradient / count : 0,
    contrast: count ? Math.sqrt(Math.max(0, (sumSquares / count) - (brightness * brightness))) : 0,
    shadowClipping: count ? shadowCount / count : 0,
    highlightClipping: count ? highlightCount / count : 0
  }
}

const loadDrawableImage = async (blob: Blob): Promise<DrawableImage> => {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close()
      }
    } catch {
      // Older iOS versions can decode an image through <img> but not ImageBitmap.
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The selected photo could not be read.'))
      element.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url)
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

export const useCamera = () => {
  const state = ref<CameraLifecycleState>('idle')
  const stream = shallowRef<MediaStream | null>(null)
  const devices = ref<MediaDeviceInfo[]>([])
  const currentDeviceId = ref<string | null>(null)
  const facingMode = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)
  const previewReady = ref(false)
  const videoEl = ref<HTMLVideoElement | null>(null)
  let requestSequence = 0

  const stopTracks = () => {
    stream.value?.getTracks().forEach(track => track.stop())
    stream.value = null
    previewReady.value = false
    if (videoEl.value) videoEl.value.srcObject = null
  }

  const enumerate = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      devices.value = list.filter(item => item.kind === 'videoinput')
    } catch {
      devices.value = []
    }
  }

  const bindVideo = async (element: HTMLVideoElement | null) => {
    videoEl.value = element
    const media = stream.value
    if (!element || !media) return false
    previewReady.value = false
    element.muted = true
    element.playsInline = true
    if (element.srcObject !== media) element.srcObject = media
    try {
      await element.play()
      await waitForVideo(element)
      previewReady.value = element.videoWidth > 0 && element.videoHeight > 0
      return previewReady.value
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Camera preview could not start.'
      return false
    }
  }

  const findRearDevice = () => devices.value.find(device =>
    /back|rear|environment|trasera|traseira|arri[eè]re|r[uü]ck/i.test(device.label)
  )

  const startCamera = async (deviceId?: string, allowRearUpgrade = true) => {
    if (!import.meta.client) return
    const requestId = ++requestSequence
    errorMessage.value = null
    previewReady.value = false
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      state.value = 'unavailable'
      errorMessage.value = 'Camera access needs a secure HTTPS connection.'
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      state.value = 'unavailable'
      errorMessage.value = 'This browser cannot provide a live camera preview.'
      return
    }

    state.value = 'requesting_permission'
    stopTracks()
    const candidates: MediaStreamConstraints[] = deviceId
      ? [
          { audio: false, video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
          { audio: false, video: { facingMode: { ideal: 'environment' } } },
          { audio: false, video: true }
        ]
      : [
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          },
          { audio: false, video: { facingMode: { ideal: 'environment' } } },
          { audio: false, video: true }
        ]

    let lastError: unknown
    for (let index = 0; index < candidates.length; index += 1) {
      try {
        const media = await navigator.mediaDevices.getUserMedia(candidates[index]!)
        if (requestId !== requestSequence) {
          media.getTracks().forEach(track => track.stop())
          return
        }
        const track = media.getVideoTracks()[0]
        if (!track) throw new DOMException('No video track was returned.', 'NotFoundError')
        track.addEventListener('ended', () => {
          if (stream.value !== media) return
          stopTracks()
          state.value = 'error'
          errorMessage.value = 'The camera stopped. Tap Try again to reopen it.'
        }, { once: true })
        stream.value = media
        const settings = track.getSettings()
        currentDeviceId.value = settings.deviceId ?? deviceId ?? null
        facingMode.value = settings.facingMode ?? null
        state.value = 'active'
        await enumerate()

        const rearDevice = !deviceId && allowRearUpgrade ? findRearDevice() : undefined
        if (rearDevice?.deviceId && rearDevice.deviceId !== currentDeviceId.value && facingMode.value !== 'environment') {
          await startCamera(rearDevice.deviceId, false)
        } else if (videoEl.value) {
          await bindVideo(videoEl.value)
        }
        return
      } catch (error) {
        lastError = error
        const name = errorName(error)
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') break
        if (deviceId && index === 0) continue
        if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError') break
      }
    }

    if (requestId !== requestSequence) return
    stopTracks()
    const mapped = mapPermissionError(lastError)
    state.value = mapped.state
    errorMessage.value = mapped.message
  }

  const switchCamera = async () => {
    if (devices.value.length < 2) return
    const ids = devices.value.map(item => item.deviceId).filter(Boolean)
    const currentIndex = ids.indexOf(currentDeviceId.value ?? '')
    const next = ids[currentIndex < 0 ? 0 : (currentIndex + 1) % ids.length]
    if (next) await startCamera(next, false)
  }

  const normalizeDrawable = async (
    drawable: DrawableImage,
    targetType: string
  ): Promise<CapturedFrame> => {
    const scale = Math.min(1, MAX_EDGE / Math.max(drawable.width, drawable.height, 1))
    const width = Math.max(1, Math.round(drawable.width * scale))
    const height = Math.max(1, Math.round(drawable.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Could not prepare the captured frame.')
    ctx.drawImage(drawable.source, 0, 0, width, height)
    const quality = sampleQuality(ctx, width, height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    if (!blob) throw new Error('Could not encode the captured frame.')
    return {
      blob,
      width,
      height,
      capturedAt: new Date().toISOString(),
      targetType,
      ...quality
    }
  }

  const captureFrame = async (targetType: string): Promise<CapturedFrame | null> => {
    const video = videoEl.value
    const media = stream.value
    if (!video || !media || state.value !== 'active') {
      errorMessage.value = 'Wait for the live preview before capturing.'
      return null
    }
    state.value = 'capturing'
    let drawable: DrawableImage | null = null
    try {
      await waitForVideo(video)
      const track = media.getVideoTracks()[0]
      const ImageCaptureConstructor = (window as unknown as {
        ImageCapture?: new (mediaTrack: MediaStreamTrack) => { takePhoto: () => Promise<Blob> }
      }).ImageCapture
      if (ImageCaptureConstructor && track) {
        try {
          const photo = await new ImageCaptureConstructor(track).takePhoto()
          drawable = await loadDrawableImage(photo)
        } catch {
          drawable = null
        }
      }

      if (!drawable) {
        drawable = {
          source: video,
          width: video.videoWidth,
          height: video.videoHeight,
          release: () => undefined
        }
      }
      const result = await normalizeDrawable(drawable, targetType)
      state.value = 'active'
      errorMessage.value = null
      return result
    } catch (error) {
      state.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'Frame capture failed.'
      return null
    } finally {
      drawable?.release()
    }
  }

  const captureImageFile = async (file: File, targetType: string): Promise<CapturedFrame | null> => {
    errorMessage.value = null
    state.value = 'capturing'
    let drawable: DrawableImage | null = null
    try {
      if (!file.type.startsWith('image/')) throw new Error('Choose an image captured by the phone camera.')
      drawable = await loadDrawableImage(file)
      const result = await normalizeDrawable(drawable, targetType)
      state.value = stream.value ? 'active' : 'stopped'
      return result
    } catch (error) {
      state.value = stream.value ? 'active' : 'error'
      errorMessage.value = error instanceof Error ? error.message : 'The selected photo could not be processed.'
      return null
    } finally {
      drawable?.release()
    }
  }

  const stopCamera = () => {
    requestSequence += 1
    stopTracks()
    state.value = 'stopped'
  }

  onBeforeUnmount(stopCamera)

  return {
    state,
    stream,
    devices,
    currentDeviceId,
    facingMode,
    errorMessage,
    previewReady,
    videoEl,
    bindVideo,
    startCamera,
    switchCamera,
    captureFrame,
    captureImageFile,
    stopCamera,
    enumerate
  }
}
