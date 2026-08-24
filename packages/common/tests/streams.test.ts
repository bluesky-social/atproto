import { createHash } from 'node:crypto'
import events from 'node:events'
import { PassThrough, Readable, Writable, pipeline } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { assert, describe, expect, it } from 'vitest'
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

  describe(streams.Tee, () => {
    // A Writable that records everything written to it, for use as a branch.
    const collectingBranch = () => {
      const chunks: Buffer[] = []
      const branch = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(Buffer.from(chunk))
          cb()
        },
      })
      return { branch, chunks }
    }

    it('forwards chunks downstream while mirroring them to the branch', async () => {
      const { branch, chunks } = collectingBranch()
      const branchFinished = events.once(branch, 'finish')

      const tee = new streams.Tee(branch)
      const source = Readable.from(
        ['foo', 'bar', 'baz'].map((s) => Buffer.from(s)),
      )

      const downstream = await streams.streamToNodeBuffer(source.pipe(tee))
      await branchFinished

      expect(downstream.toString()).toBe('foobarbaz')
      expect(Buffer.concat(chunks).toString()).toBe('foobarbaz')
    })

    it('exposes the branch as a readable stream when given a function', async () => {
      let branchBytes: Promise<Buffer> | undefined
      const tee = new streams.Tee((readable) => {
        branchBytes = streams.streamToNodeBuffer(readable)
      })

      const source = Readable.from([Buffer.from('hello world')])
      const downstream = await streams.streamToNodeBuffer(source.pipe(tee))

      assert(branchBytes, 'branch function should have been called')
      expect(downstream.toString()).toBe('hello world')
      expect((await branchBytes).toString()).toBe('hello world')
    })

    it('paces forwarding by the slower branch (applies backpressure)', async () => {
      // A branch that holds its first write open, keeping itself "full" so it
      // exerts backpressure on the tee.
      let releaseFirstWrite: (() => void) | undefined
      const branchChunks: Buffer[] = []
      const branch = new Writable({
        highWaterMark: 1,
        write(chunk, _enc, cb) {
          branchChunks.push(Buffer.from(chunk))
          if (releaseFirstWrite === undefined) {
            releaseFirstWrite = cb
          } else {
            cb()
          }
        },
      })

      const tee = new streams.Tee(branch)
      const downstreamChunks: Buffer[] = []
      const downstream = new Writable({
        write(chunk, _enc, cb) {
          downstreamChunks.push(Buffer.from(chunk))
          cb()
        },
      })

      const source = Readable.from(['a', 'b', 'c'].map((s) => Buffer.from(s)))
      const done = events.once(downstream, 'finish')
      source.pipe(tee).pipe(downstream)

      // Let the pipeline settle while the branch is blocked on its first write.
      await delay(20)
      assert(releaseFirstWrite, 'the branch should have received a first write')
      // The branch is stuck, so nothing has been forwarded downstream yet.
      expect(downstreamChunks.length).toBe(0)

      // Unblock the branch; everything should now flow through, in order.
      releaseFirstWrite()
      await done

      expect(Buffer.concat(downstreamChunks).toString()).toBe('abc')
      expect(Buffer.concat(branchChunks).toString()).toBe('abc')
    })

    it('paces the source by the slowest consumer, whichever branch it is', async () => {
      // Two consumers whose speeds vary over time: the bottleneck alternates
      // between the branch and the downstream every 10 chunks. Backpressure
      // must always come from whichever is currently slower, so the source is
      // never read far ahead of that slower consumer.
      const CHUNK = 16 * 1024 // ~one highWaterMark slot per pipeline buffer
      const N = 40
      const SLOW = 15
      const FAST = 1
      const slowBranchFirst = (i: number) => Math.floor(i / 10) % 2 === 0
      const branchDelays = Array.from({ length: N }, (_, i) =>
        slowBranchFirst(i) ? SLOW : FAST,
      )
      const downstreamDelays = Array.from({ length: N }, (_, i) =>
        slowBranchFirst(i) ? FAST : SLOW,
      )

      let produced = 0
      let branchProgress = 0
      let downstreamProgress = 0
      // How far the source has been read ahead of the slower of the two
      // consumers. Bounded by the pipeline's buffers (structural, not timing
      // dependent); without backpressure it would climb to ~N.
      let maxLead = 0
      const recordLead = () => {
        const slowest = Math.min(branchProgress, downstreamProgress)
        maxLead = Math.max(maxLead, produced - slowest)
      }

      const source = new Readable({
        read() {
          if (produced < N) {
            const chunk = Buffer.alloc(CHUNK, produced)
            produced++
            recordLead()
            this.push(chunk)
          } else {
            this.push(null)
          }
        },
      })

      const branch = new Writable({
        highWaterMark: 1,
        write(_chunk, _enc, cb) {
          const ms = branchDelays[branchProgress++]
          recordLead()
          setTimeout(cb, ms)
        },
      })

      const downstream = new Writable({
        highWaterMark: 1,
        write(_chunk, _enc, cb) {
          const ms = downstreamDelays[downstreamProgress++]
          recordLead()
          setTimeout(cb, ms)
        },
      })

      const tee = new streams.Tee(branch)
      const finished = events.once(downstream, 'finish')
      source.pipe(tee).pipe(downstream)
      await finished

      // Everything flowed through both consumers, in full.
      expect(branchProgress).toBe(N)
      expect(downstreamProgress).toBe(N)
      // The source stayed within a small, buffer-sized lead of the slowest
      // consumer throughout — i.e. it was consumed as slowly as the slowest,
      // never racing ahead. Observed lead is ~12; without backpressure it
      // would approach N (40).
      expect(maxLead).toBeLessThanOrEqual(16)
    })

    it('tears down the branch when the tee is destroyed early', async () => {
      const branch = new PassThrough()
      // The branch may be torn down with an error; swallow it (best-effort).
      branch.on('error', () => {})
      const branchClosed = new Promise<void>((resolve) =>
        branch.once('close', resolve),
      )

      const tee = new streams.Tee(branch)
      // A source that stays open, so the tee is genuinely destroyed mid-stream.
      const source = new PassThrough()
      const gotData = events.once(tee, 'data')
      source.pipe(tee)
      source.write(Buffer.from('a'))

      // Once a chunk has flowed through, destroy the tee (e.g. the client
      // disconnected) while the source is still open.
      await gotData
      tee.destroy()

      await branchClosed
      expect(branch.destroyed).toBe(true)
    })

    it('does not stall when a branch with autoDestroy:false errors mid-write', async () => {
      // A branch that blocks on its first write (so the tee parks waiting for
      // it to drain) and, being autoDestroy:false, later errors *without* ever
      // emitting 'close'. The tee must still recover and finish the stream.
      let failFirstWrite: ((err: Error) => void) | undefined
      const branch = new Writable({
        highWaterMark: 1,
        autoDestroy: false,
        write(_chunk, _enc, cb) {
          if (failFirstWrite === undefined) failFirstWrite = cb
          else cb()
        },
      })

      const tee = new streams.Tee(branch)
      const downstreamChunks: Buffer[] = []
      const downstream = new Writable({
        write(chunk, _enc, cb) {
          downstreamChunks.push(Buffer.from(chunk))
          cb()
        },
      })

      const source = Readable.from(['a', 'b', 'c'].map((s) => Buffer.from(s)))
      const finished = events.once(downstream, 'finish')
      source.pipe(tee).pipe(downstream)

      // The tee is now parked, waiting for the blocked branch to drain, so
      // nothing has been forwarded downstream yet.
      await delay(20)
      assert(failFirstWrite, 'the branch should have received a first write')
      expect(downstreamChunks.length).toBe(0)

      // The branch errors while the tee waits. With autoDestroy:false it emits
      // only 'error' (no 'close'); the tee must not hang on it.
      failFirstWrite(new Error('branch failed'))

      await finished
      expect(Buffer.concat(downstreamChunks).toString()).toBe('abc')
    })

    it('does not stall when a branch emits an error while waiting to drain', async () => {
      // A branch that never completes its first write, keeping the tee parked
      // waiting to drain. A bare emit('error') (no destroy, no 'close') must
      // still let the tee finish forwarding the remaining chunks downstream.
      let firstWriteReceived = false
      const branch = new Writable({
        highWaterMark: 1,
        write() {
          firstWriteReceived = true
          // Never call the callback: the branch stays "full" forever.
        },
      })

      const tee = new streams.Tee(branch)
      const downstreamChunks: Buffer[] = []
      const downstream = new Writable({
        write(chunk, _enc, cb) {
          downstreamChunks.push(Buffer.from(chunk))
          cb()
        },
      })

      const source = Readable.from(['a', 'b', 'c'].map((s) => Buffer.from(s)))
      const finished = events.once(downstream, 'finish')
      source.pipe(tee).pipe(downstream)

      await delay(20)
      assert(
        firstWriteReceived,
        'the branch should have received a first write',
      )
      expect(downstreamChunks.length).toBe(0)

      branch.emit('error', new Error('branch failed'))

      await finished
      expect(Buffer.concat(downstreamChunks).toString()).toBe('abc')
    })
  })

  describe(streams.fanOut, () => {
    // A Writable that records everything written to it, for use as a sink.
    const collectingSink = () => {
      const chunks: Buffer[] = []
      const sink = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(Buffer.from(chunk))
          cb()
        },
      })
      return { sink, chunks }
    }

    it('mirrors the input into every sink', async () => {
      const a = collectingSink()
      const b = collectingSink()
      const aFinished = events.once(a.sink, 'finish')
      const bFinished = events.once(b.sink, 'finish')

      const source = Readable.from(
        ['foo', 'bar', 'baz'].map((s) => Buffer.from(s)),
      )
      await events.once(source.pipe(streams.fanOut(a.sink, b.sink)), 'finish')
      await Promise.all([aFinished, bFinished])

      expect(Buffer.concat(a.chunks).toString()).toBe('foobarbaz')
      expect(Buffer.concat(b.chunks).toString()).toBe('foobarbaz')
    })

    it('exposes a sink as a readable stream when given a function', async () => {
      const main = collectingSink()
      let branchBytes: Promise<Buffer> | undefined
      const fan = streams.fanOut(main.sink, (readable) => {
        branchBytes = streams.streamToNodeBuffer(readable)
      })

      const source = Readable.from([Buffer.from('hello world')])
      await events.once(source.pipe(fan), 'finish')

      assert(branchBytes, 'the sink function should have been called')
      expect(Buffer.concat(main.chunks).toString()).toBe('hello world')
      expect((await branchBytes).toString()).toBe('hello world')
    })

    it('keeps feeding the other sinks (and the input) when one dies early', async () => {
      // The "main" consumer disconnects after the first chunk; the branch must
      // still receive the whole stream, and the input must be read to the end.
      const N = 5
      let produced = 0
      const source = new Readable({
        read() {
          if (produced < N) this.push(Buffer.from([produced++]))
          else this.push(null)
        },
      })

      const mainChunks: Buffer[] = []
      const main = new Writable({
        write(chunk, _enc, cb) {
          mainChunks.push(Buffer.from(chunk))
          cb()
          // Simulate a client disconnect right after the first chunk.
          if (mainChunks.length === 1) main.destroy()
        },
      })
      const branch = collectingSink()
      const branchFinished = events.once(branch.sink, 'finish')

      await new Promise<void>((resolve, reject) => {
        pipeline([source, streams.fanOut(main, branch.sink)], (err) =>
          err ? reject(err) : resolve(),
        )
      })
      await branchFinished

      // The dead main sink got only its first chunk...
      expect(mainChunks.length).toBe(1)
      // ...while the branch received the full stream and the source drained.
      expect(branch.chunks.length).toBe(N)
      expect(source.readableEnded).toBe(true)
    })

    it('destroys the input only once every sink has died', async () => {
      // Both sinks disconnect after their first chunk. With no live consumer
      // left, the fan-out must fail its writable side, tearing the pipeline
      // (and thus the source) down — a normal completion would yield no error.
      const source = new Readable({
        read() {
          this.push(Buffer.from('x'))
        },
      })
      // The source is destroyed with the fan-out error; swallow it (pipeline
      // already handles teardown).
      source.on('error', () => {})

      const dyingSink = () => {
        let seen = 0
        const sink = new Writable({
          write(_chunk, _enc, cb) {
            cb()
            if (++seen === 1) sink.destroy()
          },
        })
        sink.on('error', () => {})
        return sink
      }

      const sourceClosed = new Promise<void>((resolve) =>
        source.once('close', resolve),
      )
      const err = await new Promise<Error | null>((resolve) => {
        pipeline([source, streams.fanOut(dyingSink(), dyingSink())], resolve)
      })
      await sourceClosed

      expect(err?.message).toBe('fanOut: all sinks ended')
      expect(source.destroyed).toBe(true)
    })

    it('propagates an input failure to every sink', async () => {
      const a = new PassThrough()
      const b = new PassThrough()
      const aError = events.once(a, 'error')
      const bError = events.once(b, 'error')

      const source = new PassThrough()
      pipeline([source, streams.fanOut(a, b)], () => {})
      source.write(Buffer.from('x'))

      const err = new Error('input failed')
      source.destroy(err)

      // The failure of the writable side is forwarded to both owned sinks.
      expect(await aError).toEqual([err])
      expect(await bError).toEqual([err])
    })

    it('paces the input by the slowest live sink', async () => {
      // A sink that holds its first write open, exerting backpressure.
      let releaseFirstWrite: (() => void) | undefined
      const slowChunks: Buffer[] = []
      const slow = new Writable({
        highWaterMark: 1,
        write(chunk, _enc, cb) {
          slowChunks.push(Buffer.from(chunk))
          if (releaseFirstWrite === undefined) releaseFirstWrite = cb
          else cb()
        },
      })
      const fast = collectingSink()

      const source = Readable.from(['a', 'b', 'c'].map((s) => Buffer.from(s)))
      const done = new Promise<void>((resolve, reject) => {
        pipeline([source, streams.fanOut(fast.sink, slow)], (err) =>
          err ? reject(err) : resolve(),
        )
      })

      // While the slow sink is blocked, the input is paced: the fast sink has
      // not raced ahead to receive every chunk.
      await delay(20)
      assert(releaseFirstWrite, 'the slow sink should have received a write')
      expect(fast.chunks.length).toBeLessThan(3)

      releaseFirstWrite()
      await done

      expect(Buffer.concat(fast.chunks).toString()).toBe('abc')
      expect(Buffer.concat(slowChunks).toString()).toBe('abc')
    })

    it('does not stall when a sink with autoDestroy:false errors mid-write', async () => {
      // A sink that blocks on its first write (so the fan-out parks waiting for
      // it to drain) and, being autoDestroy:false, later errors *without* ever
      // emitting 'close'. The fan-out must recover and finish via the other sink.
      let failFirstWrite: ((err: Error) => void) | undefined
      const branch = new Writable({
        highWaterMark: 1,
        autoDestroy: false,
        write(_chunk, _enc, cb) {
          if (failFirstWrite === undefined) failFirstWrite = cb
          else cb()
        },
      })
      branch.on('error', () => {})
      const main = collectingSink()

      const source = Readable.from(['a', 'b', 'c'].map((s) => Buffer.from(s)))
      const done = new Promise<void>((resolve, reject) => {
        pipeline([source, streams.fanOut(main.sink, branch)], (err) =>
          err ? reject(err) : resolve(),
        )
      })

      await delay(20)
      assert(failFirstWrite, 'the branch should have received a first write')
      // The fast main sink took the first chunk directly, then the fan-out
      // parked on the blocked branch — so the rest has not flowed through yet.
      expect(main.chunks.length).toBe(1)

      failFirstWrite(new Error('branch failed'))

      await done
      expect(Buffer.concat(main.chunks).toString()).toBe('abc')
    })
  })

  describe(streams.HashPassThrough, () => {
    it('passes bytes through unchanged and exposes the digest once finished', async () => {
      const hashPassThrough = new streams.HashPassThrough('sha256')
      const hashEvent = events.once(hashPassThrough, 'hash')

      const source = Readable.from(
        ['foo', 'bar', 'baz'].map((s) => Buffer.from(s)),
      )
      const out = await streams.streamToNodeBuffer(source.pipe(hashPassThrough))

      // Bytes are forwarded verbatim.
      expect(out.toString()).toBe('foobarbaz')

      const expected = createHash('sha256').update('foobarbaz').digest()
      expect(hashPassThrough.digest.equals(expected)).toBe(true)

      // The digest is also announced through the 'hash' event.
      const [emitted] = await hashEvent
      expect((emitted as Buffer).equals(expected)).toBe(true)
    })

    it('throws when the digest is accessed before the stream finishes', () => {
      const hashPassThrough = new streams.HashPassThrough('sha256')
      hashPassThrough.write(Buffer.from('foo'))

      expect(() => hashPassThrough.digest).toThrow('Hash not yet computed')
    })
  })
})
