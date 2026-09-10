import * as varint from 'varint'

// @TODO we might optimize this:
// - by using a pre-allocated buffer and writing into it, then slicing it to the correct length
// - by re-writing the varint encoding logic to avoid the intermediate array allocation
export function encodeVarInt(num: number): Uint8Array {
  return new Uint8Array(varint.encode(num))
}

export function decodeVarInt(bytes: Uint8Array | number[]): number {
  return varint.decode(bytes)
}
