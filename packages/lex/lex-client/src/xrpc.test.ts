import { assert, describe, expect, it, vi } from 'vitest'
import { l } from '@atproto/lex-schema'
import { FetchHandler } from './agent.js'
import {
  XrpcAuthenticationError,
  XrpcFetchError,
  XrpcInternalError,
  XrpcInvalidResponseError,
  XrpcResponseError,
  XrpcUpstreamError,
} from './errors.js'
import { XrpcResponse } from './response.js'
import { xrpc, xrpcSafe } from './xrpc.js'

// Fixtures

const testQuery = l.query(
  'io.example.testQuery',
  l.params({ limit: l.optional(l.integer()) }),
  l.jsonPayload({ value: l.string() }),
  ['TestError'],
)

const testProcedure = l.procedure(
  'io.example.testProcedure',
  l.params(),
  l.jsonPayload({ text: l.string() }),
  l.jsonPayload({ id: l.string() }),
  ['ProcedureError'],
)

const testBinaryQuery = l.query(
  'io.example.testBinaryQuery',
  l.params(),
  l.payload('application/octet-stream', undefined),
)

const testBinaryProcedure = l.procedure(
  'io.example.testBinaryProcedure',
  l.params(),
  l.payload('image/*', undefined),
  l.payload('application/octet-stream', undefined),
)

const testNoOutputQuery = l.query(
  'io.example.testNoOutputQuery',
  l.params(),
  l.payload(),
)

