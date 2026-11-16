import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { type LexValue, l } from '@atproto/lex-schema'
import {
  XrpcAuthenticationError,
  XrpcInternalError,
  XrpcInvalidResponseError,
  XrpcResponseError,
  XrpcResponseValidationError,
} from './errors.js'
import { XrpcResponse } from './response.js'
import type { XrpcBinaryStream } from './response.js'

// Fixtures

const jsonQuery = l.query(
  'io.example.jsonQuery',
  l.params(),
  l.jsonPayload({ value: l.string() }),
)

const binaryQuery = l.query(
  'io.example.binaryQuery',
  l.params(),
  l.payload('application/octet-stream', undefined),
)

const anyQuery = l.query(
  'io.example.anyQuery',
  l.params(),
  l.payload('*/*', undefined),
)

const imageQuery = l.query(
  'io.example.imageQuery',
  l.params(),
  l.payload('image/*', undefined),
)

const noOutputQuery = l.query(
  'io.example.noOutputQuery',
  l.params(),
  l.payload(),
)

const bytes = new Uint8Array([1, 2, 3])

/**
 * Builds a response whose body source records cancellations. Unless `close` is
 * set, the stream is left open so that cancelling it reaches the source.
 */
function trackedResponse(
  init?: ResponseInit,
  { chunks = [bytes], close = false } = {},
) {
  const cancel = vi.fn<UnderlyingSourceCancelCallback>()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      if (close) controller.close()
    },
    cancel,
  })
  return { response: new Response(body, init), cancel }
}

/**
 * Simulates fetch implementations that do not expose the body as a stream
 * (e.g. React Native's built-in fetch).
 */
function withoutBodyStream(response: Response): Response {
  Object.defineProperty(response, 'body', { value: undefined })
  return response
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const chunks: number[] = []
  for await (const chunk of stream) chunks.push(...chunk)
  return new Uint8Array(chunks)
}

