const toHex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')

export const signInferencePayload = async (rawBody: string, secret: string) => {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))))
}

export const verifyInferenceSignature = async (rawBody: string, provided: string | undefined, secret: string) => {
  if (!provided || !secret || !/^[a-f0-9]{64}$/i.test(provided)) return false
  const expected = await signInferencePayload(rawBody, secret)
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ provided.toLowerCase().charCodeAt(index)
  }
  return mismatch === 0
}