describe(xrpc, () => {
  describe('success paths', () => {
    it('returns parsed JSON body for a query', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 'hello' })

      const response = await xrpc(fetchHandler, testQuery, {
        params: { limit: 10 },
      })

      expect(response).toBeInstanceOf(XrpcResponse)
      expect(response.success).toBe(true)
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ value: 'hello' })
      expect(response.encoding).toBe('application/json')
      expect(response.isParsed).toBe(true)
      expect(response.value).toBe(response)
    })

    it('returns parsed JSON body for a procedure', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ id: 'abc123' })

      const response = await xrpc(fetchHandler, testProcedure, {
        body: { text: 'hello world' },
      })

      expect(response.success).toBe(true)
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ id: 'abc123' })
      expect(response.encoding).toBe('application/json')
    })

    it('returns binary body for a binary query', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4])
      const fetchHandler: FetchHandler = async () =>
        new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })

      const response = await xrpc(fetchHandler, testBinaryQuery)

      expect(response.success).toBe(true)
      expect(response.body).toBeInstanceOf(Uint8Array)
      expect(response.body).toEqual(bytes)
      expect(response.encoding).toBe('application/octet-stream')
      expect(response.isParsed).toBe(false)
    })

    it('returns binary body for a binary procedure', async () => {
      const bytes = new Uint8Array([10, 20, 30])
      const fetchHandler: FetchHandler = async () =>
        new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })

      const response = await xrpc(fetchHandler, testBinaryProcedure, {
        body: new Uint8Array([99]),
        encoding: 'image/png',
      })

      expect(response.success).toBe(true)
      expect(response.body).toBeInstanceOf(Uint8Array)
      expect(response.body).toEqual(bytes)
    })

    it('returns no body for a no-output query', async () => {
      const fetchHandler: FetchHandler = async () =>
        new Response(null, { status: 200 })

      const response = await xrpc(fetchHandler, testNoOutputQuery)

      expect(response.success).toBe(true)
      expect(response.status).toBe(200)
      expect(response.body).toBeUndefined()
      expect(response.encoding).toBeUndefined()
    })

    it('passes query params as URL search params', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () =>
        Response.json({ value: 'ok' }),
      )

      await xrpc(fetchHandler, testQuery, { params: { limit: 25 } })

      expect(fetchHandler).toHaveBeenCalledOnce()
      const [path] = fetchHandler.mock.calls[0]
      expect(path).toContain('/xrpc/io.example.testQuery')
      expect(path).toContain('limit=25')
    })

    it('sends POST with JSON body for procedures', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () =>
        Response.json({ id: 'new-id' }),
      )

      await xrpc(fetchHandler, testProcedure, {
        body: { text: 'test content' },
      })

      expect(fetchHandler).toHaveBeenCalledOnce()
      const [, init] = fetchHandler.mock.calls[0]
      expect(init.method).toBe('POST')
      expect(new Headers(init.headers).get('content-type')).toBe(
        'application/json',
      )
    })

    it('forwards custom headers', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () =>
        Response.json({ value: 'ok' }),
      )

      await xrpc(fetchHandler, testQuery, {
        params: { limit: 1 },
        headers: { authorization: 'Bearer token123' },
      })

      expect(fetchHandler).toHaveBeenCalledOnce()
      const [, init] = fetchHandler.mock.calls[0]
      expect(new Headers(init.headers).get('authorization')).toBe(
        'Bearer token123',
      )
    })

    it('accepts optional params as omitted', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 'ok' })

      const response = await xrpc(fetchHandler, testQuery)

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 'ok' })
    })
  })

  describe('error handling', () => {
    describe('fetch errors', () => {
      it('throws XrpcFetchError when fetchHandler throws', async () => {
        const fetchHandler: FetchHandler = async () => {
          throw new TypeError('fetch failed')
        }

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcFetchError)
          expect(err).toBeInstanceOf(XrpcInternalError)
          expect(err.cause).toBeInstanceOf(TypeError)
          expect(err.message).toContain('fetch failed')
          return true
        })
      })

      it('throws XrpcFetchError when fetchHandler rejects', async () => {
        const fetchHandler: FetchHandler = async () => {
          throw new Error('network timeout')
        }

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcFetchError)
          expect(err.message).toContain('network timeout')
          expect(err.shouldRetry()).toBe(true)
          return true
        })
      })
    })

    describe('response errors', () => {
      it('throws XrpcResponseError for 400 with valid error payload', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json(
            { error: 'TestError', message: 'bad request' },
            { status: 400 },
          )

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.status).toBe(400)
          expect(err.body).toEqual({
            error: 'TestError',
            message: 'bad request',
          })
          return true
        })
      })

      it('throws XrpcAuthenticationError for 401', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json(
            { error: 'AuthenticationRequired', message: 'Token expired' },
            { status: 401 },
          )

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcAuthenticationError)
          expect(err.status).toBe(401)
          expect(err.message).toBe('Token expired')
          return true
        })
      })

      it('throws XrpcUpstreamError for non-XRPC error response', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('Not Found', {
            status: 404,
            headers: { 'content-type': 'text/plain' },
          })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcUpstreamError)
          expect(err.message).toBe('Invalid response payload')
          return true
        })
      })

      it('throws XrpcUpstreamError for 500 without valid error payload', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('Internal Server Error', {
            status: 500,
            headers: { 'content-type': 'text/html' },
          })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcUpstreamError)
          expect(err.message).toBe('Upstream server encountered an error')
          return true
        })
      })

      it('Reflects upstream 5xx errors with valid XRPC payload', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json(
            { error: 'ServerError', message: 'Something went wrong' },
            { status: 502 },
          )

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.status).toBe(502)
          expect(err.body).toEqual({
            error: 'ServerError',
            message: 'Something went wrong',
          })
          return true
        })
      })
    })

    describe('invalid response errors', () => {
      it('throws XrpcInvalidResponseError when response body fails validation', async () => {
        // Schema expects { value: string } but we return { value: 123 }
        const fetchHandler: FetchHandler = async () =>
          Response.json({ value: 123 })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err).toBeInstanceOf(XrpcUpstreamError)
          expect(err.cause).toBeInstanceOf(Error)
          return true
        })
      })

      it('throws XrpcUpstreamError when response has wrong content-type', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('binary data', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcUpstreamError)
          expect(err.message).toContain('application/json')
          return true
        })
      })
    })

    describe('content-type header errors', () => {
      it('throws XrpcInternalError when content-type header is set', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ value: 'ok' })

        await expect(
          xrpc(fetchHandler, testQuery, {
            params: { limit: 10 },
            headers: { 'content-type': 'application/json' },
          }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInternalError)
          expect(err.cause).toBeInstanceOf(TypeError)
          return true
        })
      })
    })

    describe('response payload parsing', () => {
      it('throws XrpcUpstreamError when error response body cannot be parsed', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('not valid json', {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcUpstreamError)
          expect(err.message).toBe('Unable to parse response payload')
          assert(err.cause instanceof Error)
          expect(err.cause.message).toContain('Unexpected token')
          return true
        })
      })

      it('throws XrpcUpstreamError when success response body cannot be parsed', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('not valid json', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcUpstreamError)
          expect(err.message).toBe('Unable to parse response payload')
          assert(err.cause instanceof Error)
          expect(err.cause.message).toContain('Unexpected token')
          return true
        })
      })

      it('throws XrpcUpstreamError when schema expects no payload but got one', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ unexpected: 'data' })

        await expect(xrpc(fetchHandler, testNoOutputQuery)).rejects.toSatisfy(
          (err) => {
            assert(err instanceof XrpcUpstreamError)
            expect(err.message).toContain('no body')
            return true
          },
        )
      })

      it('throws XrpcUpstreamError when schema expects payload but response is empty', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response(null, { status: 200 })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcUpstreamError)
          expect(err.message).toContain('non-empty response')
          return true
        })
      })
    })

    describe('content-type handling', () => {
      it('parses content-type with charset parameter', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response(JSON.stringify({ value: 'hello' }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          })

        const response = await xrpc(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        expect(response.success).toBe(true)
        expect(response.body).toEqual({ value: 'hello' })
      })

      it('handles response with no content-type and empty body as no payload', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response(new ArrayBuffer(0), { status: 200 })

        const response = await xrpc(fetchHandler, testNoOutputQuery)

        expect(response.success).toBe(true)
        expect(response.body).toBeUndefined()
      })

      it('treats response with no content-type but non-empty body as binary', async () => {
        const bytes = new Uint8Array([1, 2, 3])
        const fetchHandler: FetchHandler = async () =>
          new Response(bytes, { status: 200 })

        const response = await xrpc(fetchHandler, testBinaryQuery)

        expect(response.success).toBe(true)
        expect(response.body).toBeInstanceOf(Uint8Array)
        expect(response.body).toEqual(bytes)
      })
    })

    describe('non-2xx non-4xx/5xx responses', () => {
      it('throws XrpcUpstreamError for 3xx status codes', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ value: 'redirect' }, { status: 302 })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcUpstreamError)
          expect(err.message).toBe('Invalid response status code')
          return true
        })
      })
    })
  })

  describe('validateRequest', () => {
    it('rejects invalid query params when enabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 'ok' })

      await expect(
        xrpc(fetchHandler, testQuery, {
          // @ts-expect-error intentionally passing invalid params
          params: { limit: 'not-a-number' },
          validateRequest: true,
        }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcInternalError)
        expect(err).not.toBeInstanceOf(XrpcFetchError)
        return true
      })
    })

    it('rejects invalid procedure body when enabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ id: 'abc' })

      await expect(
        xrpc(fetchHandler, testProcedure, {
          // @ts-expect-error intentionally passing invalid body
          body: { text: 123 },
          validateRequest: true,
        }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcInternalError)
        expect(err).not.toBeInstanceOf(XrpcFetchError)
        return true
      })
    })

    it('skips body validation by default (invalid body sent as-is)', async () => {
      const fetchHandler: FetchHandler = async () => Response.json({ id: 'ok' })

      // Invalid body ({ text: 123 }) is not validated client-side
      const response = await xrpc(fetchHandler, testProcedure, {
        // @ts-expect-error intentionally passing invalid body
        body: { text: 123 },
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ id: 'ok' })
    })

    it('succeeds with valid body when enabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ id: 'valid' })

      const response = await xrpc(fetchHandler, testProcedure, {
        body: { text: 'hello' },
        validateRequest: true,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ id: 'valid' })
    })
  })

  describe('validateResponse', () => {
    it('rejects invalid response body by default', async () => {
      // Schema expects { value: string } but server returns { value: 123 }
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 123 })

      await expect(
        xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcInvalidResponseError)
        expect(err).toBeInstanceOf(XrpcUpstreamError)
        return true
      })
    })

    it('accepts invalid response body when disabled', async () => {
      // Schema expects { value: string } but server returns { value: 123 }
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 123 })

      const response = await xrpc(fetchHandler, testQuery, {
        params: { limit: 10 },
        validateResponse: false,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 123 })
    })

    it('succeeds with valid response body when enabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 'hello' })

      const response = await xrpc(fetchHandler, testQuery, {
        params: { limit: 10 },
        validateResponse: true,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 'hello' })
    })
  })
})

