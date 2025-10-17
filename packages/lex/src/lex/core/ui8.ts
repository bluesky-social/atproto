import { isPureObject } from './util.js'

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

  const bytes = parseIpldBytes(input)
  if (bytes) return bytes

  return null
}

export function parseIpldBytes(input: unknown): Uint8Array | null {
  if (
    isPureObject(input) &&
    '$bytes' in input &&
    typeof input.$bytes === 'string' &&
    Object.keys(input).length === 1
  ) {
    return ui8FromBase64(input.$bytes)
  }

  return null
}

interface NodeJSBuffer extends Uint8Array {
  toString(encoding?: 'base64'): string
}
interface NodeJSBufferConstructor {
  from(input: Uint8Array | ArrayBuffer | ArrayBufferView): NodeJSBuffer
  from(input: string, encoding?: 'base64'): NodeJSBuffer
  prototype: NodeJSBuffer
}

// Avoids a direct reference to Node.js Buffer, which might not exist in some
// environments (e.g. browsers, Deno, Bun) to prevent bundlers from trying to
// include polyfills.
const BUFFER = /*#__PURE__*/ (() => 'Bu' + 'f'.repeat(2) + 'er')() as 'Buffer'
const NodeJSBuffer: NodeJSBufferConstructor | null =
  (globalThis as any)?.[BUFFER]?.prototype instanceof Uint8Array
    ? ((globalThis as any)[BUFFER] as NodeJSBufferConstructor)
    : null

export function ui8FromBase64(b64: string): Uint8Array {
  if ('fromBase64' in Uint8Array) {
    // @ts-ignore https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64#browser_compatibility
    return Uint8Array.fromBase64(b64)
  }

  if (NodeJSBuffer) {
    return NodeJSBuffer.from(b64, 'base64')
  }

  throw new Error('Unsupported environment: no base64 decoder available')
}

export function ui8ToBase64(bytes: Uint8Array): string {
  if ('toBase64' in bytes) {
    // @ts-ignore https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64#browser_compatibility
    return bytes.toBase64()
  }

  if (NodeJSBuffer) {
    return NodeJSBuffer.from(bytes).toString('base64')
  }

  throw new Error('Unsupported environment: no base64 encoder available')
}
