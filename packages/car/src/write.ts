import { encode as cborEncode } from '@atproto/lex-cbor'
import { type Cid, ui8Concat, ui8ConcatAsync } from '@atproto/lex-data'
import type { BlockMap } from './block-map.js'
import type { CarBlock } from './car-block.js'
import { encodeVarInt } from './lib/varint.js'

/**
 * Write a CAR v1 stream. Most callers have a single root; permissioned repos
 * declare two (a commit and an index), so roots is a list.
 */
export async function* writeCarStream(
  roots: Cid | readonly Cid[] | null,
  blocks: AsyncIterable<CarBlock> | Iterable<CarBlock>,
): AsyncGenerator<Uint8Array, void, unknown> {
  yield* writeCarStreamHeader(roots)
  for await (const block of blocks) {
    yield* writeCarStreamBlock(block)
  }
}

export function encodeCarHeader(
  roots: Cid | readonly Cid[] | null,
): Uint8Array {
  return ui8Concat(writeCarStreamHeader(roots))
}

export function encodeCarBlock(block: CarBlock): Uint8Array {
  return ui8Concat(writeCarStreamBlock(block))
}

export async function blocksToCarFile(
  root: Cid | null,
  blocks: BlockMap,
): Promise<Uint8Array> {
  return ui8ConcatAsync(writeCarStream(root, blocks))
}

/** @deprecated use {@link writeCarStream} instead */
export async function* blocksToCarStream(
  root: Cid | null,
  blocks: BlockMap,
): AsyncIterable<Uint8Array, void, unknown> {
  yield* writeCarStream(root, blocks)
}

// Internal helpers

function* writeCarStreamHeader(
  roots: null | Cid | readonly Cid[],
): Generator<Uint8Array, void, unknown> {
  const header = cborEncode({
    version: 1,
    roots: roots == null ? [] : Array.isArray(roots) ? roots : [roots],
  })
  yield* encodeFrame(header)
}

function* writeCarStreamBlock(
  block: CarBlock,
): Generator<Uint8Array, void, unknown> {
  yield* encodeFrame(block.cid.bytes, block.bytes)
}

/**
 * Car framing is a varint-encoded length followed by the bytes.
 */
function* encodeFrame(
  ...chunks: Uint8Array[]
): Generator<Uint8Array, void, unknown> {
  const byteLength = chunks.reduce(byteLengthReducer, 0)
  yield encodeVarInt(byteLength)
  for (const b of chunks) yield b
}

function byteLengthReducer(acc: number, b: Uint8Array): number {
  return acc + b.byteLength
}