describe(XrpcResponse.fromFetchResponse, () => {
  describe('buffer mode (default)', () => {
    describe('success', () => {
      it('parses JSON payloads', async () => {
        const response = Response.json({ value: 'hello' })

        const result = await XrpcResponse.fromFetchResponse(jsonQuery, response)

        expect(result.payload).toEqual({
          encoding: 'application/json',
          body: { value: 'hello' },
        })
        expect(response.bodyUsed).toBe(true)
      })

      it('returns binary payloads as Uint8Array', async () => {
        const response = new Response(bytes, {
          headers: { 'content-type': 'application/octet-stream' },
        })

        const result = await XrpcResponse.fromFetchResponse(
          binaryQuery,
          response,
        )

        expect(result.encoding).toBe('application/octet-stream')
        expect(result.body).toBeInstanceOf(Uint8Array)
        expect(result.body).toEqual(bytes)
        expect(response.bodyUsed).toBe(true)
      })

      it('accepts any encoding for "*/*" outputs', async () => {
        const response = new Response(bytes, {
          headers: { 'content-type': 'image/png' },
        })

        const result = await XrpcResponse.fromFetchResponse(anyQuery, response)

        expect(result.encoding).toBe('image/png')
        expect(result.body).toEqual(bytes)
      })

      it('does not parse JSON content for "*/*" outputs', async () => {
        const response = Response.json({ value: 'hello' })

        const result = await XrpcResponse.fromFetchResponse(anyQuery, response)

        expect(result.encoding).toBe('application/json')
        expect(result.body).toBeInstanceOf(Uint8Array)
        expect(result.body).toEqual(
          new TextEncoder().encode('{"value":"hello"}'),
        )
      })

      it('accepts matching encodings for "type/*" outputs', async () => {
        const response = new Response(bytes, {
          headers: { 'content-type': 'image/jpeg' },
        })

        const result = await XrpcResponse.fromFetchResponse(
          imageQuery,
          response,
        )

        expect(result.encoding).toBe('image/jpeg')
        expect(result.body).toEqual(bytes)
      })

      it('treats a non-empty body without content-type as application/octet-stream', async () => {
        const response = new Response(bytes)

        const result = await XrpcResponse.fromFetchResponse(anyQuery, response)

        expect(result.encoding).toBe('application/octet-stream')
        expect(result.body).toEqual(bytes)
      })

      it('returns no payload for a null body', async () => {
        const response = new Response(null, { status: 204 })

        const result = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          response,
        )

        expect(result.status).toBe(204)
        expect(result.payload).toBeUndefined()
      })

      it('returns no payload for an empty body without content-type', async () => {
        const response = new Response(new Uint8Array(0))

        const result = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          response,
        )

        expect(result.payload).toBeUndefined()
        expect(response.bodyUsed).toBe(true)
      })

      it('returns no payload for an empty body with "content-length: 0"', async () => {
        const response = new Response(new Uint8Array(0), {
          headers: { 'content-length': '0' },
        })

        const result = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          response,
        )

        expect(result.payload).toBeUndefined()
      })

      it('parses JSON loosely for undeclared outputs', async () => {
        const response = Response.json({ value: 1.5 })

        const result = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          response,
        )

        expect(result.payload).toEqual({
          encoding: 'application/json',
          body: { value: 1.5 },
        })
      })

      it('returns binary payloads for undeclared outputs with non-JSON content', async () => {
        const response = new Response(bytes, {
          headers: { 'content-type': 'text/plain' },
        })

        const result = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          response,
        )

        expect(result.encoding).toBe('text/plain')
        expect(result.body).toEqual(bytes)
      })
    })

    describe('failure', () => {
      it('rejects mismatching encodings with the buffered payload', async () => {
        const response = new Response(bytes, {
          headers: { 'content-type': 'image/png' },
        })

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toBe(
            'Expected "application/octet-stream" response (got "image/png")',
          )
          expect(err.payload).toEqual({ encoding: 'image/png', body: bytes })
          return true
        })
        expect(response.bodyUsed).toBe(true)
      })

      it('rejects empty bodies for declared outputs', async () => {
        const response = new Response(new Uint8Array(0))

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toBe(
            'Expected "application/octet-stream" response (got no payload)',
          )
          expect(err.payload).toBeUndefined()
          return true
        })
      })

      it('rejects non-empty bodies without content-type for JSON outputs', async () => {
        const response = new Response(bytes)

        await expect(
          XrpcResponse.fromFetchResponse(jsonQuery, response),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toBe(
            'Expected "application/json" response (got "application/octet-stream")',
          )
          return true
        })
      })

      it('rejects invalid content-type headers', async () => {
        const response = new Response(bytes, {
          headers: { 'content-type': 'invalid' },
        })

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toBe(
            'Unable to parse response payload: Invalid content-type "invalid" in response',
          )
          expect(err.payload).toBeUndefined()
          return true
        })
        expect(response.bodyUsed).toBe(true)
      })

      it('rejects unparsable JSON payloads', async () => {
        const response = new Response('not json', {
          headers: { 'content-type': 'application/json' },
        })

        await expect(
          XrpcResponse.fromFetchResponse(jsonQuery, response),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toMatch('Unable to parse response payload')
          return true
        })
        expect(response.bodyUsed).toBe(true)
      })

      it('rejects payloads that fail schema validation', async () => {
        const response = Response.json({ value: 123 })

        await expect(
          XrpcResponse.fromFetchResponse(jsonQuery, response),
        ).rejects.toBeInstanceOf(XrpcResponseValidationError)
        expect(response.bodyUsed).toBe(true)
      })

      it('rejects 3xx responses and cancels their body', async () => {
        const response = new Response(bytes, {
          status: 302,
          headers: { 'content-type': 'application/octet-stream' },
        })

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toBe('Unexpected status code 302')
          expect(err.payload).toBeUndefined()
          return true
        })
        expect(response.bodyUsed).toBe(true)
      })

      it('turns 4xx/5xx responses into XrpcResponseError with a parsed JSON payload', async () => {
        const response = Response.json(
          { error: 'NotFound', message: 'nope' },
          { status: 404 },
        )

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.payload).toEqual({
            encoding: 'application/json',
            body: { error: 'NotFound', message: 'nope' },
          })
          return true
        })
        expect(response.bodyUsed).toBe(true)
      })

      it('turns 4xx/5xx responses into XrpcResponseError with a binary payload', async () => {
        const response = new Response(bytes, {
          status: 500,
          headers: { 'content-type': 'text/html' },
        })

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.payload).toEqual({ encoding: 'text/html', body: bytes })
          return true
        })
        expect(response.bodyUsed).toBe(true)
      })

      it('turns 401 responses into XrpcAuthenticationError', async () => {
        const response = Response.json(
          { error: 'AuthenticationRequired' },
          { status: 401 },
        )

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response),
        ).rejects.toBeInstanceOf(XrpcAuthenticationError)
        expect(response.bodyUsed).toBe(true)
      })

      it('does not wait for the cancellation of cloned bodies to settle', async () => {
        const response = new Response(bytes, { status: 302 })
        // Cancelling one branch of a tee'd body only settles once every branch
        // was consumed or cancelled.
        const clone = response.clone()

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response),
        ).rejects.toBeInstanceOf(XrpcInvalidResponseError)

        await clone.body?.cancel()
      })
    })
  })

  describe('stream mode', () => {
    const streamMode = { responseType: 'stream' } as const

    describe('success', () => {
      it('returns binary payloads as the unread body stream', async () => {
        const { response, cancel } = trackedResponse(
          { headers: { 'content-type': 'application/octet-stream' } },
          { close: true },
        )

        const result = await XrpcResponse.fromFetchResponse(
          binaryQuery,
          response,
          { responseType: 'stream' },
        )

        expectTypeOf(result.body).toEqualTypeOf<XrpcBinaryStream>()
        expect(result.encoding).toBe('application/octet-stream')
        expect(result.body).toBe(response.body)
        expect(response.bodyUsed).toBe(false)
        await expect(readStream(result.body)).resolves.toEqual(bytes)
        expect(cancel).not.toHaveBeenCalled()
      })

      it('streams JSON content for "*/*" outputs', async () => {
        const response = Response.json({ value: 'hello' })

        const result = await XrpcResponse.fromFetchResponse(
          anyQuery,
          response,
          streamMode,
        )

        expect(result.encoding).toBe('application/json')
        await expect(readStream(result.body)).resolves.toEqual(
          new TextEncoder().encode('{"value":"hello"}'),
        )
      })

      it('still parses and validates JSON payloads', async () => {
        const response = Response.json({ value: 'hello' })

        const result = await XrpcResponse.fromFetchResponse(
          jsonQuery,
          response,
          streamMode,
        )

        expectTypeOf(result.body).toEqualTypeOf<{ value: string }>()
        expect(result.body).toEqual({ value: 'hello' })
        expect(response.bodyUsed).toBe(true)
      })

      it('parses JSON and streams other payloads for undeclared outputs', async () => {
        const json = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          Response.json({ value: 1.5 }),
          streamMode,
        )

        expectTypeOf(json.body).toEqualTypeOf<
          undefined | LexValue | XrpcBinaryStream
        >()
        expect(json.body).toEqual({ value: 1.5 })

        const binary = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          new Response(bytes, { headers: { 'content-type': 'text/plain' } }),
          streamMode,
        )

        assert(binary.body instanceof ReadableStream)
        await expect(readStream(binary.body)).resolves.toEqual(bytes)
      })

      it('streams a non-empty body without content-type as application/octet-stream', async () => {
        const response = new Response(bytes)

        const result = await XrpcResponse.fromFetchResponse(
          anyQuery,
          response,
          streamMode,
        )

        expect(result.encoding).toBe('application/octet-stream')
        await expect(readStream(result.body)).resolves.toEqual(bytes)
      })

      it('returns no payload for a null body without content-type', async () => {
        const response = new Response(null, { status: 204 })

        const result = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          response,
          streamMode,
        )

        expect(result.payload).toBeUndefined()
      })

      it('returns no payload, and cancels the body, for "content-length: 0" without content-type', async () => {
        const { response, cancel } = trackedResponse(
          { headers: { 'content-length': '0' } },
          { chunks: [] },
        )

        const result = await XrpcResponse.fromFetchResponse(
          noOutputQuery,
          response,
          streamMode,
        )

        expect(result.payload).toBeUndefined()
        expect(cancel).toHaveBeenCalledOnce()
      })

      it('returns an empty stream for a null body with content-type', async () => {
        const response = new Response(null, {
          status: 204,
          headers: { 'content-type': 'image/png' },
        })

        const result = await XrpcResponse.fromFetchResponse(
          anyQuery,
          response,
          streamMode,
        )

        expect(result.encoding).toBe('image/png')
        await expect(readStream(result.body)).resolves.toEqual(
          new Uint8Array(0),
        )
      })

      it('does not require stream support when no payload is streamed', async () => {
        const response = withoutBodyStream(Response.json({ value: 'hello' }))

        const result = await XrpcResponse.fromFetchResponse(
          jsonQuery,
          response,
          streamMode,
        )

        expect(result.body).toEqual({ value: 'hello' })
      })
    })

    describe('failure', () => {
      it('cancels the body, and omits the payload, on mismatching encodings', async () => {
        const { response, cancel } = trackedResponse({
          headers: { 'content-type': 'image/png' },
        })

        const error = await XrpcResponse.fromFetchResponse(
          binaryQuery,
          response,
          streamMode,
        ).catch((err) => err)

        assert(error instanceof XrpcInvalidResponseError)
        expect(error.message).toBe(
          'Expected "application/octet-stream" response (got "image/png")',
        )
        expect(error.payload).toBeUndefined()
        expect(cancel).toHaveBeenCalledExactlyOnceWith(error)
      })

      it('cancels the body of empty responses for declared outputs', async () => {
        const { response, cancel } = trackedResponse(
          { headers: { 'content-length': '0' } },
          { chunks: [] },
        )

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response, streamMode),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInvalidResponseError)
          expect(err.message).toBe(
            'Expected "application/octet-stream" response (got no payload)',
          )
          return true
        })
        expect(cancel).toHaveBeenCalledOnce()
      })

      it('cancels the body on invalid content-type headers', async () => {
        const { response, cancel } = trackedResponse({
          headers: { 'content-type': 'invalid' },
        })

        const error = await XrpcResponse.fromFetchResponse(
          binaryQuery,
          response,
          streamMode,
        ).catch((err) => err)

        assert(error instanceof XrpcInvalidResponseError)
        expect(cancel).toHaveBeenCalledExactlyOnceWith(error)
      })

      it('cancels the body of 3xx responses', async () => {
        const { response, cancel } = trackedResponse({ status: 302 })

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response, streamMode),
        ).rejects.toBeInstanceOf(XrpcInvalidResponseError)
        expect(cancel).toHaveBeenCalledOnce()
      })

      it('buffers error responses', async () => {
        const response = new Response(bytes, {
          status: 500,
          headers: { 'content-type': 'text/html' },
        })

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response, streamMode),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcResponseError)
          expect(err.payload).toEqual({ encoding: 'text/html', body: bytes })
          return true
        })
        expect(response.bodyUsed).toBe(true)
      })

      it('throws an XrpcInternalError when the fetch implementation does not support streaming', async () => {
        const response = withoutBodyStream(
          new Response(bytes, {
            headers: { 'content-type': 'application/octet-stream' },
          }),
        )

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response, streamMode),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcInternalError)
          expect(err.message).toBe(
            'Streaming response payloads is not supported by the fetch() implementation',
          )
          expect(err.shouldRetry()).toBe(false)
          return true
        })
      })

      it('logs cancellation failures instead of throwing them', async () => {
        using warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const cancelError = new Error('cancel failed')
        const body = new ReadableStream({
          start: (controller) => controller.enqueue(bytes),
          cancel: () => {
            throw cancelError
          },
        })
        const response = new Response(body, {
          headers: { 'content-type': 'image/png' },
        })

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response, streamMode),
        ).rejects.toBeInstanceOf(XrpcInvalidResponseError)

        await vi.waitFor(() => {
          expect(warn).toHaveBeenCalledExactlyOnceWith(
            'Failed to cancel response body',
            cancelError,
          )
        })
      })

      it('does not wait for the cancellation of cloned bodies to settle', async () => {
        const response = new Response(bytes, {
          headers: { 'content-type': 'image/png' },
        })
        // Cancelling one branch of a tee'd body only settles once every branch
        // was consumed or cancelled.
        const clone = response.clone()

        await expect(
          XrpcResponse.fromFetchResponse(binaryQuery, response, streamMode),
        ).rejects.toBeInstanceOf(XrpcInvalidResponseError)

        await clone.body?.cancel()
      })
    })

    describe('disposal', () => {
      it('cancels unconsumed streams', async () => {
        const { response, cancel } = trackedResponse({
          headers: { 'content-type': 'application/octet-stream' },
        })

        {
          await using result = await XrpcResponse.fromFetchResponse(
            binaryQuery,
            response,
            streamMode,
          )
          expect(result.body).toBe(response.body)
        }

        expect(cancel).toHaveBeenCalledOnce()
      })

      it('is a no-op for consumed streams', async () => {
        using warn = vi.spyOn(console, 'warn')
        const { response, cancel } = trackedResponse(
          { headers: { 'content-type': 'application/octet-stream' } },
          { close: true },
        )

        {
          await using result = await XrpcResponse.fromFetchResponse(
            binaryQuery,
            response,
            streamMode,
          )
          await expect(readStream(result.body)).resolves.toEqual(bytes)
        }

        expect(cancel).not.toHaveBeenCalled()
        expect(warn).not.toHaveBeenCalled()
      })

      it('is a no-op for locked streams', async () => {
        const { response, cancel } = trackedResponse(
          { headers: { 'content-type': 'application/octet-stream' } },
          { close: true },
        )

        const result = await XrpcResponse.fromFetchResponse(
          binaryQuery,
          response,
          streamMode,
        )
        const reader = result.body.getReader()

        await result[Symbol.asyncDispose]()

        expect(cancel).not.toHaveBeenCalled()
        await expect(reader.read()).resolves.toEqual({
          done: false,
          value: bytes,
        })
      })

      it('is a no-op for buffered payloads', async () => {
        const result = await XrpcResponse.fromFetchResponse(
          binaryQuery,
          new Response(bytes, {
            headers: { 'content-type': 'application/octet-stream' },
          }),
        )

        await expect(result[Symbol.asyncDispose]()).resolves.toBeUndefined()
        expect(result.body).toEqual(bytes)
      })
    })
  })
})
