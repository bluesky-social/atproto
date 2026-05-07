import { describe, expect, it } from 'vitest'
import { IssueInvalidType, LexValidationError, l } from '@atproto/lex-schema'
import {
  XrpcAuthenticationError,
  XrpcFetchError,
  XrpcInternalError,
  XrpcInvalidResponseError,
  XrpcResponseError,
  XrpcResponseValidationError,
  asXrpcFailure,
} from './errors.js'

// Minimal method fixture
const testQuery = l.query(
  'io.example.test',
  l.params(),
  l.jsonPayload({ value: l.string() }),
  ['TestError', 'AnotherError'],
)

const testQueryNoErrors = l.query(
  'io.example.noErrors',
  l.params(),
  l.jsonPayload({ value: l.string() }),
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

  describe('StatusErrorCodes mapping for non-XRPC responses', () => {
    it('maps 400 to InvalidRequest', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 400 }),
      )
      expect(err.error).toBe('InvalidRequest')
    })

    it('maps 401 to AuthenticationRequired', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 401 }),
      )
      expect(err.error).toBe('AuthenticationRequired')
    })

    it('maps 403 to Forbidden', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 403 }),
      )
      expect(err.error).toBe('Forbidden')
    })

    it('maps 404 to XRPCNotSupported', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 404 }),
      )
      expect(err.error).toBe('XRPCNotSupported')
    })

    it('maps 406 to NotAcceptable', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 406 }),
      )
      expect(err.error).toBe('NotAcceptable')
    })

    it('maps 413 to PayloadTooLarge', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 413 }),
      )
      expect(err.error).toBe('PayloadTooLarge')
    })

    it('maps 415 to UnsupportedMediaType', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 415 }),
      )
      expect(err.error).toBe('UnsupportedMediaType')
    })

    it('maps 429 to RateLimitExceeded', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 429 }),
      )
      expect(err.error).toBe('RateLimitExceeded')
    })

    it('maps 500 to InternalServerError', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 500 }),
      )
      expect(err.error).toBe('InternalServerError')
    })

    it('maps 501 to MethodNotImplemented', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 501 }),
      )
      expect(err.error).toBe('MethodNotImplemented')
    })

    it('maps 502 to UpstreamFailure', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 502 }),
      )
      expect(err.error).toBe('UpstreamFailure')
    })

    it('maps 503 to NotEnoughResources', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 503 }),
      )
      expect(err.error).toBe('NotEnoughResources')
    })

    it('maps 504 to UpstreamTimeout', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 504 }),
      )
      expect(err.error).toBe('UpstreamTimeout')
    })

    it('defaults to InvalidRequest for unmapped 4xx status codes', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 418 }),
      )
      expect(err.error).toBe('InvalidRequest')
    })

    it('defaults to UpstreamFailure for unmapped 5xx status codes', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 599 }),
      )
      expect(err.error).toBe('UpstreamFailure')
    })

    it('uses error from valid XRPC payload instead of status code mapping', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 400 }),
        {
          encoding: 'application/json',
          body: { error: 'CustomError', message: 'Custom message' },
        },
      )
      expect(err.error).toBe('CustomError')
    })
  })

  it('exposes the response object', () => {
    const response = new Response(null, {
      status: 400,
      headers: { 'X-Test': 'value' },
    })
    const err = new XrpcResponseError(testQuery, response, {
      encoding: 'application/json',
      body: { error: 'TestError' },
    })
    expect(err.reason).toBe(err)
    expect(err.response.status).toBe(400)
    expect(err.response.headers.get('X-Test')).toBe('value')
  })

  it('exposes body from the payload', () => {
    const err = createResponseError(400, 'TestError', 'details')
    expect(err.toJSON()).toEqual({ error: 'TestError', message: 'details' })
  })

  describe('toDownstreamError', () => {
    it('returns 502 for upstream 500 errors', () => {
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

    it('preserves original status for non-500 5xx errors', () => {
      const err = createResponseError(503, 'ServiceUnavailable', 'Try later')
      const downstream = err.toDownstreamError()

      expect(downstream.status).toBe(503)
      expect(downstream.body).toEqual({
        error: 'ServiceUnavailable',
        message: 'Try later',
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

    it('preserves 429 status for rate limiting', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 429 }),
      )
      expect(err.toDownstreamError().status).toBe(429)
    })

    it('converts 500 to 502', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 500 }),
      )
      expect(err.toDownstreamError().status).toBe(502)
    })

    it('strips hop-by-hop headers', () => {
      const response = new Response(null, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
          'Keep-Alive': 'timeout=5',
          'Transfer-Encoding': 'chunked',
        },
      })
      const err = new XrpcResponseError(testQuery, response, {
        encoding: 'application/json',
        body: { error: 'TestError' },
      })
      const downstream = err.toDownstreamError()

      expect(downstream.headers?.has('Content-Type')).toBe(true)
      expect(downstream.headers?.has('Connection')).toBe(false)
      expect(downstream.headers?.has('Keep-Alive')).toBe(false)
      expect(downstream.headers?.has('Transfer-Encoding')).toBe(false)
    })
  })

  describe('toJSON', () => {
    it('returns the payload body for valid XRPC errors', () => {
      const err = createResponseError(400, 'TestError', 'message')
      expect(err.toJSON()).toEqual({ error: 'TestError', message: 'message' })
    })

    it('constructs XRPC error from status code when payload is not valid XRPC', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 429 }),
        { encoding: 'text/plain', body: 'Rate limit exceeded' },
      )
      expect(err.toJSON()).toEqual({
        error: 'RateLimitExceeded',
        message: 'Upstream server responded with a 429 error',
      })
    })

    it('constructs XRPC error from status code when payload is missing', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 503 }),
      )
      expect(err.toJSON()).toEqual({
        error: 'NotEnoughResources',
        message: 'Upstream server responded with a 503 error',
      })
    })

    it('returns valid XRPC payload unchanged', () => {
      const err = new XrpcResponseError(
        testQuery,
        new Response(null, { status: 400 }),
        {
          encoding: 'application/json',
          body: { error: 'CustomError', message: 'Custom message' },
        },
      )
      expect(err.toJSON()).toEqual({
        error: 'CustomError',
        message: 'Custom message',
      })
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
    expect(err.reason).toBe(err)
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
// XrpcInvalidResponseError
// ============================================================================

describe(XrpcInvalidResponseError, () => {
  it('has error code InvalidResponse', () => {
    const response = new Response(null, { status: 399 })
    const err = new XrpcInvalidResponseError(testQuery, response)
    expect(err.reason).toBe(err)
    expect(err.error).toBe('InvalidResponse')
    expect(err.toDownstreamError()).toMatchObject({
      status: 502,
      body: {
        error: 'InvalidResponse',
        message: 'Upstream server responded with an invalid status code (399)',
      },
    })
  })

  it('toDownstreamError returns 502 for 500 upstream errors', () => {
    const response = new Response(null, { status: 500 })
    const err = new XrpcInvalidResponseError(testQuery, response)
    expect(err.toDownstreamError().status).toBe(502)
  })

  it('shouldRetry is true for retryable status codes', () => {
    const response = new Response(null, { status: 502 })
    const err = new XrpcInvalidResponseError(testQuery, response)
    expect(err.shouldRetry()).toBe(true)
  })

  it('shouldRetry is false for non-retryable status codes', () => {
    const response = new Response(null, { status: 400 })
    const err = new XrpcInvalidResponseError(testQuery, response)
    expect(err.shouldRetry()).toBe(false)
  })
})

// ============================================================================
// XrpcResponseValidationError
// ============================================================================

describe(XrpcResponseValidationError, () => {
  it('extends XrpcInvalidResponseError', () => {
    const response = new Response(null, { status: 200 })
    const validationError = new LexValidationError([
      new IssueInvalidType([], 42, ['string']),
    ])
    const err = new XrpcResponseValidationError(
      testQuery,
      response,
      { encoding: 'application/json', body: { value: 42 } },
      validationError,
    )

    expect(err).toBeInstanceOf(XrpcInvalidResponseError)
    expect(err.reason).toBe(err)
    expect(err.error).toBe('InvalidResponse')
    expect(err.cause).toBe(validationError)
  })

  it('includes validation error message', () => {
    const validationError = new LexValidationError([
      new IssueInvalidType([], 42, ['string']),
    ])
    const err = new XrpcResponseValidationError(
      testQuery,
      new Response(null, { status: 200 }),
      { encoding: 'application/json', body: { value: 42 } },
      validationError,
    )

    expect(err.message).toContain('Invalid response payload:')
    expect(err.message).toContain(validationError.message)
  })

  it('toDownstreamError returns 502', () => {
    const validationError = new LexValidationError([
      new IssueInvalidType([], 42, ['string']),
    ])
    const err = new XrpcResponseValidationError(
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
    expect(err.reason).toBe(err)
    expect(err.error).toBe('InternalServerError')
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

  it('is not retryable', () => {
    const err = new XrpcInternalError(testQuery, 'something broke')
    expect(err.shouldRetry()).toBe(false)
  })
})

// ============================================================================
// XrpcFetchError
// ============================================================================

describe(XrpcFetchError, () => {
  it('extends XrpcInternalError', () => {
    const err = new XrpcFetchError(testQuery, new TypeError('fetch failed'))
    expect(err).toBeInstanceOf(XrpcInternalError)
    expect(err.error).toBe('InternalServerError')
  })

  it('uses cause message when cause is an Error', () => {
    const cause = new TypeError('Failed to fetch')
    const err = new XrpcFetchError(testQuery, cause)
    expect(err.message).toBe('Unexpected fetchHandler() error: Failed to fetch')
    expect(err.cause).toBe(cause)
  })

  it('uses fallback message when cause is not an Error', () => {
    const err = new XrpcFetchError(testQuery, 'string cause')
    expect(err.message).toBe('Unexpected fetchHandler() error: string cause')
    expect(err.cause).toBe('string cause')
  })

  it('is retryable', () => {
    const err = new XrpcFetchError(testQuery, new Error('network timeout'))
    expect(err.shouldRetry()).toBe(true)
  })

  it('toJSON does not expose internal details', () => {
    const err = new XrpcFetchError(
      testQuery,
      new Error('ECONNREFUSED 10.0.0.1:443'),
    )
    const json = err.toJSON()

    expect(json.error).toBe('InternalServerError')
    expect(json.message).toBe('Failed to perform upstream request')
    expect(json.message).not.toContain('ECONNREFUSED')
  })

  it('toDownstreamError returns 502', () => {
    const err = new XrpcFetchError(testQuery, new Error('DNS lookup failed'))
    const downstream = err.toDownstreamError()

    expect(downstream.status).toBe(502)
    expect(downstream.body.error).toBe('InternalServerError')
    expect(downstream.body.message).toBe('Failed to perform upstream request')
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
