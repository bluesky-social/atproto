import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { parseCid } from '@atproto/lex-data'
import { lexToJson } from '@atproto/lex-json'
import { l } from '@atproto/lex-schema'
import type { FetchHandler } from './agent.js'
import {
  XrpcAuthenticationError,
  XrpcFetchError,
  XrpcInternalError,
  XrpcInvalidResponseError,
  XrpcResponseError,
  XrpcResponseValidationError,
} from './errors.js'
import { XrpcResponse, XrpcStreamResponse } from './response.js'
import type { XrpcBinaryStream } from './response.js'
import { xrpc, xrpcSafe, xrpcStream, xrpcStreamSafe } from './xrpc.js'
import type { XrpcResult, XrpcStreamResult } from './xrpc.js'

// Fixtures

const rawCid = parseCid(
  'bafkreifjjcie6lypi6ny7amxnfftagclbuxndqonfipmb64f2km2devei4',
  { flavor: 'raw' },
)

const cborCid = parseCid(
  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
  { flavor: 'cbor' },
)

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

const testQueryWithDefaults = l.query(
  'io.example.testQueryWithDefaults',
  l.params({ foo: l.optional(l.withDefault(l.string(), 'foo-default')) }),
  l.jsonPayload({
    foo: l.string(),
    bar: l.optional(l.withDefault(l.string(), 'bar-default')),
  }),
)

const testQueryGetBlobRef = l.query(
  'io.example.testQueryGetBlobRef',
  l.params(),
  l.jsonPayload({
    blobRef: l.blob({
      accept: ['image/png'],
      maxSize: 10,
    }),
  }),
)

const testQueryWithInteger = l.query(
  'io.example.testQueryWithInteger',
  l.params(),
  l.jsonPayload({ seq: l.integer() }),
)

/**
 * Removes a global until disposed, to simulate environments that do not define
 * it (e.g. React Native and ReadableStream). Since Node's own fetch()
 * implementation depends on ReadableStream, Request and Response objects must
 * be created beforehand.
 */
function withoutGlobal(name: string): Disposable {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  delete (globalThis as Record<string, unknown>)[name]
  return {
    [Symbol.dispose]() {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    },
  }
}

