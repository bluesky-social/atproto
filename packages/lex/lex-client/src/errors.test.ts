import { describe, expect, it } from 'vitest'
import { IssueInvalidType, LexValidationError, l } from '@atproto/lex-schema'
import {
  XrpcAuthenticationError,
  XrpcInternalError,
  XrpcInvalidResponseError,
  XrpcResponseError,
  XrpcUpstreamError,
  asXrpcFailure,
} from './errors.js'

// Minimal method fixture
const testQuery = l.query(
  'io.example.test',
  l.params(),
  l.payload('application/json', l.object({ value: l.string() })),
  ['TestError', 'AnotherError'],
)

const testQueryNoErrors = l.query(
  'io.example.noErrors',
  l.params(),
  l.payload('application/json', l.object({ value: l.string() })),
)

// ============================================================================
// XrpcResponseError
// ============================================================================

describe(XrpcResponseError, () => {
  function createResponseError(
    status: number,
    errorCode: string,
    message?: string,
  ) {
    const response = new Response(null, { status })
    return new XrpcResponseError(testQuery, response, {
      encoding: 'application/json',
      body: { error: errorCode, message },
    })
  }

  it('exposes status from the response', () => {
    const err = createResponseError(404, 'NotFound')
    expect(err.status).toBe(404)
  })

  it('exposes headers from the response', () => {
    const response = new Response(null, {
      status: 400,
      headers: { 'X-Test': 'value' },
    })
    const err = new XrpcResponseError(testQuery, response, {
      encoding: 'application/json',
      body: { error: 'TestError' },
    })
    expect(err.headers.get('X-Test')).toBe('value')
  })

  it('exposes body from the payload', () => {
    const err = createResponseError(400, 'TestError', 'details')
    expect(err.body).toEqual({ error: 'TestError', message: 'details' })
  })

  describe('toDownstreamError', () => {
    it('returns 502 for 5xx upstream errors', () => {
      const err = createResponseError(
        500,
        'InternalServerError',
        'Upstream crashed',
      )
      const downstream = err.toDownstreamError()

      expect(downstream.status).toBe(502)
      expect(downstream.body).toEqual({
        error: 'InternalServerError',
        message: 'Upstream crashed',
      })
    })

    it('preserves original status for 4xx errors', () => {
      const err = createResponseError(404, 'NotFound', 'Record not found')
      const downstream = err.toDownstreamError()

      expect(downstream.status).toBe(404)
      expect(downstream.body).toEqual({
        error: 'NotFound',
        message: 'Record not found',
      })
    })
  })

  describe('toJSON', () => {
    it('returns the payload body', () => {
      const err = createResponseError(400, 'TestError', 'message')
      expect(err.toJSON()).toEqual({ error: 'TestError', message: 'message' })
    })
  })

  describe('matchesSchemaErrors', () => {
    it('returns true when error matches method declared errors', () => {
      const err = createResponseError(400, 'TestError')
      expect(err.matchesSchemaErrors()).toBe(true)
    })

    it('returns false for undeclared error codes', () => {
      const err = createResponseError(400, 'UnknownError')
      expect(err.matchesSchemaErrors()).toBe(false)
    })

    it('returns false when method has no declared errors', () => {
      const response = new Response(null, { status: 400 })
      const err = new XrpcResponseError(testQueryNoErrors, response, {
        encoding: 'application/json',
        body: { error: 'SomeError' },
      })
      expect(err.matchesSchemaErrors()).toBe(false)
    })
  })

  describe('shouldRetry', () => {
    it('returns true for retryable status codes', () => {
      expect(createResponseError(429, 'RateLimit').shouldRetry()).toBe(true)
      expect(createResponseError(500, 'Internal').shouldRetry()).toBe(true)
      expect(createResponseError(502, 'BadGateway').shouldRetry()).toBe(true)
      expect(createResponseError(503, 'Unavailable').shouldRetry()).toBe(true)
    })

    it('returns false for non-retryable status codes', () => {
      expect(createResponseError(400, 'BadRequest').shouldRetry()).toBe(false)
      expect(createResponseError(401, 'Unauthorized').shouldRetry()).toBe(false)
      expect(createResponseError(404, 'NotFound').shouldRetry()).toBe(false)
    })
  })
})

// ============================================================================
// XrpcAuthenticationError
// ============================================================================

describe(XrpcAuthenticationError, () => {
  it('is never retryable', () => {
    const response = new Response(null, { status: 401 })
    const err = new XrpcAuthenticationError(testQuery, response, {
      encoding: 'application/json',
      body: { error: 'AuthenticationRequired' },
    })
    expect(err.shouldRetry()).toBe(false)
  })

  it('parses WWW-Authenticate header', () => {
    const response = new Response(null, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="api", error="InvalidToken"',
      },
    })
    const err = new XrpcAuthenticationError(testQuery, response, {
      encoding: 'application/json',
      body: { error: 'AuthenticationRequired' },
    })
    expect(err.wwwAuthenticate).toHaveProperty('Bearer')
  })

  it('returns empty object when no WWW-Authenticate header', () => {
    const response = new Response(null, { status: 401 })
    const err = new XrpcAuthenticationError(testQuery, response, {
      encoding: 'application/json',
      body: { error: 'AuthenticationRequired' },
    })
    expect(err.wwwAuthenticate).toEqual({})
  })

  it('toDownstreamError always returns 401', () => {
    const response = new Response(null, { status: 401 })
    const err = new XrpcAuthenticationError(testQuery, response, {
      encoding: 'application/json',
      body: { error: 'AuthenticationRequired', message: 'No token' },
    })
    const downstream = err.toDownstreamError()

    expect(downstream.status).toBe(401)
    expect(downstream.body).toEqual({
      error: 'AuthenticationRequired',
      message: 'No token',
    })
  })
})

