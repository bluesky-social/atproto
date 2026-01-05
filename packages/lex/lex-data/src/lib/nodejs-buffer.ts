type Encoding = 'utf8' | 'base64' | 'base64url'

interface NodeJSBuffer<TArrayBuffer extends ArrayBufferLike = ArrayBufferLike>
  extends Uint8Array<TArrayBuffer> {
  byteLength: number
  toString(encoding?: Encoding): string
}

interface NodeJSBufferConstructor {
  new (input: string, encoding?: Encoding): NodeJSBuffer
  from(
    input: Uint8Array | ArrayBuffer | ArrayBufferView,
  ): NodeJSBuffer<ArrayBuffer>
  from(input: string, encoding?: Encoding): NodeJSBuffer<ArrayBuffer>
  concat(list: readonly Uint8Array[], totalLength?: number): NodeJSBuffer
  byteLength(input: string, encoding?: Encoding): number
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
    : /* v8 ignore next -- @preserve */ null
