import { setTimeout } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import { BufferReader, type BytesReader, StreamReader } from './bytes-reader.js'

const chunks = [Uint8Array.of(0, 1, 2), Uint8Array.of(3, 4), Uint8Array.of(5)]

describe.each([BufferReader, StreamReader])('%o', (Reader) => {
  const createReader = (inputChunks = chunks): BytesReader => {
    if (Reader === BufferReader) {
      return new BufferReader(
        Uint8Array.from(inputChunks.flatMap((chunk) => Array.from(chunk))),
      )
    }

    return new StreamReader(
      (async function* () {
        yield* inputChunks
      })(),
    )
  }

  describe('readFrame', () => {
    it('reads sequentially, including across chunk boundaries', async () => {
      const reader = createReader([
        Uint8Array.of(2, 10),
        Uint8Array.of(11, 3, 12),
        Uint8Array.of(13, 14),
      ])

      await expect(reader.readFrame()).resolves.toEqual(Uint8Array.of(10, 11))
      await expect(reader.readFrame()).resolves.toEqual(
        Uint8Array.of(12, 13, 14),
      )
      await expect(reader.readFrame()).resolves.toBeNull()
    })

    it('reads an empty frame', async () => {
      const reader = createReader([Uint8Array.of(0)])

      await expect(reader.readFrame()).resolves.toEqual(new Uint8Array())
      await expect(reader.readFrame()).resolves.toBeNull()
    })

    it('rejects an incomplete frame size', async () => {
      const reader = createReader([Uint8Array.of(128)])

      await expect(reader.readFrame()).rejects.toThrow('could not parse varint')
    })

    it('rejects an incomplete frame', async () => {
      const reader = createReader([Uint8Array.of(3, 0, 1)])

      await expect(reader.readFrame()).rejects.toThrow()
    })
  })

  describe('read', () => {
    it('reads sequentially, including across chunk boundaries', async () => {
      const reader = createReader()

      expect(reader.isDone).toBe(false)
      await expect(reader.read(2)).resolves.toEqual(Uint8Array.of(0, 1))
      await expect(reader.read(3)).resolves.toEqual(Uint8Array.of(2, 3, 4))
      await expect(reader.read(1000)).resolves.toEqual(Uint8Array.of(5))
      expect(reader.isDone).toBe(true)
    })

    it('returns all available bytes when more are requested', async () => {
      const reader = createReader()

      await expect(reader.read(100)).resolves.toEqual(
        Uint8Array.of(0, 1, 2, 3, 4, 5),
      )
      expect(reader.isDone).toBe(true)
    })

    it('does not consume input for a zero-length read', async () => {
      const reader = createReader()

      await expect(reader.read(0)).resolves.toEqual(new Uint8Array())
      expect(reader.isDone).toBe(false)
      await expect(reader.read(1)).resolves.toEqual(Uint8Array.of(0))
    })

    it('keeps returning empty bytes after reaching the end', async () => {
      const reader = createReader()
      await reader.read(100)

      await expect(reader.read(1)).resolves.toEqual(new Uint8Array())
      await expect(reader.read(1)).resolves.toEqual(new Uint8Array())
      expect(reader.isDone).toBe(true)
    })

    it('handles empty input', async () => {
      const reader = createReader([])

      await expect(reader.read(1)).resolves.toEqual(new Uint8Array())
      expect(reader.isDone).toBe(true)
    })

    it('can be closed before reaching the end', async () => {
      const reader = createReader()

      await expect(reader.destroy()).resolves.toBeUndefined()
    })
  })
})

describe(BufferReader, () => {
  it('returns views over the original buffer', async () => {
    const bytes = Uint8Array.of(0, 1, 2, 3)
    const reader = new BufferReader(bytes)

    const first = await reader.read(2)
    const second = await reader.read(2)

    expect(first.buffer).toBe(bytes.buffer)
    expect(first.byteOffset).toBe(bytes.byteOffset)
    expect(second.buffer).toBe(bytes.buffer)
    expect(second.byteOffset).toBe(bytes.byteOffset + 2)
  })

  it('leaves buffered input readable after close', async () => {
    const reader = new BufferReader(Uint8Array.of(0, 1))

    await reader.destroy()

    await expect(reader.read(2)).resolves.toEqual(Uint8Array.of(0, 1))
  })
})

describe(StreamReader, () => {
  it('reads from a synchronous iterable', async () => {
    const reader = new StreamReader(chunks)

    await expect(reader.read(4)).resolves.toEqual(Uint8Array.of(0, 1, 2, 3))
    await expect(reader.read(4)).resolves.toEqual(Uint8Array.of(4, 5))
    expect(reader.isDone).toBe(true)
  })

  it('tracks bytes left in partially consumed chunks', async () => {
    const reader = new StreamReader([Uint8Array.of(0, 1, 2)])

    await reader.read(2)

    expect(reader.bufferedByteLength).toBe(1)
  })

  it('returns a chunk directly when no concatenation is needed', async () => {
    const chunk = Uint8Array.of(0, 1)
    const reader = new StreamReader([chunk])

    await expect(reader.read(chunk.byteLength)).resolves.toBe(chunk)
  })

  it('closes the iterator and discards buffered bytes', async () => {
    let finalized = false
    const iterable = (async function* () {
      try {
        yield Uint8Array.of(0, 1)
        yield Uint8Array.of(2)
      } finally {
        finalized = true
      }
    })()
    const reader = new StreamReader(iterable)
    await reader.read(1)

    await reader.destroy()

    expect(finalized).toBe(true)
    expect(reader.bufferedByteLength).toBe(0)
    expect(reader.isDone).toBe(true)
  })

  it('closes the iterator when closed concurrently with a read', async () => {
    let finalized = false
    const iterable = (async function* () {
      try {
        await setTimeout(10)
        yield Uint8Array.of(0, 1)
        await setTimeout(10)
        yield Uint8Array.of(2, 3)
        await setTimeout(10)
        yield Uint8Array.of(4, 5)
      } catch (err) {
        console.log('caught error in generator', err)
        throw err
      } finally {
        finalized = true
      }
    })()

    const reader = new StreamReader(iterable)

    const readPromise = reader.read(4)
    await setTimeout(4)
    await reader.destroy()
    expect(readPromise).rejects.toThrow(/Stream reader destroyed while reading/)

    expect(finalized).toBe(true)
    expect(reader.bufferedByteLength).toBe(0)
    expect(reader.isDone).toBe(true)
  })

  it('becomes done when the reader is disposed', async () => {
    let started = false
    let finalized = false
    const iterable = (async function* () {
      started = true
      try {
        yield Uint8Array.of(0, 1)
        yield Uint8Array.of(2)
      } finally {
        finalized = true
      }
    })()
    const reader = new StreamReader(iterable)
    const iterableReturn = vi.spyOn(iterable, 'return')

    await reader.destroy()

    expect(iterableReturn).toHaveBeenCalledOnce()
    // We never called read() so the generator never started
    expect(started).toBe(false)
    expect(finalized).toBe(false)
    expect(reader.isDone).toBe(true)
  })
})