describe(xrpc, () => {
  describe('success paths', () => {
    it('returns parsed JSON body for a query', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'hello' })
      })

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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ id: 'abc123' })
      })

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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })
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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })
      })

      const response = await xrpc(fetchHandler, testBinaryProcedure, {
        body: new Uint8Array([99]),
        encoding: 'image/png',
      })

      expect(response.success).toBe(true)
      expect(response.body).toBeInstanceOf(Uint8Array)
      expect(response.body).toEqual(bytes)
    })

    it('sends Blob bodies when the environment has no ReadableStream', async () => {
      const response = new Response(new Uint8Array([10, 20, 30]), {
        headers: { 'content-type': 'application/octet-stream' },
      })
      const fetchHandler = vi.fn<FetchHandler>(async () => response)
      const body = new Blob([new Uint8Array([99])], { type: 'image/png' })

      using _ = withoutGlobal('ReadableStream')

      const result = await xrpc(fetchHandler, testBinaryProcedure, { body })

      expect(result.body).toEqual(new Uint8Array([10, 20, 30]))
      const [, init] = fetchHandler.mock.calls[0]
      expect(init.body).toBe(body)
      expect(new Headers(init.headers).get('content-type')).toBe('image/png')
    })

    it('returns no body for a no-output query', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(null, { status: 200 })
      })

      const response = await xrpc(fetchHandler, testNoOutputQuery)

      expect(response.success).toBe(true)
      expect(response.status).toBe(200)
      expect(response.body).toBeUndefined()
      expect(response.encoding).toBeUndefined()
    })

    it('passes query params as URL search params', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

      await xrpc(fetchHandler, testQuery, { params: { limit: 25 } })

      expect(fetchHandler).toHaveBeenCalledOnce()
      const [path] = fetchHandler.mock.calls[0]
      expect(path).toContain('/xrpc/io.example.testQuery')
      expect(path).toContain('limit=25')
    })

    it('sends POST with JSON body for procedures', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ id: 'new-id' })
      })

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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

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

    it('computes headers provided as a function for every attempt', async () => {
      let calls = 0
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return ++calls === 1
          ? Response.json({ error: 'Unavailable' }, { status: 503 })
          : Response.json({ value: 'ok' })
      })

      let attempt = 0
      await xrpc(fetchHandler, testQuery, {
        headers: async () => ({ 'x-attempt': String(++attempt) }),
        maxRetries: 1,
        minRetryTimeout: 0,
      })

      expect(fetchHandler).toHaveBeenCalledTimes(2)
      const attempts = fetchHandler.mock.calls.map(([, init]) =>
        new Headers(init.headers).get('x-attempt'),
      )
      expect(attempts).toEqual(['1', '2'])
    })

    it('accepts optional params as omitted', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

      const response = await xrpc(fetchHandler, testQuery)

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 'ok' })
    })

    it('does not parse the payload of no-output queries', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ unexpected: 'data' })
      })

      const response = await xrpc(fetchHandler, testNoOutputQuery)

      expect(response.success).toBe(true)
      expect(response.body).toEqual(
        new TextEncoder().encode('{"unexpected":"data"}'),
      )
    })

    it('applies custom headers', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

      const response = await xrpc(fetchHandler, testQuery, {
        headers: {
          'atproto-proxy': 'did:plc:foo#bar',
          'atproto-accept-labelers': 'did:plc:labeler1#a,did:plc:labeler2#b',
          'x-custom-header': 'custom-value',
        },
        // "undefined" here won't affect the headers
        service: undefined,
        labelers: undefined,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 'ok' })
      expect(fetchHandler).toHaveBeenCalledOnce()

      const [, init] = fetchHandler.mock.calls[0]!
      const headers = new Headers(init.headers)

      expect(headers.get('x-custom-header')).toBe('custom-value')
      expect(headers.get('atproto-proxy')).toBe('did:plc:foo#bar')
      expect(
        headers
          .get('atproto-accept-labelers')
          ?.split(',')
          .map((s) => s.trim())
          .sort(),
      ).toEqual(['did:plc:labeler1#a', 'did:plc:labeler2#b'])
    })

    it('overrides "atproto-proxy" when "service" is provided', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

      const response = await xrpc(fetchHandler, testQuery, {
        headers: {
          'atproto-proxy': 'did:plc:foo#bar',
          'atproto-accept-labelers': 'did:plc:labeler1#a,did:plc:labeler2#b',
          'x-custom-header': 'custom-value',
        },
        service: null,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 'ok' })
      expect(fetchHandler).toHaveBeenCalledOnce()

      const [, init] = fetchHandler.mock.calls[0]!
      const headers = new Headers(init.headers)
      expect(headers.get('x-custom-header')).toBe('custom-value')
      expect(headers.get('atproto-proxy')).toBe(null)
      expect(
        headers
          .get('atproto-accept-labelers')
          ?.split(',')
          .map((s) => s.trim())
          .sort(),
      ).toEqual(['did:plc:labeler1#a', 'did:plc:labeler2#b'])
    })

    it('merges "atproto-accept-labelers" when "labelers" is provided', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

      const response = await xrpc(fetchHandler, testQuery, {
        headers: {
          'atproto-proxy': 'did:plc:foo#bar',
          'atproto-accept-labelers': 'did:plc:labeler1#a,did:plc:labeler2#b',
          'x-custom-header': 'custom-value',
        },
        labelers: ['did:plc:labeler3#c'],
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 'ok' })
      expect(fetchHandler).toHaveBeenCalledOnce()

      const [, init] = fetchHandler.mock.calls[0]!
      const headers = new Headers(init.headers)

      expect(headers.get('x-custom-header')).toBe('custom-value')
      expect(headers.get('atproto-proxy')).toBe('did:plc:foo#bar')
      expect(
        headers
          .get('atproto-accept-labelers')
          ?.split(',')
          .map((s) => s.trim())
          .sort(),
      ).toEqual([
        'did:plc:labeler1#a',
        'did:plc:labeler2#b',
        'did:plc:labeler3#c',
      ])
    })
  })

  describe('params initializer', () => {
    const requiredParamsQuery = l.query(
      'io.example.requiredParams',
      l.params({ actor: l.string() }),
      l.jsonPayload({ value: l.string() }),
    )

    it.each([
      ['a function', () => ({ limit: 25 })],
      ['an async function', async () => ({ limit: 25 })],
    ])('accepts %s returning the params', async (_, params) => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

      await xrpc(fetchHandler, testQuery, { params })

      expect(fetchHandler).toHaveBeenCalledOnce()
      const [path] = fetchHandler.mock.calls[0]
      expect(path).toBe('/xrpc/io.example.testQuery?limit=25')
    })

    it('invokes the function again for every retry', async () => {
      let attempt = 0
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return attempt < 2
          ? new Response(null, { status: 503 })
          : Response.json({ value: 'ok' })
      })

      await xrpc(fetchHandler, testQuery, {
        params: async () => ({ limit: ++attempt }),
        maxRetries: 2,
        minRetryTimeout: 0,
        retryHeaders: false,
      })

      expect(fetchHandler.mock.calls.map(([path]) => path)).toEqual([
        '/xrpc/io.example.testQuery?limit=1',
        '/xrpc/io.example.testQuery?limit=2',
      ])
    })

    it('fails without a request when the function rejects', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })
      const cause = new Error('no params')

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: async () => {
          throw cause
        },
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInternalError)
      expect(result.cause).toBe(cause)
      expect(fetchHandler).not.toHaveBeenCalled()
    })

    it('requires a function to return the required params', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

      await xrpc(fetchHandler, requiredParamsQuery, {
        params: async () => ({ actor: 'alice' }),
      })
      expect(fetchHandler.mock.calls[0][0]).toBe(
        '/xrpc/io.example.requiredParams?actor=alice',
      )

      // @ts-expect-error missing required "actor" param
      xrpc(fetchHandler, requiredParamsQuery, { params: () => ({}) }).catch(
        () => {},
      )
    })
  })

  describe('error handling', () => {
    describe('fetch errors', () => {
      it('throws XrpcFetchError when fetchHandler throws', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          throw new TypeError('fetch failed')
        })

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
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          throw new Error('network timeout')
        })

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
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json(
            { error: 'TestError', message: 'bad request' },
            { status: 400 },
          )
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.status).toBe(400)
          expect(err.toJSON()).toEqual({
            error: 'TestError',
            message: 'bad request',
          })
          return true
        })
      })

      it('throws XrpcAuthenticationError for 401', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json(
            { error: 'AuthenticationRequired', message: 'Token expired' },
            { status: 401 },
          )
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcAuthenticationError)
          expect(err.status).toBe(401)
          expect(err.message).toBe('Token expired')
          return true
        })
      })

      it('throws XrpcResponseError for non-XRPC error response', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return new Response('Not Found', {
            status: 404,
            headers: { 'content-type': 'text/plain' },
          })
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.message).toBe('Upstream server responded with a 404 error')
          return true
        })
      })

      it('throws XrpcResponseError for 500 without valid error payload', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return new Response('Internal Server Error', {
            status: 500,
            headers: { 'content-type': 'text/html' },
          })
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.message).toBe('Upstream server responded with a 500 error')
          return true
        })
      })

      it('Reflects upstream 5xx errors with valid XRPC payload', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json(
            { error: 'ServerError', message: 'Something went wrong' },
            { status: 502 },
          )
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.status).toBe(502)
          expect(err.toJSON()).toEqual({
            error: 'ServerError',
            message: 'Something went wrong',
          })
          return true
        })
      })
    })

    describe('invalid response errors', () => {
      it('throws XrpcResponseValidationError when response body fails validation', async () => {
        // Schema expects { value: string } but we return { value: 123 }
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({ value: 123 })
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseValidationError)
          expect(err).toBeInstanceOf(XrpcInvalidResponseError)
          expect(err.cause).toBeInstanceOf(Error)
          return true
        })
      })

      it('throws XrpcInvalidResponseError when response has wrong content-type', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return new Response('binary data', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          })
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toContain('application/json')
          return true
        })
      })
    })

    describe('content-type header errors', () => {
      it('throws XrpcInternalError when content-type header is set', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({ value: 'ok' })
        })

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
      it('throws XrpcInvalidResponseError when error response body cannot be parsed', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return new Response('not valid json', {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toMatch('Unable to parse response payload')
          assert(err.cause instanceof Error)
          expect(err.cause.message).toContain('Unexpected token')
          return true
        })
      })

      it('throws XrpcInvalidResponseError when success response body cannot be parsed', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return new Response('not valid json', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toMatch('Unable to parse response payload')
          assert(err.cause instanceof Error)
          expect(err.cause.message).toContain('Unexpected token')
          return true
        })
      })

      it('throws XrpcInvalidResponseError when schema expects payload but response is empty', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return new Response(null, { status: 200 })
        })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toContain('got no payload')
          return true
        })
      })
    })

    describe('content-type handling', () => {
      it('parses content-type with charset parameter', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return new Response(JSON.stringify({ value: 'hello' }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          })
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
      it('throws XrpcInvalidResponseError for 3xx status codes', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ value: 'redirect' }, { status: 302 })

        await expect(
          xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toBe('Unexpected status code 302')
          return true
        })
      })
    })
  })

  describe('validateRequest', () => {
    it('rejects invalid query params when enabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ id: 'abc' })
      })

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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ id: 'valid' })
      })

      const response = await xrpc(fetchHandler, testProcedure, {
        body: { text: 'hello' },
        validateRequest: true,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ id: 'valid' })
    })
  })

  describe('redirect', () => {
    it('follows redirects by default', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (path) => {
        return path.startsWith('/xrpc/io.example.testQuery')
          ? Response.json({ value: 'ok' })
          : Response.json({ id: 'ok' })
      })

      await xrpc(fetchHandler, testQuery)
      await xrpc(fetchHandler, testProcedure, { body: { text: 'hello' } })

      expect(fetchHandler.mock.calls.map(([, init]) => init.redirect)).toEqual([
        'follow',
        'follow',
      ])
    })

    it('passes the redirect mode to the fetch handler', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (path) => {
        return path.startsWith('/xrpc/io.example.testQuery')
          ? Response.json({ value: 'ok' })
          : Response.json({ id: 'ok' })
      })

      await xrpc(fetchHandler, testQuery, { redirect: 'error' })
      await xrpc(fetchHandler, testProcedure, {
        body: { text: 'hello' },
        redirect: 'manual',
      })

      expect(fetchHandler.mock.calls.map(([, init]) => init.redirect)).toEqual([
        'error',
        'manual',
      ])
    })

    it('does not retry unfollowed redirects', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(null, {
          status: 302,
          headers: {
            location: 'https://example.com/xrpc/io.example.testQuery',
          },
        })
      })

      await expect(
        xrpc(fetchHandler, testQuery, {
          redirect: 'manual',
          maxRetries: 2,
          minRetryTimeout: 0,
        }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcInvalidResponseError)
        expect(err.shouldRetry()).toBe(false)
        expect(err.response.headers.get('location')).toBe(
          'https://example.com/xrpc/io.example.testQuery',
        )
        return true
      })
      expect(fetchHandler).toHaveBeenCalledOnce()
    })

    describe('with the global fetch', () => {
      // Redirects /xrpc/* to /target/*, which answers with a JSON payload
      async function startServer() {
        const server = createServer((req, res) => {
          if (req.url?.startsWith('/xrpc/')) {
            res.writeHead(302, { location: `/target/${req.url.slice(6)}` })
            res.end()
          } else {
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ value: 'redirected' }))
          }
        })
        await once(server.listen(0), 'listening')
        const { port } = server.address() as AddressInfo
        return {
          service: `http://localhost:${port}`,
          async [Symbol.asyncDispose]() {
            server.closeAllConnections()
            await new Promise<void>((resolve, reject) =>
              server.close((err) => (err ? reject(err) : resolve())),
            )
          },
        }
      }

      it('follows redirects with "follow"', async () => {
        await using server = await startServer()

        const response = await xrpc(server.service, testQuery, {
          redirect: 'follow',
        })

        expect(response.body).toEqual({ value: 'redirected' })
      })

      it('fails with XrpcFetchError with "error"', async () => {
        await using server = await startServer()

        await expect(
          xrpc(server.service, testQuery, { redirect: 'error' }),
        ).rejects.toBeInstanceOf(XrpcFetchError)
      })

      it('fails with XrpcInvalidResponseError with "manual"', async () => {
        await using server = await startServer()

        await expect(
          xrpc(server.service, testQuery, { redirect: 'manual' }),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.response.status).toBe(302)
          expect(err.response.headers.get('location')).toBe(
            '/target/io.example.testQuery',
          )
          return true
        })
      })
    })
  })

  describe('validateResponse', () => {
    it('rejects invalid response body by default', async () => {
      // Schema expects { value: string } but server returns { value: 123 }
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 123 })
      })

      await expect(
        xrpc(fetchHandler, testQuery, { params: { limit: 10 } }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseValidationError)
        expect(err).toBeInstanceOf(XrpcInvalidResponseError)
        return true
      })
    })

    it('accepts invalid response body when disabled', async () => {
      // Schema expects { value: string } but server returns { value: 123 }
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 123 })
      })

      const response = await xrpc(fetchHandler, testQuery, {
        params: { limit: 10 },
        validateResponse: false,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 123 })
    })

    it('succeeds with valid response body when enabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'hello' })
      })

      const response = await xrpc(fetchHandler, testQuery, {
        params: { limit: 10 },
        validateResponse: true,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 'hello' })
    })
  })

  describe('strictResponseProcessing', () => {
    // Helper: returns a JSON response containing a float (invalid lex data)
    const validWithFloatHandler: FetchHandler = async () => {
      return Response.json({ value: 'hello', extra: 1.5 }, { status: 200 })
    }

    // Helper: returns a JSON error response containing a float
    const errorWithFloatHandler: FetchHandler = async () => {
      return Response.json(
        { error: 'TestError', message: 'test-error-description', extra: 1.5 },
        { status: 400 },
      )
    }

    it('rejects response with invalid lex data by default (strict parsing)', async () => {
      await expect(
        xrpc(validWithFloatHandler, testQuery, { params: { limit: 10 } }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcInvalidResponseError)
        expect(err.message).toMatch('Unable to parse response payload')
        expect(err.cause).toBeInstanceOf(TypeError)
        return true
      })
    })

    it('accepts response with invalid lex data when strict processing is disabled', async () => {
      const response = await xrpc(validWithFloatHandler, testQuery, {
        params: { limit: 10 },
        strictResponseProcessing: false,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({ value: 'hello', extra: 1.5 })
    })

    it('rejects response with invalid lex data when strict processing is explicitly enabled', async () => {
      await expect(
        xrpc(validWithFloatHandler, testQuery, {
          strictResponseProcessing: true,
        }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcInvalidResponseError)
        expect(err.message).toMatch('Unable to parse response payload')
        expect(err.cause).toBeInstanceOf(TypeError)
        return true
      })
    })

    it('rejects error response with invalid lex data by default', async () => {
      await expect(xrpc(errorWithFloatHandler, testQuery)).rejects.toSatisfy(
        (err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.message).toBe('test-error-description')
          return true
        },
      )
    })

    it('parses error response with invalid lex data when strict processing is disabled', async () => {
      await expect(
        xrpc(errorWithFloatHandler, testQuery, {
          params: { limit: 10 },
          strictResponseProcessing: false,
        }),
      ).rejects.toSatisfy((err) => {
        // Error response is still an error, but it should be parsed successfully
        assert(err instanceof XrpcResponseError)
        expect(err.status).toBe(400)
        expect(err.payload?.body).toEqual({
          error: 'TestError',
          message: 'test-error-description',
          extra: 1.5,
        })
        return true
      })
    })

    it('with strictResponseProcessing: false and validateResponse: true, schema validation still runs', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 3, unknownValue: 1.5 }, { status: 200 })
      })

      await expect(
        xrpc(fetchHandler, testQuery, {
          params: { limit: 10 },
          strictResponseProcessing: false,
          validateResponse: true,
        }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseValidationError)
        expect(err).toBeInstanceOf(XrpcInvalidResponseError)
        return true
      })
    })

    it('with strictResponseProcessing: false and validateResponse: false, schema validation is skipped', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json(
          {
            // Invalid value
            value: 3,
            // Non-strict Lex Data values:
            unknownValue: 1.2,
            foo: { $bytes: 3 },
          },
          { status: 200 },
        )
      })

      const response = await xrpc(fetchHandler, testQuery, {
        params: { limit: 10 },
        strictResponseProcessing: false,
        validateResponse: false,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual({
        value: 3,
        unknownValue: 1.2,
        foo: { $bytes: 3 },
      })

      // @NOTE "validateResponse: false" basically acts as type casting
      expectTypeOf(response.body).toMatchObjectType<{
        value: string
      }>()
    })

    it('with strictResponseProcessing: true and validateResponse: false, strict parsing still applies', async () => {
      await expect(
        xrpc(validWithFloatHandler, testQuery, {
          params: { limit: 10 },
          strictResponseProcessing: true,
          validateResponse: false,
        }),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcInvalidResponseError)
        expect(err.message).toMatch('Unable to parse response payload')
        return true
      })
    })

    it('does not affect binary responses', async () => {
      const bytes = new Uint8Array([1, 2, 3])

      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })
      })

      const response = await xrpc(fetchHandler, testBinaryQuery, {
        strictResponseProcessing: false,
      })

      expect(response.success).toBe(true)
      expect(response.body).toEqual(bytes)
    })
  })
})

