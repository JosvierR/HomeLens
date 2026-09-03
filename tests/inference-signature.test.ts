import { describe, expect, it } from 'vitest'
import { signInferencePayload, verifyInferenceSignature } from '../server/utils/inference-signature'

describe('inference callback signatures', () => {
  it('accepts a matching HMAC and rejects a mutated body', async () => {
    const secret = 'callback-secret-for-tests'
    const body = '{"jobId":"ok"}'
    const signature = await signInferencePayload(body, secret)
    expect(await verifyInferenceSignature(body, signature, secret)).toBe(true)
    expect(await verifyInferenceSignature('{"jobId":"tampered"}', signature, secret)).toBe(false)
    expect(await verifyInferenceSignature(body, '0'.repeat(64), secret)).toBe(false)
    expect(await verifyInferenceSignature(body, signature, '')).toBe(false)
  })
})
