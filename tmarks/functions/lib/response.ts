import type { ApiResponse, ApiError } from './types'

export function success<T>(data: T, meta?: ApiResponse['meta']): Response {
  const body: ApiResponse<T> = { data }
  if (meta) {
    body.meta = meta
  }
  return Response.json(body, { status: 200 })
}

export function created<T>(data: T): Response {
  return Response.json({ data } as ApiResponse<T>, { status: 201 })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export function badRequest(error: string | ApiError | Partial<ApiError>, code = 'BAD_REQUEST'): Response {
  const errorObj: ApiError = typeof error === 'string'
    ? { code, message: error }
    : { code: error.code || code, message: error.message || 'Bad request', ...error }
  return Response.json({ error: errorObj } as ApiResponse, { status: 400 })
}

export function unauthorized(error: string | ApiError | Partial<ApiError>, code?: string): Response {
  const errorObj: ApiError = typeof error === 'string'
    ? { code: code || 'UNAUTHORIZED', message: error }
    : { code: error.code || code || 'UNAUTHORIZED', message: error.message || 'Unauthorized', ...error }
  return Response.json({ error: errorObj } as ApiResponse, { status: 401 })
}

export function forbidden(error: string | ApiError | Partial<ApiError>, code?: string): Response {
  const errorObj: ApiError = typeof error === 'string'
    ? { code: code || 'FORBIDDEN', message: error }
    : { code: error.code || code || 'FORBIDDEN', message: error.message || 'Forbidden', ...error }
  return Response.json({ error: errorObj } as ApiResponse, { status: 403 })
}

export function notFound(message = 'Not found', code = 'NOT_FOUND'): Response {
  const error: ApiError = { code, message }
  return Response.json({ error } as ApiResponse, { status: 404 })
}

export function conflict(message: string, code = 'CONFLICT'): Response {
  const error: ApiError = { code, message }
  return Response.json({ error } as ApiResponse, { status: 409 })
}

export function tooManyRequests(error: string | ApiError | Partial<ApiError>, headers?: Record<string, string>): Response {
  const errorObj: ApiError = typeof error === 'string'
    ? { code: 'RATE_LIMIT_EXCEEDED', message: error }
    : { code: error.code || 'RATE_LIMIT_EXCEEDED', message: error.message || 'Too many requests', ...error }

  const responseHeaders = new Headers({ 'Content-Type': 'application/json' })
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => responseHeaders.set(key, value))
  }

  return new Response(JSON.stringify({ error: errorObj } as ApiResponse), {
    status: 429,
    headers: responseHeaders,
  })
}

export function internalError(message = 'Internal server error', code = 'INTERNAL_ERROR'): Response {
  const error: ApiError = { code, message }
  return Response.json({ error } as ApiResponse, { status: 500 })
}
