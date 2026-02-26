import { describe, expect, it } from 'vitest'
import { XrpcInternalError, XrpcResponseError } from '@atproto/lex-client'
import { LexError } from '@atproto/lex-data'
import { IssueInvalidType, LexValidationError, l } from '@atproto/lex-schema'
import { LexServerAuthError, LexServerError } from './errors.js'

// Minimal method fixtures for XrpcError subclasses
const testQuery = l.query(
  'io.example.test',
  l.params(),
  l.payload('application/json', l.object({ value: l.string() })),
)

describe(LexServerError, () => {
  it('stores status, body, and headers', () => {
    const error = new LexServerError(
      400,
      { error: 'InvalidRequest', message: 'Bad input' },
      { 'X-Custom': 'header' },
    )

    expect(error.status).toBe(400)
    expect(error.body).toEqual({
      error: 'InvalidRequest',
      message: 'Bad input',
    })
    expect(error.headers?.get('X-Custom')).toBe('header')
    expect(error.error).toBe('InvalidRequest')
    expect(error.message).toBe('Bad input')
  })

  it('has undefined headers when none provided', () => {
    const error = new LexServerError(500, { error: 'InternalError' })
    expect(error.headers).toBeUndefined()
  })

  it('toJSON returns the body', () => {
    const body = { error: 'TestError' as const, message: 'test' }
    const error = new LexServerError(400, body)
    expect(error.toJSON()).toEqual(body)
  })

  it('toResponse creates a Response with correct status and body', async () => {
    const error = new LexServerError(
      422,
      { error: 'ValidationError', message: 'Invalid data' },
      { 'X-Test': 'yes' },
    )
    const response = error.toResponse()

    expect(response.status).toBe(422)
    expect(response.headers.get('X-Test')).toBe('yes')
    expect(await response.json()).toEqual({
      error: 'ValidationError',
      message: 'Invalid data',
    })
  })

  describe('from()', () => {
    it('returns existing LexServerError as-is', () => {
      const original = new LexServerError(400, { error: 'Test' })
      expect(LexServerError.from(original)).toBe(original)
    })

    it('converts XrpcError to downstream LexServerError', () => {
      const xrpcError = new XrpcInternalError(testQuery, 'Something broke')
      const serverError = LexServerError.from(xrpcError)

      expect(serverError).toBeInstanceOf(LexServerError)
      expect(serverError.status).toBe(500)
      expect(serverError.body.error).toBe('InternalServerError')
      expect(serverError.cause).toBe(xrpcError)
    })

    it('converts XrpcResponseError with 5xx to 502', () => {
      const response = new Response(null, { status: 503 })
      const xrpcError = new XrpcResponseError(testQuery, response, {
        encoding: 'application/json',
        body: { error: 'ServiceUnavailable', message: 'Try again later' },
      })
      const serverError = LexServerError.from(xrpcError)

      expect(serverError.status).toBe(502)
      expect(serverError.body.error).toBe('ServiceUnavailable')
    })

    it('converts XrpcResponseError with 4xx preserving status', () => {
      const response = new Response(null, { status: 404 })
      const xrpcError = new XrpcResponseError(testQuery, response, {
        encoding: 'application/json',
        body: { error: 'NotFound', message: 'Record not found' },
      })
      const serverError = LexServerError.from(xrpcError)

      expect(serverError.status).toBe(404)
      expect(serverError.body.error).toBe('NotFound')
    })

    it('converts LexValidationError to 400', () => {
      const validationError = new LexValidationError([
        new IssueInvalidType([], 'hello', ['number']),
      ])
      const serverError = LexServerError.from(validationError)

      expect(serverError.status).toBe(400)
      expect(serverError.body.error).toBe('InvalidRequest')
      expect(serverError.cause).toBe(validationError)
    })

    it('converts plain LexError to 500', () => {
      const lexError = new LexError('CustomError', 'Something happened')
      const serverError = LexServerError.from(lexError)

      expect(serverError.status).toBe(500)
      expect(serverError.body.error).toBe('CustomError')
      expect(serverError.cause).toBe(lexError)
    })

    it('converts unknown errors to 500 InternalServerError', () => {
      const serverError = LexServerError.from(new TypeError('oops'))

      expect(serverError.status).toBe(500)
      expect(serverError.body.error).toBe('InternalServerError')
      expect(serverError.body.message).toBe('An internal error occurred')
    })

    it('converts non-Error values to 500 InternalServerError', () => {
      const serverError = LexServerError.from('string error')

      expect(serverError.status).toBe(500)
      expect(serverError.body.error).toBe('InternalServerError')
    })
  })
})

describe(LexServerAuthError, () => {
  it('always has status 401', () => {
    const error = new LexServerAuthError(
      'AuthenticationRequired',
      'Token expired',
    )
    expect(error.status).toBe(401)
  })

  it('sets WWW-Authenticate header', () => {
    const error = new LexServerAuthError(
      'AuthenticationRequired',
      'Token required',
      { Bearer: { realm: 'api.example.com', error: 'InvalidToken' } },
    )
    const header = error.headers?.get('WWW-Authenticate')
    expect(header).toContain('Bearer')
    expect(header).toContain('realm="api.example.com"')
    expect(header).toContain('error="InvalidToken"')
  })

  it('sets Access-Control-Expose-Headers for CORS', () => {
    const error = new LexServerAuthError(
      'AuthenticationRequired',
      'Token required',
    )
    expect(error.headers?.get('Access-Control-Expose-Headers')).toBe(
      'WWW-Authenticate',
    )
  })

  it('toResponse returns 401 with proper headers', async () => {
    const error = new LexServerAuthError(
      'AuthenticationRequired',
      'Missing token',
      { Bearer: { error: 'MissingToken' } },
    )
    const response = error.toResponse()

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('Bearer')
    const body = await response.json()
    expect(body.error).toBe('AuthenticationRequired')
    expect(body.message).toBe('Missing token')
  })

  describe('from()', () => {
    it('returns existing LexServerAuthError as-is', () => {
      const original = new LexServerAuthError('AuthenticationRequired', 'test')
      expect(LexServerAuthError.from(original)).toBe(original)
    })

    it('wraps a LexError preserving error code and message', () => {
      const lexError = new LexError('ExpiredToken', 'Token has expired')
      const authError = LexServerAuthError.from(lexError, {
        Bearer: { error: 'ExpiredToken' },
      })

      expect(authError).toBeInstanceOf(LexServerAuthError)
      expect(authError.error).toBe('ExpiredToken')
      expect(authError.message).toBe('Token has expired')
      expect(authError.cause).toBe(lexError)
    })

    it('wraps unknown errors with default error code', () => {
      const authError = LexServerAuthError.from(new Error('something'))

      expect(authError.error).toBe('AuthenticationRequired')
      expect(authError.message).toBe('Authentication failed')
    })

    it('wraps non-Error values with default error code', () => {
      const authError = LexServerAuthError.from(null)

      expect(authError.error).toBe('AuthenticationRequired')
      expect(authError.message).toBe('Authentication failed')
    })
  })
})
