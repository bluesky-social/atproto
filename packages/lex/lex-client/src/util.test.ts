import { describe, expect, it } from 'vitest'
import {
  buildAtprotoHeaders,
  isAsyncIterable,
  isBlobLike,
  toReadableStream,
  toReadableStreamPonyfill,
} from './util.js'

// ============================================================================
// isBlobLike
// ============================================================================

describe(isBlobLike, () => {
  it('returns true for native Blob', () => {
    expect(isBlobLike(new Blob(['hello']))).toBe(true)
  })

  it('returns true for native File', () => {
    expect(isBlobLike(new File(['hello'], 'test.txt'))).toBe(true)
  })

  it('returns false for null', () => {
    expect(isBlobLike(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isBlobLike(undefined)).toBe(false)
  })

  it('returns false for primitives', () => {
    expect(isBlobLike(42)).toBe(false)
    expect(isBlobLike('string')).toBe(false)
    expect(isBlobLike(true)).toBe(false)
  })

  it('returns false for plain objects', () => {
    expect(isBlobLike({})).toBe(false)
    expect(isBlobLike({ stream: () => {} })).toBe(false)
  })

  it('returns true for Blob-like objects with [Symbol.toStringTag] = "Blob"', () => {
    const blobLike = {
      [Symbol.toStringTag]: 'Blob',
      stream: () => new ReadableStream(),
    }
    expect(isBlobLike(blobLike)).toBe(true)
  })

  it('returns true for File-like objects with [Symbol.toStringTag] = "File"', () => {
    const fileLike = {
      [Symbol.toStringTag]: 'File',
      stream: () => new ReadableStream(),
    }
    expect(isBlobLike(fileLike)).toBe(true)
  })

  it('returns false for objects with Blob tag but no stream method', () => {
    const notBlob = {
      [Symbol.toStringTag]: 'Blob',
    }
    expect(isBlobLike(notBlob)).toBe(false)
  })

  it('returns false for objects with Blob tag but non-function stream', () => {
    const notBlob = {
      [Symbol.toStringTag]: 'Blob',
      stream: 'not a function',
    }
    expect(isBlobLike(notBlob)).toBe(false)
  })
})

// ============================================================================
// isAsyncIterable
// ============================================================================

describe(isAsyncIterable, () => {
  it('returns true for async generators', () => {
    async function* gen() {
      yield 1
    }
    expect(isAsyncIterable(gen())).toBe(true)
  })

  it('returns true for objects with Symbol.asyncIterator', () => {
    const iterable = {
      [Symbol.asyncIterator]() {
        return { next: async () => ({ done: true, value: undefined }) }
      },
    }
    expect(isAsyncIterable(iterable)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isAsyncIterable(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isAsyncIterable(undefined)).toBe(false)
  })

  it('returns false for plain objects', () => {
    expect(isAsyncIterable({})).toBe(false)
  })

  it('returns false for sync iterables', () => {
    expect(isAsyncIterable([1, 2, 3])).toBe(false)
    expect(isAsyncIterable('string')).toBe(false)
  })
})

// ============================================================================
// buildAtprotoHeaders
// ============================================================================

describe(buildAtprotoHeaders, () => {
  it('returns empty headers when no options are set', () => {
    const headers = buildAtprotoHeaders({})
    expect([...headers.entries()]).toEqual([])
  })

  it('sets atproto-proxy header from service option', () => {
    const headers = buildAtprotoHeaders({
      service: 'did:plc:1234#atproto_labeler',
    })
    expect(headers.get('atproto-proxy')).toBe('did:plc:1234#atproto_labeler')
  })

  it('does not override existing atproto-proxy header', () => {
    const headers = buildAtprotoHeaders({
      headers: { 'atproto-proxy': 'did:plc:existing#service' },
      service: 'did:plc:new#service',
    })
    expect(headers.get('atproto-proxy')).toBe('did:plc:existing#service')
  })

  it('sets atproto-accept-labelers from labelers option', () => {
    const headers = buildAtprotoHeaders({
      labelers: ['did:plc:labeler1', 'did:plc:labeler2'] as const,
    })
    expect(headers.get('atproto-accept-labelers')).toBe(
      'did:plc:labeler1, did:plc:labeler2',
    )
  })

  it('appends to existing atproto-accept-labelers header', () => {
    const headers = buildAtprotoHeaders({
      headers: { 'atproto-accept-labelers': 'did:plc:existing' },
      labelers: ['did:plc:new'] as const,
    })
    expect(headers.get('atproto-accept-labelers')).toBe(
      'did:plc:new, did:plc:existing',
    )
  })

  it('passes through base headers', () => {
    const headers = buildAtprotoHeaders({
      headers: { Authorization: 'Bearer token123' },
    })
    expect(headers.get('Authorization')).toBe('Bearer token123')
  })

  it('accepts Headers instance as base headers', () => {
    const base = new Headers({ 'X-Custom': 'value' })
    const headers = buildAtprotoHeaders({ headers: base })
    expect(headers.get('X-Custom')).toBe('value')
  })

  it('sets empty header for empty labelers iterable', () => {
    const headers = buildAtprotoHeaders({ labelers: [] })
    // An empty array still sets the header (to empty string), distinguishing
    // "no labelers requested" from "labelers option not provided"
    expect(headers.has('atproto-accept-labelers')).toBe(true)
    expect(headers.get('atproto-accept-labelers')).toBe('')
  })
})

// ============================================================================
// toReadableStream
// ============================================================================

describe(toReadableStream, () => {
  it('converts async iterable to ReadableStream', async () => {
    async function* gen() {
      yield new Uint8Array([1, 2])
      yield new Uint8Array([3, 4])
    }

    const stream = toReadableStream(gen())
    const reader = stream.getReader()

    const chunk1 = await reader.read()
    expect(chunk1.done).toBe(false)
    expect(chunk1.value).toEqual(new Uint8Array([1, 2]))

    const chunk2 = await reader.read()
    expect(chunk2.done).toBe(false)
    expect(chunk2.value).toEqual(new Uint8Array([3, 4]))

    const end = await reader.read()
    expect(end.done).toBe(true)
  })

  it('handles empty async iterable', async () => {
    async function* gen() {
      // yields nothing
    }

    const stream = toReadableStream(gen())
    const reader = stream.getReader()

    const result = await reader.read()
    expect(result.done).toBe(true)
  })

  it('can be consumed with Response API', async () => {
    async function* gen() {
      yield new TextEncoder().encode('hello ')
      yield new TextEncoder().encode('world')
    }

    const stream = toReadableStream(gen())
    const response = new Response(stream)
    const text = await response.text()
    expect(text).toBe('hello world')
  })

  it('propagates errors from the async iterable', async () => {
    async function* gen() {
      yield new Uint8Array([1])
      throw new Error('stream error')
    }

    const stream = toReadableStream(gen())
    const reader = stream.getReader()

    // First chunk succeeds
    await reader.read()

    // Second read should reject
    await expect(reader.read()).rejects.toThrow('stream error')
  })
})

// ============================================================================
// toReadableStreamPonyfill
// ============================================================================

describe(toReadableStreamPonyfill, () => {
  it('converts async iterable to ReadableStream', async () => {
    async function* gen() {
      yield new Uint8Array([1, 2])
      yield new Uint8Array([3, 4])
    }

    const stream = toReadableStreamPonyfill(gen())
    const reader = stream.getReader()

    const chunk1 = await reader.read()
    expect(chunk1.done).toBe(false)
    expect(chunk1.value).toEqual(new Uint8Array([1, 2]))

    const chunk2 = await reader.read()
    expect(chunk2.done).toBe(false)
    expect(chunk2.value).toEqual(new Uint8Array([3, 4]))

    const end = await reader.read()
    expect(end.done).toBe(true)
  })

  it('handles empty async iterable', async () => {
    async function* gen() {
      // yields nothing
    }

    const stream = toReadableStreamPonyfill(gen())
    const reader = stream.getReader()

    const result = await reader.read()
    expect(result.done).toBe(true)
  })

  it('can be consumed with Response API', async () => {
    async function* gen() {
      yield new TextEncoder().encode('hello ')
      yield new TextEncoder().encode('world')
    }

    const stream = toReadableStreamPonyfill(gen())
    const response = new Response(stream)
    const text = await response.text()
    expect(text).toBe('hello world')
  })

  it('propagates errors from the async iterable', async () => {
    async function* gen() {
      yield new Uint8Array([1])
      throw new Error('stream error')
    }

    const stream = toReadableStreamPonyfill(gen())
    const reader = stream.getReader()

    await reader.read()
    await expect(reader.read()).rejects.toThrow('stream error')
  })

  it('calls iterator.return() on cancel', async () => {
    let returned = false
    const iterable: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            return { done: false, value: new Uint8Array([1]) }
          },
          async return() {
            returned = true
            return { done: true, value: undefined }
          },
        }
      },
    }

    const stream = toReadableStreamPonyfill(iterable)
    const reader = stream.getReader()

    await reader.read()
    await reader.cancel()

    expect(returned).toBe(true)
  })
})
