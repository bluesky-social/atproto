type Encoding = 'utf8' | 'base64' | 'base64url'

// Node's buffer module declares this type internally, but referencing it here
// would couple this file to @types/node. Local copy keeps this module
// standalone so it compiles in any environment (see tsconfig/isomorphic.tsconfig.json).
type WithImplicitCoercion<T> = T | { valueOf(): T }

interface NodeJSBuffer<
  TArrayBuffer extends ArrayBufferLike = ArrayBufferLike,
> extends Uint8Array<TArrayBuffer> {
  byteLength: number
  toString(encoding?: Encoding): string
  slice(start?: number, end?: number): NodeJSBuffer<ArrayBuffer>
  subarray(start?: number, end?: number): NodeJSBuffer<TArrayBuffer>
  copy(
    target: NodeJSBuffer | Uint8Array,
    targetStart?: number,
    sourceStart?: number,
    sourceEnd?: number,
  ): number
}

interface NodeJSBufferConstructor {
  new (input: string, encoding?: Encoding): NodeJSBuffer
  from(
    string: WithImplicitCoercion<string>,
    encoding?: Encoding,
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
  isBuffer(obj: any): obj is NodeJSBuffer
  prototype: NodeJSBuffer
}

// Use Buffer in Node.js but don't speak its name directly to avoid bundlers
// pulling in the `Buffer` polyfill

const BUFFER = /*#__PURE__*/ (() => 'Bu' + 'f'.repeat(2) + 'er')() as 'Buffer'

const useBuffer =
  globalThis.process != null &&
  // @ts-expect-error
  !globalThis.process.browser &&
  typeof globalThis[BUFFER] === 'function' &&
  typeof globalThis[BUFFER].isBuffer === 'function'

export const NodeJSBuffer: NodeJSBufferConstructor | null = useBuffer
  ? (globalThis[BUFFER] as NodeJSBufferConstructor)
  : /* v8 ignore next -- @preserve */ null

export const isNodeJSBuffer: (input: unknown) => input is NodeJSBuffer =
  NodeJSBuffer
    ? NodeJSBuffer.isBuffer
    : /* v8 ignore next -- @preserve */ (_): _ is any => false
