type Encoding = 'utf8' | 'base64' | 'base64url'

// Node's buffer module declares this type internally, but referencing it here
// would couple this file to @types/node. Local copy keeps this module
// standalone so it compiles in any environment (see tsconfig/isomorphic.tsconfig.json).
type WithImplicitCoercion<T> = T | { valueOf(): T }

interface NodeJSBuffer<TArrayBuffer extends ArrayBufferLike = ArrayBufferLike>
  extends Uint8Array<TArrayBuffer> {
  byteLength: number
  toString(encoding?: Encoding): string
  slice(start?: number, end?: number): NodeJSBuffer<ArrayBuffer>
  subarray(start?: number, end?: number): NodeJSBuffer<TArrayBuffer>
}

interface NodeJSBufferConstructor {
  new (input: string, encoding?: Encoding): NodeJSBuffer
  from(
    string: WithImplicitCoercion<string>,
    encoding?: BufferEncoding,
  ): NodeJSBuffer<ArrayBuffer>
  from(
    arrayOrString: WithImplicitCoercion<ArrayLike<number> | string>,
  ): NodeJSBuffer<ArrayBuffer>
  from<TArrayBuffer extends ArrayBufferLike>(
    arrayBuffer: WithImplicitCoercion<TArrayBuffer>,
    byteOffset?: number,
    length?: number,
  ): NodeJSBuffer<TArrayBuffer>
  concat(
    list: readonly Uint8Array[],
    totalLength?: number,
  ): NodeJSBuffer<ArrayBuffer>
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