describe(xrpcSafe, () => {
  describe('success paths', () => {
    it('returns successful result for a JSON query', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'hello' })
      })

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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ id: 'new-id' })
      })

      const result = await xrpcSafe(fetchHandler, testProcedure, {
        body: { text: 'hello' },
      })

      assert(result.success)
      expect(result.body).toEqual({ id: 'new-id' })
    })

    it('returns successful result for a binary query', async () => {
      const bytes = new Uint8Array([5, 6, 7])
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })
      })

      const result = await xrpcSafe(fetchHandler, testBinaryQuery)

      assert(result.success)
      expect(result.body).toBeInstanceOf(Uint8Array)
      expect(result.body).toEqual(bytes)
      expect(result.isParsed).toBe(false)
    })

    it('returns successful result for a binary procedure', async () => {
      const bytes = new Uint8Array([42])
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })
      })

      const result = await xrpcSafe(fetchHandler, testBinaryProcedure, {
        body: new Uint8Array([1, 2]),
        encoding: 'image/jpeg',
      })

      assert(result.success)
      expect(result.body).toEqual(bytes)
    })

    it('returns successful result for a no-output query', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(null, { status: 200 })
      })

      const result = await xrpcSafe(fetchHandler, testNoOutputQuery)

      assert(result.success)
      expect(result.body).toBeUndefined()
      expect(result.encoding).toBeUndefined()
    })
  })

  describe('error handling', () => {
    describe('fetch errors', () => {
      it('returns XrpcFetchError when fetchHandler throws', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          throw new TypeError('fetch failed')
        })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcFetchError)
        expect(result).toBeInstanceOf(XrpcInternalError)
      })

      it('returns XrpcFetchError when fetchHandler rejects', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          throw new Error('network timeout')
        })

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
        expect(result.response.status).toBe(400)
        expect(result.toJSON()).toEqual({
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
        expect(result.response.status).toBe(401)
      })

      it('returns XrpcResponseError for non-XRPC error response', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('Not Found', {
            status: 404,
            headers: { 'content-type': 'text/plain' },
          })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcResponseError)
      })

      it('returns XrpcResponseError for 500 without valid error payload', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('Internal Server Error', {
            status: 500,
            headers: { 'content-type': 'text/html' },
          })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcResponseError)
        expect(result.error).toBe('InternalServerError')
        expect(result.message).toMatch(
          'Upstream server responded with a 500 error',
        )
      })
    })

    describe('invalid response errors', () => {
      it('returns XrpcResponseValidationError when response body fails validation', async () => {
        const fetchHandler: FetchHandler = async () =>
          Response.json({ value: 123 })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcResponseValidationError)
        expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      })

      it('returns XrpcInvalidResponseError when response has wrong content-type', async () => {
        const fetchHandler: FetchHandler = async () =>
          new Response('binary data', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          })

        const result = await xrpcSafe(fetchHandler, testQuery, {
          params: { limit: 10 },
        })

        assert(!result.success)
        expect(result).toBeInstanceOf(XrpcInvalidResponseError)
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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'ok' })
      })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        // @ts-expect-error intentionally passing invalid params
        params: { limit: 'not-a-number' },
        validateRequest: true,
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInternalError)
      expect(result).not.toBeInstanceOf(XrpcFetchError)
      expect(fetchHandler).not.toHaveBeenCalled()
    })

    it('returns XrpcInternalError for invalid body when enabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ id: 'abc' })
      })

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
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ id: 'valid' })
      })

      const result = await xrpcSafe(fetchHandler, testProcedure, {
        body: { text: 'hello' },
        validateRequest: true,
      })

      assert(result.success)
      expect(result.body).toEqual({ id: 'valid' })
    })
  })

  describe('validateResponse', () => {
    it('returns XrpcResponseValidationError for invalid body by default', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 123 })
      })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcResponseValidationError)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
    })

    it('accepts invalid response body when disabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 123 })
      })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        validateResponse: false,
      })

      assert(result.success)
      expect(result.body).toEqual({ value: 123 })
    })

    it('succeeds with valid response body when enabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 'hello' })
      })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        validateResponse: true,
      })

      assert(result.success)
      expect(result.body).toEqual({ value: 'hello' })
    })

    it('applies defaults', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (path) => {
        const url = new URL(path, 'http://localhost')
        const foo = url.searchParams.get('foo')

        // default applied while building the request
        expect(foo).toBe('foo-default')

        return Response.json({ foo: 'foo-value' })
      })

      const result = await xrpcSafe(fetchHandler, testQueryWithDefaults, {
        params: {},
        validateResponse: true,
      })

      expect(fetchHandler).toHaveBeenCalled()
      assert(result.success)
      expect(result.body).toEqual({
        bar: 'bar-default', // default applied while parsing the response
        foo: 'foo-value',
      })
    })

    it('sends params as given with validateRequest: false', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (path) => {
        const url = new URL(path, 'http://localhost')

        // no default applied while building the request
        expect(url.searchParams.has('foo')).toBe(false)

        return Response.json({ foo: 'foo-value' })
      })

      const result = await xrpcSafe(fetchHandler, testQueryWithDefaults, {
        params: {},
        validateRequest: false,
      })

      expect(fetchHandler).toHaveBeenCalled()
      assert(result.success)
    })
  })

  describe('blob constraints', () => {
    it('rejects invalid blob refs', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        // missing properties jere
        return Response.json({ blobRef: { $type: 'blob' } })
      })

      const result = await xrpcSafe(fetchHandler, testQueryGetBlobRef)
      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result.message).toMatch('Unable to parse response payload')
      assert(result.cause instanceof TypeError)
      expect(result.cause.message).toBe('Invalid blob object')
    })

    it('rejects blob-refs with cbor data CIDs', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json(
          lexToJson({
            blobRef: {
              $type: 'blob',
              // ref should be a "raw" CID to be strictly valid
              ref: cborCid,
              mimeType: 'image/png',
              size: 1,
            },
          }),
        )
      })

      const result = await xrpcSafe(fetchHandler, testQueryGetBlobRef)
      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result.message).toMatch('Unable to parse response payload')
      assert(result.cause instanceof TypeError)
      expect(result.cause.message).toBe('Invalid blob object')
    })

    it('enforces blob mime-type constraint by default', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json(
          lexToJson({
            blobRef: {
              $type: 'blob',
              ref: rawCid,
              mimeType: 'invalid/mime',
              size: 10,
            },
          }),
        )
      })

      const result = await xrpcSafe(fetchHandler, testQueryGetBlobRef)
      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result.message).toBe(
        'Invalid response payload: Expected "image/png" (got "invalid/mime") at $.blobRef.mimeType',
      )
    })

    it('enforces blob size constraint by default', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json(
          lexToJson({
            blobRef: {
              $type: 'blob',
              ref: rawCid,
              mimeType: 'image/png',
              size: 100,
            },
          }),
        )
      })

      const result = await xrpcSafe(fetchHandler, testQueryGetBlobRef)
      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result.message).toBe(
        'Invalid response payload: blob too big (maximum 10, got 100) at $.blobRef',
      )
    })

    it('ignores blob constraints in non-strict mode', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json(
          lexToJson({
            blobRef: {
              $type: 'blob',
              ref: rawCid,
              mimeType: 'invalid/mime',
              size: 100,
            },
          }),
        )
      })

      const result = await xrpcSafe(fetchHandler, testQueryGetBlobRef, {
        strictResponseProcessing: false,
      })

      assert(result.success)
      expectTypeOf(result.body).toEqualTypeOf<{ blobRef: l.BlobRef }>()
      expect(result.body).toEqual({
        blobRef: {
          $type: 'blob',
          ref: rawCid,
          mimeType: 'invalid/mime',
          size: 100,
        },
      })
    })

    it('transforms legacy blobs in non-strict mode', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({
          blobRef: {
            cid: rawCid.toString(),
            mimeType: 'invalid/mime',
          },
        })
      })

      const result = await xrpcSafe(fetchHandler, testQueryGetBlobRef, {
        strictResponseProcessing: false,
      })

      assert(result.success)
      expectTypeOf(result.body).toEqualTypeOf<{ blobRef: l.BlobRef }>()
      expect(result.body).toEqual({
        blobRef: {
          cid: rawCid.toString(),
          mimeType: 'invalid/mime',
        },
      })
    })

    it('allows blob-refs with negative size in non-strict mode', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({
          blobRef: {
            $type: 'blob',
            ref: { $link: rawCid.toString() },
            mimeType: 'invalid/mime',
            size: -1,
          },
        })
      })

      const result = await xrpcSafe(fetchHandler, testQueryGetBlobRef, {
        strictResponseProcessing: false,
      })

      assert(result.success)
      expectTypeOf(result.body).toEqualTypeOf<{ blobRef: l.BlobRef }>()
      expect(result.body).toEqual({
        blobRef: {
          $type: 'blob',
          ref: rawCid,
          mimeType: 'invalid/mime',
          size: -1,
        },
      })
    })
  })

  describe('strictResponseProcessing', () => {
    const jsonResponseWithFloat: FetchHandler = async () => {
      return Response.json({ value: 'hello', extra: 1.5 }, { status: 200 })
    }

    const jsonErrorResponseWithFloat: FetchHandler = async () => {
      return Response.json(
        { error: 'TestError', message: 'test-error-description', extra: 1.5 },
        { status: 400 },
      )
    }

    it('returns error for invalid lex data by default (strict parsing)', async () => {
      const fetchHandler = vi.fn<FetchHandler>(jsonResponseWithFloat)

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result.message).toMatch('Unable to parse response payload')
      assert(result.cause instanceof TypeError)
      expect(result.cause.message).toBe('Invalid non-integer number: 1.5')
    })

    it('accepts response with invalid lex data when strict processing is disabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(jsonResponseWithFloat)

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        strictResponseProcessing: false,
      })

      assert(result.success)
      expect(result.body).toEqual({ value: 'hello', extra: 1.5 })
    })

    it('returns error for invalid lex data when strict processing is explicitly enabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(jsonResponseWithFloat)

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        strictResponseProcessing: true,
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result.message).toMatch('Unable to parse response payload')
      assert(result.cause instanceof TypeError)
      expect(result.cause.message).toBe('Invalid non-integer number: 1.5')
    })

    it('returns error for error response with invalid lex data by default', async () => {
      const fetchHandler = vi.fn<FetchHandler>(jsonErrorResponseWithFloat)

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcResponseError)
      expect(result.message).toBe('test-error-description')
    })

    it('parses error response with invalid lex data when strict processing is disabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(jsonErrorResponseWithFloat)

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        strictResponseProcessing: false,
      })

      assert(!result.success)
      assert(result instanceof XrpcResponseError)
      expect(result.response.status).toBe(400)
      expect(result.message).toBe('test-error-description')
    })

    it('with strictResponseProcessing: false and validateResponse: true, schema validation still runs', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 1.5 }, { status: 200 })
      })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        strictResponseProcessing: false,
        validateResponse: true,
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcResponseValidationError)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
    })

    it('with strictResponseProcessing: false and validateResponse: false, schema validation is skipped', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ value: 1.5 }, { status: 200 })
      })

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        strictResponseProcessing: false,
        validateResponse: false,
      })

      assert(result.success)
      expect(result.body).toEqual({ value: 1.5 })
    })

    it('with strictResponseProcessing: true and validateResponse: false, strict parsing still applies', async () => {
      const fetchHandler = vi.fn<FetchHandler>(jsonResponseWithFloat)

      const result = await xrpcSafe(fetchHandler, testQuery, {
        params: { limit: 10 },
        strictResponseProcessing: true,
        validateResponse: false,
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result.message).toMatch('Unable to parse response payload')
      assert(result.cause instanceof TypeError)
      expect(result.cause.message).toBe('Invalid non-integer number: 1.5')
    })

    // 64-bit integers are valid per the data model, and emitted in practice
    // (e.g. relay listHosts `seq`), but exceed Number.MAX_SAFE_INTEGER
    const jsonResponseWithUnsafeInteger: FetchHandler = async () => {
      return new Response('{"seq":459639262114836124}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    it('returns error for unsafe integers by default (strict parsing)', async () => {
      const fetchHandler = vi.fn<FetchHandler>(jsonResponseWithUnsafeInteger)

      const result = await xrpcSafe(fetchHandler, testQueryWithInteger, {})

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInvalidResponseError)
      expect(result.message).toMatch('Unable to parse response payload')
    })

    it('accepts and validates unsafe integers when strict processing is disabled', async () => {
      const fetchHandler = vi.fn<FetchHandler>(jsonResponseWithUnsafeInteger)

      const result = await xrpcSafe(fetchHandler, testQueryWithInteger, {
        strictResponseProcessing: false,
        validateResponse: true,
      })

      assert(result.success)
      expect(result.body).toEqual({ seq: Number('459639262114836124') })
    })
  })

  describe('retries', () => {
    it('retries retryable failures and releases every failed response body', async () => {
      const responses: Response[] = []
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        const response =
          responses.length < 2
            ? Response.json({ error: 'NotEnoughResources' }, { status: 503 })
            : new Response(new Uint8Array([1, 2, 3]), {
                headers: { 'content-type': 'application/octet-stream' },
              })
        responses.push(response)
        return response
      })

      const result = await xrpcSafe(fetchHandler, testBinaryQuery, {
        maxRetries: 2,
        minRetryTimeout: 0,
      })

      assert(result.success)
      expect(result.body).toEqual(new Uint8Array([1, 2, 3]))
      expect(fetchHandler).toHaveBeenCalledTimes(3)
      expect(responses.map((r) => r.bodyUsed)).toEqual([true, true, true])
    })

    it('returns the last failure once maxRetries is reached', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () =>
        Response.json({ error: 'NotEnoughResources' }, { status: 503 }),
      )

      const result = await xrpcSafe(fetchHandler, testBinaryQuery, {
        maxRetries: 1,
        minRetryTimeout: 0,
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcResponseError)
      expect(fetchHandler).toHaveBeenCalledTimes(2)
    })

    it('does not retry non-retryable failures', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () =>
        Response.json({ error: 'InvalidRequest' }, { status: 400 }),
      )

      const result = await xrpcSafe(fetchHandler, testBinaryQuery, {
        maxRetries: 2,
        minRetryTimeout: 0,
      })

      assert(!result.success)
      expect(fetchHandler).toHaveBeenCalledOnce()
    })
  })
})

