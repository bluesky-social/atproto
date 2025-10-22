import { NodeJSBuffer } from '../lib/nodejs-buffer.js'

// @NOTE: Add missing lib types for Uint8Array base64 methods. These are marked
// as optional since they were very recently added and may not be available in
// all environments yet (e.g. NodeJS).
declare global {
  interface Uint8ArrayConstructor {
    /**
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64 Uint8Array.fromBase64()}
     */
    fromBase64?: (b64: string) => Uint8Array
  }

  interface Uint8Array {
    /**
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64 Uint8Array.prototype.toBase64()}
     */
    toBase64?: () => string
  }
}

export function asUint8Array(input: unknown): Uint8Array | null {
  if (input instanceof Uint8Array) {
    return input
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / Uint8Array.BYTES_PER_ELEMENT,
    )
  }

  return null
}

/**
 * Decodes a base64 string into a Uint8Array.
 *
 * @returns The decoded {@link Uint8Array}, or `undefined` if the input is not valid
 * @throws If base64 decoding is not supported in the environment
 */
export function decodeBase64(b64: string): Uint8Array | undefined {
  if (Uint8Array.fromBase64) {
    try {
      return Uint8Array.fromBase64(b64)
    } catch {
      return undefined
    }
  }

  if (NodeJSBuffer) {
    const bytes = NodeJSBuffer.from(b64, 'base64')

    // NodeJS Buffer will silently ignore invalid base64 characters, so we will
    // verify the expected length to ensure the input was a valid base 64 string
    const numberOfPaddingChars = b64.endsWith('==')
      ? 2
      : b64.endsWith('=')
        ? 1
        : 0
    const expectedByteLength = 3 * (b64.length / 4) - numberOfPaddingChars
    if (bytes.length !== expectedByteLength) return undefined

    return bytes
  }

  base64NotSupportedError()
}

export function ui8ToBase64(bytes: Uint8Array): string {
  if (bytes.toBase64) {
    return bytes.toBase64()
  }

  if (NodeJSBuffer) {
    return NodeJSBuffer.from(bytes).toString('base64')
  }

  base64NotSupportedError()
}

function base64NotSupportedError(): never {
  throw new Error(
    'Uint8Array.fromBase64() / Uint8Array.prototype.toBase64() not supported in this environment. ' +
      'Consider including a polyfill such as core-js or es-shims. ' +
      'See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64#browser_compatibility for more information.',
  )
}
