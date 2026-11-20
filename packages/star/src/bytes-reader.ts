import { ui8Concat } from '@atproto/lex-data'

/**
 * Reads exact numbers of bytes from a stream of chunks, whatever their sizes.
 */
export class BytesReader {
  private readonly iterator: Iterator<Uint8Array> | AsyncIterator<Uint8Array>
  // Bytes received but not yet read.
  private buffer: Uint8Array = new Uint8Array()
  private ended = false

  constructor(input: AsyncIterable<Uint8Array> | Iterable<Uint8Array>) {
    this.iterator =
      Symbol.asyncIterator in input
        ? input[Symbol.asyncIterator]()
        : input[Symbol.iterator]()
  }

  /** Read `length` bytes, or fewer if the input ends first. */
  async read(length: number): Promise<Uint8Array> {
    const chunks = [this.buffer]
    let bufferedLength = this.buffer.length
    while (bufferedLength < length && !this.ended) {
      const next = await this.iterator.next()
      if (next.done) {
        this.ended = true
      } else {
        chunks.push(next.value)
        bufferedLength += next.value.length
      }
    }
    const bytes = chunks.length === 1 ? chunks[0] : ui8Concat(chunks)
    this.buffer = bytes.subarray(length)
    return bytes.subarray(0, length)
  }

  /** Stop reading, closing the input. */
  async destroy(): Promise<void> {
    this.buffer = new Uint8Array()
    await this.iterator.return?.()
  }
}
