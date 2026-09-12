import * as varintModule from 'varint'

// `varint` is CommonJS, and its `module.exports` is an object literal whose
// values are `require()` calls. Node's cjs-module-lexer only detects the first
// of them, so under ESM this namespace holds `default` and `encode` and no
// `decode` — making `decode` `undefined` in built output while `encode` works.
// The whole module object is always reachable through `default`; bundlers and
// test transforms, which do synthesize both named exports, fall back to the
// namespace itself.
const varint =
  (varintModule as unknown as { default?: typeof varintModule }).default ??
  varintModule

// @TODO we might optimize this:
// - by using a pre-allocated buffer and writing into it, then slicing it to the correct length
// - by re-writing the varint encoding logic to avoid the intermediate array allocation
export function encodeVarInt(num: number): Uint8Array {
  return new Uint8Array(varint.encode(num))
}

export function decodeVarInt(bytes: Uint8Array | number[]): number {
  return varint.decode(bytes)
}
