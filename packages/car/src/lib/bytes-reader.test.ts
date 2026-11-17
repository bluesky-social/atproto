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

      await expect(reader.readFrame()).rejects.toThrow('not enough data')
    })
  })

  describe('read', () => {
    it('reads sequentially across chunk boundaries, clamped to what is left', async () => {
      const reader = createReader()

      expect(reader.isDone).toBe(false)
      await expect(reader.read(2)).resolves.toEqual(Uint8Array.of(0, 1))
      await expect(reader.read(3)).resolves.toEqual(Uint8Array.of(2, 3, 4))
      await expect(reader.read(1000)).resolves.toEqual(Uint8Array.of(5))
      expect(reader.isDone).toBe(true)
    })

    it.each([
      ['at the end of the input', chunks],
      ['for empty input', []],
    ])('returns empty bytes %s', async (_, input) => {
      const reader = createReader(input)
      await reader.read(100)

      await expect(reader.read(1)).resolves.toEqual(new Uint8Array())
      await expect(reader.read(1)).resolves.toEqual(new Uint8Array())
      expect(reader.isDone).toBe(true)
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
})

describe(StreamReader, () => {
  it('reads from a synchronous iterable', async () => {
    const reader = new StreamReader(chunks)

    await expect(reader.read(4)).resolves.toEqual(Uint8Array.of(0, 1, 2, 3))
    await expect(reader.read(4)).resolves.toEqual(Uint8Array.of(4, 5))
    expect(reader.isDone).toBe(true)
  })

  it('returns a chunk directly when no concatenation is needed', async () => {
    const chunk = Uint8Array.of(0, 1)
    const reader = new StreamReader([chunk])

    await expect(reader.read(chunk.byteLength)).resolves.toBe(chunk)
  })

  it('closes the iterator on destroy', async () => {
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
    expect(reader.isDone).toBe(true)
  })

  it('rejects a pending read when destroyed mid-read', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let finalized = false
    const iterable = (async function* () {
      try {
        await gate
        yield Uint8Array.of(0, 1)
        yield Uint8Array.of(2, 3)
      } finally {
        finalized = true
      }
    })()
    const reader = new StreamReader(iterable)

    const pending = reader.read(4)
    const destroyed = reader.destroy()
    release()
    await expect(pending).rejects.toThrow(
      'Stream reader destroyed while reading',
    )
    await destroyed
    expect(finalized).toBe(true)
    expect(reader.isDone).toBe(true)
  })

  it('closes an unstarted iterator without starting it', async () => {
    let started = false
    const iterable = (async function* () {
      started = true
      yield Uint8Array.of(0, 1)
    })()
    const reader = new StreamReader(iterable)
    using iterableReturn = vi.spyOn(iterable, 'return')

    await reader.destroy()
    expect(iterableReturn).toHaveBeenCalledOnce()
    expect(started).toBe(false)
    expect(reader.isDone).toBe(true)
  })
})
