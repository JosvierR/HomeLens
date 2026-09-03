import { describe, expect, it } from 'vitest'
import { describeApiFailure, EngineExecutionError, runDomainEngine } from '../server/utils/api-contract'

describe('API failure contract', () => {
  it('maps engine failures to a predictable response without internal details', () => {
    let failure: unknown
    try {
      runDomainEngine(() => { throw new Error('private stack and implementation detail') })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(EngineExecutionError)
    const response = describeApiFailure(failure)
    expect(response).toEqual({
      statusCode: 500,
      body: { error: { code: 'ENGINE_ERROR', message: 'The decision engine could not complete the request.' } }
    })
    expect(JSON.stringify(response)).not.toContain('private stack')
    expect(JSON.stringify(response).toLowerCase()).not.toContain('stack')
  })

  it('maps unknown failures to a generic response', () => {
    expect(describeApiFailure(new Error('secret'))).toEqual({
      statusCode: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } }
    })
  })
})
