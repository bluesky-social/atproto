import { assert, describe, expect, it } from 'vitest'
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

describe(xrpc, () => {
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

    describe('input validation errors', () => {
      it('throws XrpcInternalError when query params are invalid', async () => {
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

      it('throws XrpcInternalError when procedure input body is invalid', async () => {
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
  })
})

describe(xrpcSafe, () => {
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

    describe('input validation errors', () => {
      it('returns XrpcInternalError when query params are invalid', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ value: 'ok' })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          // @ts-expect-error intentionally passing invalid params
          params: { limit: 'not-a-number' },
          validateRequest: true,
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcInternalError)
      })

      it('returns XrpcInternalError when procedure input body is invalid', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ id: 'abc' })

        const result = await xrpcSafe(fetchHandler, testProcedure, {
          // @ts-expect-error intentionally passing invalid body
          body: { text: 123 },
          validateRequest: true,
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcInternalError)
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
})
