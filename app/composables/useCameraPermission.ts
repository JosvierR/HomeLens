export type CameraPermissionState =
  | 'not_requested'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'no_camera'
  | 'insecure_context'

export const useCameraPermission = () => {
  const state = ref<CameraPermissionState>('not_requested')
  const stream = ref<MediaStream | null>(null)
  const errorMessage = ref<string | null>(null)

  const stopStream = () => {
    stream.value?.getTracks().forEach(track => track.stop())
    stream.value = null
  }

  const requestCamera = async () => {
    if (!import.meta.client) return
    errorMessage.value = null

    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      state.value = 'insecure_context'
      errorMessage.value = 'Camera access needs a secure connection.'
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      state.value = 'unavailable'
      errorMessage.value = 'This browser cannot access a camera.'
      return
    }

    state.value = 'requesting'
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      })
      stopStream()
      stream.value = media
      state.value = 'granted'
    } catch (error) {
      stopStream()
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        state.value = 'denied'
        errorMessage.value = 'Camera access is blocked.'
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        state.value = 'no_camera'
        errorMessage.value = 'No camera was found on this device.'
      } else {
        state.value = 'unavailable'
        errorMessage.value = 'Camera access is unavailable right now.'
      }
    }
  }

  const useDemoInstead = () => {
    stopStream()
    state.value = 'not_requested'
    errorMessage.value = null
  }

  onBeforeUnmount(() => stopStream())

  return {
    state,
    stream,
    errorMessage,
    requestCamera,
    useDemoInstead,
    stopStream
  }
}