describe(xrpcStream, () => {
  const bytes = new Uint8Array([1, 2, 3])
  const binaryResponse: FetchHandler = async () =>
    new Response(bytes, {
      headers: { 'content-type': 'application/octet-stream' },
    })

  it('returns binary payloads as an unread stream', async () => {
    const response = await xrpcStream(binaryResponse, testBinaryProcedure, {
      body: new Uint8Array([99]),
      encoding: 'image/png',
    })

    expect(response).toBeInstanceOf(XrpcStreamResponse)
    expect(response).not.toBeInstanceOf(XrpcResponse)
    expectTypeOf(response.body).toEqualTypeOf<XrpcBinaryStream>()
    assert(response.body instanceof ReadableStream)
    const result = await new Response(response.body).arrayBuffer()
    expect(new Uint8Array(result)).toEqual(bytes)
  })

  it('rejects methods returning JSON, without sending the request', async () => {
    const fetchHandler = vi.fn<FetchHandler>()

    await expect(
      // @ts-expect-error not a binary output
      xrpcStream(fetchHandler, testQuery, {}),
    ).rejects.toSatisfy((err) => {
      assert(err instanceof XrpcInternalError)
      expect(err.shouldRetry()).toBe(false)
      assert(err.cause instanceof TypeError)
      expect(err.cause.message).toBe(
        `XRPC method "${testQuery.nsid}" does not declare a binary output`,
      )
      return true
    })
    expect(fetchHandler).not.toHaveBeenCalled()
  })

  it('streams the payload of methods without an output encoding', async () => {
    const fetchHandler: FetchHandler = async () =>
      Response.json({ unexpected: 'data' })

    const response = await xrpcStream(fetchHandler, testNoOutputQuery)

    expectTypeOf(response.body).toEqualTypeOf<undefined | XrpcBinaryStream>()
    assert(response.body)
    const result = await new Response(response.body).arrayBuffer()
    expect(new Uint8Array(result)).toEqual(
      new TextEncoder().encode('{"unexpected":"data"}'),
    )
  })

  it('preserves excess property checks', async () => {
    await using _ = await xrpcStream(binaryResponse, testBinaryQuery, {
      // @ts-expect-error unknown option
      signl: undefined,
    })
  })

  it('throws failures', async () => {
    const response = Response.json(
      { error: 'InvalidRequest', message: 'bad request' },
      { status: 400 },
    )

    await expect(
      xrpcStream(async () => response, testBinaryQuery),
    ).rejects.toBeInstanceOf(XrpcResponseError)
    expect(response.bodyUsed).toBe(true)
  })
})

