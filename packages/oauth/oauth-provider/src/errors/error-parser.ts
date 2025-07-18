import { errors } from 'jose'
import { ZodError } from 'zod'
import { JwtVerifyError } from '@atproto/jwk'
import { formatZodError } from '../lib/util/zod-error.js'
import { OAuthError } from './oauth-error.js'

const { JOSEError } = errors

const INVALID_REQUEST = 'invalid_request'
const SERVER_ERROR = 'server_error'

export function buildErrorStatus(error: unknown): number {
  if (error instanceof OAuthError) {
    return error.statusCode
  }

  if (error instanceof JwtVerifyError) {
    return 400
  }

  if (error instanceof ZodError) {
    return 400
  }

  if (error instanceof JOSEError) {
    return 400
  }

  if (error instanceof TypeError) {
    return 400
  }

  if (isBoom(error)) {
    return error.output.statusCode
  }

  if (isXrpcError(error)) {
    return error.type
  }

  const status = (error as any)?.status
  if (
    typeof status === 'number' &&
    status === (status | 0) &&
    status >= 400 &&
    status < 600
  ) {
    return status
  }

  return 500
}

export type ErrorPayload = {
  error: string
  error_description: string
}

export function buildErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof OAuthError) {
    return error.toJSON()
  }

  if (error instanceof ZodError) {
    return {
      error: INVALID_REQUEST,
      error_description: formatZodError(error, 'Validation error'),
    }
  }

  if (error instanceof JOSEError) {
    return {
      error: INVALID_REQUEST,
      error_description: error.message,
    }
  }

  if (error instanceof TypeError) {
    return {
      error: INVALID_REQUEST,
      error_description: error.message,
    }
  }

  if (isBoom(error)) {
    return {
      error: error.output.statusCode <= 500 ? INVALID_REQUEST : SERVER_ERROR,
      error_description:
        error.output.statusCode <= 500
          ? isPayloadLike(error.output?.payload)
            ? error.output.payload.message
            : error.message
          : 'Server error',
    }
  }

  if (isXrpcError(error)) {
    return {
      error: error.type <= 500 ? INVALID_REQUEST : SERVER_ERROR,
      error_description: error.payload.message,
    }
  }

  const status = buildErrorStatus(error)
  return {
    error: status < 500 ? INVALID_REQUEST : SERVER_ERROR,
    error_description:
      error instanceof Error && (error as any)?.expose === true
        ? error.message
        : 'Server error',
  }
}

function isBoom(v: unknown): v is Error & {
  isBoom: true
  output: { statusCode: number; payload: unknown }
} {
  return (
    v instanceof Error &&
    (v as any).isBoom === true &&
    isHttpErrorCode(v['output']?.['statusCode'])
  )
}

function isXrpcError(v: unknown): v is Error & {
  type: number
  payload: { error: string; message: string }
} {
  return (
    v instanceof Error &&
    isHttpErrorCode(v['type']) &&
    isPayloadLike(v['payload'])
  )
}

function isHttpErrorCode(v: unknown): v is number {
  return typeof v === 'number' && v >= 400 && v < 600 && v === (v | 0)
}

function isPayloadLike(v: unknown): v is { error: string; message: string } {
  return (
    v != null &&
    typeof v === 'object' &&
    typeof v['error'] === 'string' &&
    typeof v['message'] === 'string'
  )
}
