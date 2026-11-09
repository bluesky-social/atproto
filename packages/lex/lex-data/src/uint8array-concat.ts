import { NodeJSBuffer } from './lib/nodejs-buffer.js'

const Buffer = NodeJSBuffer

export const ui8ConcatNode:
  ((items: Iterable<ArrayLike<number>>) => Uint8Array<ArrayBuffer>) | null =
  Buffer
    ? function ui8ConcatNode(items) {
        const array = Array.from(items, (arrayLike) =>
          arrayLike instanceof Uint8Array ? arrayLike : Buffer.from(arrayLike),
        )
        const buffer = Buffer.concat(array)
        // Do *not* return a Buffer to avoid differences between NodeJSBuffer
        // and Uint8Array regarding some operations (e.g., `slice`, `subarray`,
        // etc.).
        return new Uint8Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength,
        )
      }
    : /* v8 ignore next -- @preserve */ null

export function ui8ConcatPonyfill(
  items: Iterable<ArrayLike<number>>,
): Uint8Array<ArrayBuffer> {
  let totalLength = 0

  // Consume the iterable once (e.g. in case it is a generator)
  const array: ArrayLike<number>[] = []

  for (const arrayLike of items) {
    const { length } = arrayLike
    if (length !== 0) {
      totalLength += length
      array.push(arrayLike)
    }
  }

  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arrayLike of array) {
    result.set(arrayLike, offset)
    offset += arrayLike.length
  }

  return result
}