describe(xrpcSafe, () => {
  describe('success paths', () => {
    it('returns successful result for a JSON query', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 'hello' })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 5 },
      })

      assert(result.success)
      expect(result).toBeInstanceOf(XrpcResponse)
      expect(result.body).toEqual({ value: 'hello' })
      expect(result.encoding).toBe('application/json')
      expect(result.value).toBe(result)
    })

    it('returns successful result for a JSON procedure', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ id: 'new-id' })

      const result = await xrpcSafe(fetchHandler, testProcedure, {
        body: { text: 'hello' },
      })

      assert(result.success)
      expect(result.body).toEqual({ id: 'new-id' })
    })

    it('returns successful result for a binary query', async () => {
      const bytes = new Uint8Array([5, 6, 7])
      const fetchHandler: FetchHandler = async () =>
        new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })

      const result = await xrpcSafe(fetchHandler, testBinaryQuery)

      assert(result.success)
      expect(result.body).toBeInstanceOf(Uint8Array)
      expect(result.body).toEqual(bytes)
      expect(result.isParsed).toBe(false)
    })

    it('returns successful result for a binary procedure', async () => {
      const bytes = new Uint8Array([42])
      const fetchHandler: FetchHandler = async () =>
        new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })

      const result = await xrpcSafe(fetchHandler, testBinaryProcedure, {
        body: new Uint8Array([1, 2]),
        encoding: 'image/jpeg',
      })

      assert(result.success)
      expect(result.body).toEqual(bytes)
    })

    it('returns successful result for a no-output query', async () => {
      const fetchHandler: FetchHandler = async () =>
        new Response(null, { status: 200 })

      const result = await xrpcSafe(fetchHandler, testNoOutputQuery)

      assert(result.success)
      expect(result.body).toBeUndefined()
      expect(result.encoding).toBeUndefined()
    })
  })

  describe('error handling', () => {
    describe('fetch errors', () => {
      it('returns XrpcFetchError when fetchHandler throws', async () => {
        const fetchHandler: FetchHandler = async () => {
          throw new TypeError('fetch failed')
        }

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcFetchError)
        expect(result).toBeInstanceOf(XrpcInternalError)
      })

      it('returns XrpcFetchError when fetchHandler rejects', async () => {
        const fetchHandler: FetchHandler = async () => {
          throw new Error('network timeout')
        }

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcFetchError)
        expect(result.message).toContain('network timeout')
      })
    })

    describe('response errors', () => {
      it('returns XrpcResponseError for 400 with valid error payload', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json(
            { error: 'TestError', message: 'bad request' },
            { status: 400 },
          )

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        assert(result instanceof XrpcResponseError)
        expect(result.status).toBe(400)
        expect(result.body).toEqual({
          error: 'TestError',
          message: 'bad request',
        })
      })

      it('returns XrpcAuthenticationError for 401', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json(
            { error: 'AuthenticationRequired', message: 'Token expired' },
            { status: 401 },
          )

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        assert(result instanceof XrpcResponseError)
        expect(result).toBeInstanceOf(XrpcAuthenticationError)
        expect(result.status).toBe(401)
      })

      it('returns XrpcUpstreamError for non-XRPC error response', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('Not Found', {
            status: 404,
            headers: { 'content-type': 'text/plain' },
          })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcUpstreamError)
      })

      it('returns XrpcUpstreamError for 500 without valid error payload', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('Internal Server Error', {
            status: 500,
            headers: { 'content-type': 'text/html' },
          })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcUpstreamError)
      })
    })

    describe('invalid response errors', () => {
      it('returns XrpcInvalidResponseError when response body fails validation', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ value: 123 })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcInvalidResponseError)
        expect(result).toBeInstanceOf(XrpcUpstreamError)
      })

      it('returns XrpcUpstreamError when response has wrong content-type', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('binary data', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcUpstreamError)
      })
    })

    describe('content-type header errors', () => {
      it('returns XrpcInternalError when content-type header is set', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ value: 'ok' })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
          headers: { 'content-type': 'application/json' },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcInternalError)
        expect(result.cause).toBeInstanceOf(TypeError)
      })
    })
  })

  describe('validateRequest', () => {
    it('returns XrpcInternalError for invalid query params when enabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 'ok' })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        // @ts-expect-error intentionally passing invalid params
        params: { limit: 'not-a-number' },
        validateRequest: true,
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInternalError)
      expect(result).not.toBeInstanceOf(XrpcFetchError)
    })

    it('returns XrpcInternalError for invalid body when enabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ id: 'abc' })

      const result = await xrpcSafe(fetchHandler, testProcedure, {
        // @ts-expect-error intentionally passing invalid body
        body: { text: 123 },
        validateRequest: true,
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInternalError)
      expect(result).not.toBeInstanceOf(XrpcFetchError)
    })

    it('skips body validation by default (invalid body sent as-is)', async () => {
      const fetchHandler: FetchHandler = async () => Response.json({ id: 'ok' })

      const result = await xrpcSafe(fetchHandler, testProcedure, {
        // @ts-expect-error intentionally passing invalid body
        body: { text: 123 },
      })

      assert(result.success)
      expect(result.body).toEqual({ id: 'ok' })
    })

    it('succeeds with valid body when enabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ id: 'valid' })

      const result = await xrpcSafe(fetchHandler, testProcedure, {
        body: { text: 'hello' },
        validateRequest: true,
      })

      assert(result.success)
      expect(result.body).toEqual({ id: 'valid' })
    })
  })

  describe('validateResponse', () => {
    it('returns XrpcInvalidResponseError for invalid body by default', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 123 })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result).toBeInstanceOf(XrpcUpstreamError)
    })

    it('accepts invalid response body when disabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 123 })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        validateResponse: false,
      })

      assert(result.success)
      expect(result.body).toEqual({ value: 123 })
    })

    it('succeeds with valid response body when enabled', async () => {
      const fetchHandler: FetchHandler = async () =>
        Response.json({ value: 'hello' })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        validateResponse: true,
      })

      assert(result.success)
      expect(result.body).toEqual({ value: 'hello' })
    })
  })
})
