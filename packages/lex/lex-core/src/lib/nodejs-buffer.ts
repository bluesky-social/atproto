interface NodeJSBuffer<TArrayBuffer extends ArrayBufferLike = ArrayBufferLike>
  extends Uint8Array<TArrayBuffer> {
  toString(encoding?: 'base64'): string
}

interface NodeJSBufferConstructor {
  from(input: Uint8Array | ArrayBuffer | ArrayBufferView): NodeJSBuffer
  from(input: string, encoding?: 'base64'): NodeJSBuffer
  byteLength(input: string): number
  prototype: NodeJSBuffer
}

// Avoids a direct reference to Node.js Buffer, which might not exist in some
// environments (e.g. browsers, Deno, Bun) to prevent bundlers from trying to
// include polyfills.
const BUFFER = /*#__PURE__*/ (() => 'Bu' + 'f'.repeat(2) + 'er')() as 'Buffer'
export const NodeJSBuffer: NodeJSBufferConstructor | null =
  (globalThis as any)?.[BUFFER]?.prototype instanceof Uint8Array &&
  'byteLength' in (globalThis as any)[BUFFER]
    ? ((globalThis as any)[BUFFER] as NodeJSBufferConstructor)
    : null