// ============================================================================
// XrpcUpstreamError
// ============================================================================

describe(XrpcUpstreamError, () => {
  it('has error code UpstreamFailure', () => {
    const response = new Response(null, { status: 200 })
    const err = new XrpcUpstreamError(testQuery, response)
    expect(err.error).toBe('UpstreamFailure')
  })

  it('toDownstreamError returns 502', () => {
    const response = new Response(null, { status: 200 })
    const err = new XrpcUpstreamError(testQuery, response)
    const downstream = err.toDownstreamError()
    expect(downstream.status).toBe(502)
  })

  it('shouldRetry is true for retryable status codes', () => {
    const response = new Response(null, { status: 502 })
    const err = new XrpcUpstreamError(testQuery, response)
    expect(err.shouldRetry()).toBe(true)
  })

  it('shouldRetry is false for non-retryable status codes', () => {
    const response = new Response(null, { status: 200 })
    const err = new XrpcUpstreamError(testQuery, response)
    expect(err.shouldRetry()).toBe(false)
  })
})

// ============================================================================
// XrpcInvalidResponseError
// ============================================================================

describe(XrpcInvalidResponseError, () => {
  it('extends XrpcUpstreamError', () => {
    const response = new Response(null, { status: 200 })
    const validationError = new LexValidationError([
      new IssueInvalidType([], 42, ['string']),
    ])
    const err = new XrpcInvalidResponseError(
      testQuery,
      response,
      { encoding: 'application/json', body: { value: 42 } },
      validationError,
    )

    expect(err).toBeInstanceOf(XrpcUpstreamError)
    expect(err.error).toBe('UpstreamFailure')
    expect(err.cause).toBe(validationError)
  })

  it('includes validation error message', () => {
    const validationError = new LexValidationError([
      new IssueInvalidType([], 42, ['string']),
    ])
    const err = new XrpcInvalidResponseError(
      testQuery,
      new Response(null, { status: 200 }),
      { encoding: 'application/json', body: { value: 42 } },
      validationError,
    )

    expect(err.message).toContain('Invalid response:')
    expect(err.message).toContain(validationError.message)
  })

  it('toDownstreamError returns 502', () => {
    const validationError = new LexValidationError([
      new IssueInvalidType([], 42, ['string']),
    ])
    const err = new XrpcInvalidResponseError(
      testQuery,
      new Response(null, { status: 200 }),
      { encoding: 'application/json', body: { value: 42 } },
      validationError,
    )
    const downstream = err.toDownstreamError()
    expect(downstream.status).toBe(502)
  })
})

// ============================================================================
// XrpcInternalError
// ============================================================================

describe(XrpcInternalError, () => {
  it('has error code InternalServerError', () => {
    const err = new XrpcInternalError(testQuery)
    expect(err.error).toBe('InternalServerError')
  })

  it('is always retryable', () => {
    const err = new XrpcInternalError(testQuery)
    expect(err.shouldRetry()).toBe(true)
  })

  it('toJSON does not expose internal details', () => {
    const err = new XrpcInternalError(
      testQuery,
      'Secret database connection string leaked',
    )
    const json = err.toJSON()

    expect(json.error).toBe('InternalServerError')
    expect(json.message).toBe('Internal Server Error')
    expect(json.message).not.toContain('Secret')
  })

  it('toDownstreamError returns 500', () => {
    const err = new XrpcInternalError(testQuery, 'internal details')
    const downstream = err.toDownstreamError()

    expect(downstream.status).toBe(500)
    expect(downstream.body.error).toBe('InternalServerError')
    expect(downstream.body.message).toBe('Internal Server Error')
  })
})

// ============================================================================
// asXrpcFailure
// ============================================================================

describe('asXrpcFailure', () => {
  it('returns existing XrpcResponseError for the same method', () => {
    const response = new Response(null, { status: 400 })
    const err = new XrpcResponseError(testQuery, response, {
      encoding: 'application/json',
      body: { error: 'TestError' },
    })
    expect(asXrpcFailure(testQuery, err)).toBe(err)
  })

  it('wraps unknown errors in XrpcInternalError', () => {
    const err = new TypeError('fetch failed')
    const failure = asXrpcFailure(testQuery, err)

    expect(failure).toBeInstanceOf(XrpcInternalError)
    expect(failure.cause).toBe(err)
  })

  it('wraps XrpcError for a different method in XrpcInternalError', () => {
    const otherQuery = l.query(
      'io.example.other',
      l.params(),
      l.payload('application/json', l.object({ value: l.string() })),
    )
    const response = new Response(null, { status: 400 })
    const err = new XrpcResponseError(otherQuery, response, {
      encoding: 'application/json',
      body: { error: 'TestError' },
    })
    const failure = asXrpcFailure(testQuery, err)
    expect(failure).toBeInstanceOf(XrpcInternalError)
  })
})
