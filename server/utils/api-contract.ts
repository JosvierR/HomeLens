import type { H3Event } from 'h3'
import { readBody, setResponseStatus } from 'h3'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'

export interface ApiErrorResponse {
  error: {
    code: 'MALFORMED_JSON' | 'INVALID_REQUEST' | 'ENGINE_ERROR' | 'INTERNAL_ERROR'
    message: string
    issues?: Array<{ path: string, message: string }>
  }
}

export class ApiContractError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorResponse['error']['code'],
    message: string,
    readonly issues?: ApiErrorResponse['error']['issues']
  ) {
    super(message)
  }
}

export class EngineExecutionError extends Error {
  constructor() {
    super('The decision engine could not complete the request.')
  }
}

export const runDomainEngine = <T>(operation: () => T): T => {
  try {
    return operation()
  } catch {
    throw new EngineExecutionError()
  }
}

export const readContractBody = async <T>(event: H3Event, schema: ZodType<T>): Promise<T> => {
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    throw new ApiContractError(400, 'MALFORMED_JSON', 'Request body must contain valid JSON.')
  }

  try {
    return schema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiContractError(400, 'INVALID_REQUEST', 'Request validation failed.', error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      })))
    }
    throw error
  }
}

export const describeApiFailure = (error: unknown): { statusCode: number, body: ApiErrorResponse } => {
  if (error instanceof ApiContractError) {
    return { statusCode: error.statusCode, body: { error: { code: error.code, message: error.message, issues: error.issues } } }
  }
  if (error instanceof EngineExecutionError) {
    return { statusCode: 500, body: { error: { code: 'ENGINE_ERROR', message: error.message } } }
  }
  return { statusCode: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } } }
}

export const apiFailure = (event: H3Event, error: unknown): ApiErrorResponse => {
  const failure = describeApiFailure(error)
  setResponseStatus(event, failure.statusCode)
  return failure.body
}
