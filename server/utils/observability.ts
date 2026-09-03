import type { H3Event } from 'h3'
import { getHeader, setHeader, setResponseStatus } from 'h3'
import { ApiContractError, EngineExecutionError, type ApiErrorResponse } from './api-contract'

export const getRequestId = (event: H3Event) => {
  const existing = getHeader(event, 'x-request-id')
  if (existing) return existing
  const id = crypto.randomUUID()
  setHeader(event, 'x-request-id', id)
  return id
}

export const logServerEvent = (
  event: H3Event,
  fields: Record<string, string | number | boolean | null | undefined>
) => {
  console.info(JSON.stringify({
    requestId: getRequestId(event),
    ...fields
  }))
}

export const apiFailureWithRequestId = (event: H3Event, error: unknown): ApiErrorResponse => {
  const requestId = getRequestId(event)
  if (error instanceof ApiContractError) {
    setResponseStatus(event, error.statusCode)
    return {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        issues: error.issues
      }
    }
  }
  if (error instanceof EngineExecutionError) {
    setResponseStatus(event, 500)
    return {
      error: {
        code: 'ENGINE_ERROR',
        message: error.message,
        requestId
      }
    }
  }
  setResponseStatus(event, 500)
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'The request could not be completed.',
      requestId
    }
  }
}