describe(xrpcStreamSafe, () => {
  const bytes = new Uint8Array([1, 2, 3])

  it('returns disposable successful results', async () => {
    const response = new Response(bytes, {
      headers: { 'content-type': 'application/octet-stream' },
    })

    {
      await using result = await xrpcStreamSafe(
        async () => response,
        testBinaryQuery,
      )

      expectTypeOf(result).toEqualTypeOf<
        XrpcStreamResult<typeof testBinaryQuery>
      >()
      assert(result.success)
      expect(result.body).toBe(response.body)
      expect(response.bodyUsed).toBe(false)
    }

    expect(response.bodyUsed).toBe(true)
  })

  it('returns disposable failures', async () => {
    {
      await using result = await xrpcStreamSafe(
        async () => Response.json({ error: 'InvalidRequest' }, { status: 400 }),
        testBinaryQuery,
      )

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcResponseError)
    }
  })

  it('is the only variant returning disposable results', () => {
    expectTypeOf<XrpcStreamResult<typeof testBinaryQuery>>().toExtend<
      AsyncDisposable | Disposable
    >()
    expectTypeOf<XrpcResult<typeof testBinaryQuery>>().not.toExtend<
      AsyncDisposable | Disposable
    >()
  })

  describe('retries', () => {
    it('releases every failed response body', async () => {
      const responses: Response[] = []
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        const response =
          responses.length < 2
            ? Response.json({ error: 'NotEnoughResources' }, { status: 503 })
            : new Response(bytes, {
                headers: { 'content-type': 'application/octet-stream' },
              })
        responses.push(response)
        return response
      })

      await using result = await xrpcStreamSafe(fetchHandler, testBinaryQuery, {
        maxRetries: 2,
        minRetryTimeout: 0,
      })

      assert(result.success)
      expectTypeOf(result.body).toEqualTypeOf<XrpcBinaryStream>()
      expect(result.body).toBe(responses[2].body)
      expect(responses.map((r) => r.bodyUsed)).toEqual([true, true, false])

      result.cancel()
      expect(responses[2].bodyUsed).toBe(true)
    })

    it('does not retry when streaming is not supported', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        const response = new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })
        // e.g. React Native's built-in fetch
        Object.defineProperty(response, 'body', { value: undefined })
        return response
      })

      const result = await xrpcStreamSafe(fetchHandler, testBinaryQuery, {
        maxRetries: 2,
        minRetryTimeout: 0,
      })

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInternalError)
      expect(fetchHandler).toHaveBeenCalledOnce()
    })

    it('returns failures when the environment has no ReadableStream', async () => {
      const response = new Response(bytes, {
        headers: { 'content-type': 'application/octet-stream' },
      })
      // e.g. React Native's built-in fetch
      Object.defineProperty(response, 'body', { value: undefined })

      using _ = withoutGlobal('ReadableStream')

      const result = await xrpcStreamSafe(
        async () => response,
        testBinaryQuery,
        { maxRetries: 2, minRetryTimeout: 0 },
      )

      assert(!result.success)
      expect(result).toBeInstanceOf(XrpcInternalError)
    })
  })
})
