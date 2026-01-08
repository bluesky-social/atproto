import { NodeJSBuffer } from './lib/nodejs-buffer.js'

const Buffer = NodeJSBuffer

export const ui8ConcatNode = Buffer
  ? function ui8ConcatNode(array: readonly Uint8Array[]): Uint8Array {
      return Buffer.concat(array)
    }
  : /* v8 ignore next -- @preserve */ null

export function ui8ConcatPonyfill(array: readonly Uint8Array[]): Uint8Array {
  let totalLength = 0
  for (const arr of array) totalLength += arr.length
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of array) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}
