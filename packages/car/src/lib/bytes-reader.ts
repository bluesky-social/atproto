import { decodeVarInt } from './varint.js'

export type { BytesReader }
export function createBytesReader(
  input: Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
): BytesReader {
  return input instanceof Uint8Array
    ? new BufferReader(input)
    : new StreamReader(input)
}

abstract class BytesReader {
  abstract readonly isDone: boolean
  abstract read(bytesToRead: number): Uint8Array | Promise<Uint8Array>
  abstract destroy(): Promise<void>

  async readFrame(): Promise<Uint8Array | null> {
    const frameSize = await this.readFrameSize()
    if (frameSize === null) return null // eof
    return this.readFrameData(frameSize)
  }

  private async readFrameSize(): Promise<number | null> {
    const bytes: number[] = []
    for (;;) {
      const byte = await this.read(1)
      if (byte.byteLength === 0) {
        // No more bytes to read.
        if (bytes.length > 0) {
          // We already read some bytes: the varint is incomplete.
          throw new Error('could not parse varint')
        } else {
          // We reached the end of the stream
          return null
        }
      }
      bytes.push(byte[0])
      if (byte[0] < 128) break
    }
    return decodeVarInt(bytes)
  }

  private async readFrameData(frameSize: number): Promise<Uint8Array> {
    if (frameSize === 0) {
      return new Uint8Array()
    }
    const frame = await this.read(frameSize)
    if (frame.byteLength !== frameSize) {
      throw new Error('not enough data')
    }
    return frame
  }
}

// @NOTE We could use only StreamReader and pass it a single Uint8Array, but
// BufferReader is more efficient for that case.

// @NOTE BufferReader and StreamReader are exported for testing purposes, but
// they are not part of the public API.

export class BufferReader extends BytesReader {
  isDone = false

  private offset = 0

  constructor(private readonly bytes: Uint8Array) {
    super()
  }

  async read(bytesToRead: number): Promise<Uint8Array> {
    const value = this.bytes.subarray(this.offset, this.offset + bytesToRead)
    this.offset += value.byteLength
    if (this.offset >= this.bytes.length) {
      this.isDone = true
    }
    return value
  }

  async destroy(): Promise<void> {}
}

/**
 * This code was optimized for performance. See
 * {@link https://github.com/bluesky-social/atproto/pull/4729} for more details
 * and benchmarks.
 */
export class StreamReader extends BytesReader {
  private fullyConsumed = false
  private destroyed = false

  private readonly iterator: Iterator<Uint8Array> | AsyncIterator<Uint8Array>

  /** fifo list of chunks to consume */
  private readonly chunks: Uint8Array[] = []

  constructor(iterable: Iterable<Uint8Array> | AsyncIterable<Uint8Array>) {
    super()
    this.iterator =
      Symbol.asyncIterator in iterable
        ? iterable[Symbol.asyncIterator]()
        : iterable[Symbol.iterator]()
  }

  get isDone(): boolean {
    if (this.destroyed) return true
    return this.fullyConsumed && this.bufferedByteLength === 0
  }

  /** Number of bytes currently buffered and available for reading */
  get bufferedByteLength(): number {
    let total = 0
    for (let i = 0; i < this.chunks.length; i++) {
      total += this.chunks[i].byteLength
    }
    return total
  }

  /**
   * @note concurrent reads are **NOT** supported by the current implementation
   * and would require call to readUntilBuffered to be using a fifo lock for
   * read()s to be processed in fifo order.
   */
  async read(bytesToRead: number): Promise<Uint8Array> {
    if (this.destroyed) {
      throw new Error('Bytes reader destroyed while reading')
    }

    const bytesNeeded = bytesToRead - this.bufferedByteLength
    if (bytesNeeded > 0 && !this.fullyConsumed) {
      await this.readUntilBuffered(bytesNeeded)
    }

    // @NOTE There **MUST NOT** be any async operation bellow

    const resultLength = Math.min(bytesToRead, this.bufferedByteLength)
    if (resultLength <= 0) return new Uint8Array()

    const firstChunk = this.consumeChunk(resultLength)
    if (firstChunk.byteLength === resultLength) {
      // If the data consumed from the first chunk contains all we need, return
      // it as-is. This allows to avoid any copy operation.
      return firstChunk
    }

    // The first chunk does not have all the data we need. We have to copy
    // multiple chunks into a larger buffer
    const result = new Uint8Array(resultLength)
    let resultWriteIndex = 0

    // Copy the first chunk into the result buffer
    result.set(firstChunk, resultWriteIndex)
    resultWriteIndex += firstChunk.byteLength

    // Copy more chunks as needed (we use do-while because we *know* we need
    // more than one chunk)
    do {
      const missingLength = resultLength - resultWriteIndex
      const currentChunk = this.consumeChunk(missingLength)

      result.set(currentChunk, resultWriteIndex)
      resultWriteIndex += currentChunk.byteLength
    } while (resultWriteIndex < resultLength)

    return result
  }

  private async readUntilBuffered(bytesNeeded: number): Promise<void> {
    let bytesRead = 0

    while (bytesRead < bytesNeeded) {
      try {
        const next = this.iterator.next()
        const result = 'then' in next ? await next : next

        // Destroyed while reading, the result should not be used
        if (this.destroyed) {
          throw new Error('Stream reader destroyed while reading')
        } else if (result.done) {
          this.fullyConsumed = true
          break
        } else {
          this.chunks.push(result.value)
          bytesRead += result.value.byteLength
        }
      } catch (err) {
        this.fullyConsumed = true
        throw err
      }
    }
  }

  private consumeChunk(bytesToConsume: number) {
    const firstChunk = this.chunks[0]!
    if (bytesToConsume < firstChunk.byteLength) {
      // return a sub-view of the data being read and replace the first chunk
      // with a sub-view that does not contain that data.

      // @NOTE for some reason, subarray() revealed to be 7-8% slower in NodeJS
      // benchmarks.

      // this.chunks[0] = firstChunk.subarray(bytesToConsume)
      // return firstChunk.subarray(0, bytesToConsume)

      this.chunks[0] = new Uint8Array(
        firstChunk.buffer,
        firstChunk.byteOffset + bytesToConsume,
        firstChunk.byteLength - bytesToConsume,
      )
      return new Uint8Array(
        firstChunk.buffer,
        firstChunk.byteOffset,
        bytesToConsume,
      )
    } else {
      // First chunk is being read in full, discard it
      this.chunks.shift()
      return firstChunk
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true
    try {
      if (this.iterator.return) {
        await this.iterator.return()
      }
    } finally {
      this.chunks.length = 0 // Free memory
    }
  }
}
