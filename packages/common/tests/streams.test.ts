import events from 'node:events'
import { PassThrough, Readable } from 'node:stream'
import * as streams from '../src/streams.js'

describe('streams', () => {
  describe('forwardStreamErrors', () => {
    it('forwards errors through a set of streams', () => {
      const streamA = new PassThrough()
      const streamB = new PassThrough()
      let streamBError: Error | null = null
      const err = new Error('foo')

      streamB.on('error', (err) => {
        streamBError = err
      })

      streams.forwardStreamErrors(streamA, streamB)

      streamA.emit('error', err)

      expect(streamBError).toBe(err)
    })
  })

  describe('cloneStream', () => {
    it('should clone stream', () => {
      const stream = new PassThrough()
      let clonedError: Error | undefined
      let clonedData: string | undefined

      const cloned = streams.cloneStream(stream)

      cloned.on('data', (data) => {
        clonedData = String(data)
      })
      cloned.on('error', (err) => {
        clonedError = err
      })

      stream.emit('data', 'foo')
      stream.emit('error', new Error('foo error'))

      expect(clonedData).toEqual('foo')
      expect(clonedError?.message).toEqual('foo error')
    })
  })

  describe('streamSize', () => {
    it('reads entire stream and computes size', async () => {
      const stream = Readable.from(['f', 'o', 'o'])

      const size = await streams.streamSize(stream)

      expect(size).toBe(3)
    })

    it('returns 0 for empty streams', async () => {
      const stream = Readable.from([])
      const size = await streams.streamSize(stream)

      expect(size).toBe(0)
    })
  })

  describe('streamToNodeBuffer', () => {
    it('converts stream to byte array', async () => {
      const stream = Readable.from(Buffer.from('foo'))
      const bytes = await streams.streamToNodeBuffer(stream)

      expect(bytes[0]).toBe('f'.charCodeAt(0))
      expect(bytes[1]).toBe('o'.charCodeAt(0))
      expect(bytes[2]).toBe('o'.charCodeAt(0))
      expect(bytes.length).toBe(3)
    })

    it('converts async iterable to byte array', async () => {
      const iterable = (async function* () {
        yield Buffer.from('b')
        yield Buffer.from('a')
        yield new Uint8Array(['r'.charCodeAt(0)])
      })()
      const bytes = await streams.streamToNodeBuffer(iterable)

      expect(bytes[0]).toBe('b'.charCodeAt(0))
      expect(bytes[1]).toBe('a'.charCodeAt(0))
      expect(bytes[2]).toBe('r'.charCodeAt(0))
      expect(bytes.length).toBe(3)
    })

    it('throws error for non Uint8Array chunks', async () => {
      const iterable: AsyncIterable<any> = (async function* () {
        yield Buffer.from('b')
        yield Buffer.from('a')
        yield 'r'
      })()

      await expect(streams.streamToNodeBuffer(iterable)).rejects.toThrow(
        'expected Uint8Array',
      )
    })
  })

  describe('byteIterableToStream', () => {
    it('converts byte iterable to stream', async () => {
      const iterable: AsyncIterable<Uint8Array> = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([0xa, 0xb])
        },
      }

      const stream = streams.byteIterableToStream(iterable)

      for await (const chunk of stream) {
        expect(chunk[0]).toBe(0xa)
        expect(chunk[1]).toBe(0xb)
      }
    })
  })

  describe('coalesceByteStream', () => {
    it('coalesces chunks without changing bytes', async () => {
      const stream = streams.coalesceByteStream(
        Readable.from([
          new Uint8Array([0x1]),
          new Uint8Array([0x2, 0x3]),
          new Uint8Array([0x4, 0x5, 0x6]),
          new Uint8Array([0x7]),
          new Uint8Array([0x8]),
          new Uint8Array([0x9]),
        ]),
        4,
      )

      const chunks = await stream.toArray()

      expect(Buffer.concat(chunks)).toEqual(
        Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9]),
      )

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i]).toBeInstanceOf(Uint8Array)
        if (i < chunks.length - 1) {
          expect(chunks[i].length).toBeGreaterThanOrEqual(4)
        }
      }
    })

    it('yields chunks as they come when target size is 1', async () => {
      const stream = streams.coalesceByteStream(
        Readable.from([
          new Uint8Array([0x1]),
          new Uint8Array([0x2, 0x3]),
          new Uint8Array([0x4, 0x5, 0x6]),
        ]),
        1,
      )

      const chunks = await stream.toArray()

      expect(chunks).toEqual([
        new Uint8Array([0x1]),
        new Uint8Array([0x2, 0x3]),
        new Uint8Array([0x4, 0x5, 0x6]),
      ])
    })

    it('coalesces into a single chunk when target size exceeds total', async () => {
      const stream = streams.coalesceByteStream(
        Readable.from([
          new Uint8Array([0x1]),
          new Uint8Array([0x2, 0x3]),
          new Uint8Array([0x4, 0x5, 0x6]),
        ]),
        1000,
      )

      const chunks = await stream.toArray()

      expect(chunks.length).toBe(1)
      expect(Buffer.concat(chunks)).toEqual(
        Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5, 0x6]),
      )
    })

    it('forwards source stream errors', async () => {
      const source = new PassThrough()
      const stream = streams.coalesceByteStream(source, 4)
      const err = new Error('source failed')

      const gotError = events.once(stream, 'error')
      source.emit('error', err)

      expect(await gotError).toEqual([err])
    })

    it('destroying the coalesced stream destroys the source', async () => {
      let finalized = false
      async function* gen() {
        try {
          while (true) {
            yield new Uint8Array(1024)
          }
        } finally {
          finalized = true
        }
      }
      const source = Readable.from(gen(), { objectMode: false })
      const stream = streams.coalesceByteStream(source, 4096)

      await events.once(stream, 'data')
      stream.destroy()
      await new Promise((resolve) => source.once('close', resolve))

      expect(source.destroyed).toBe(true)
      expect(finalized).toBe(true)
    })
  })

  describe('bytesToStream', () => {
    it('converts byte array to readable stream', async () => {
      const bytes = new Uint8Array([0xa, 0xb])
      const stream = streams.bytesToStream(bytes)

      for await (const chunk of stream) {
        expect(chunk[0]).toBe(0xa)
        expect(chunk[1]).toBe(0xb)
      }
    })
  })

  describe('MaxSizeChecker', () => {
    it('destroys once max size is met', async () => {
      const stream = new Readable()
      const err = new Error('foo')
      const checker = new streams.MaxSizeChecker(1, () => err)
      let lastError: Error | undefined

      const outStream = stream.pipe(checker)

      outStream.on('error', (err) => {
        lastError = err
      })

      const waitForStream = new Promise<void>((resolve) => {
        stream.on('end', () => {
          resolve()
        })
      })

      expect(checker.totalSize).toBe(0)

      stream.push(new Uint8Array([0xa]))
      stream.push(new Uint8Array([0xb]))
      stream.push(null)

      await waitForStream

      expect(checker.totalSize).toBe(2)
      expect(checker.destroyed).toBe(true)
      expect(lastError).toBe(err)
    })
  })
})
