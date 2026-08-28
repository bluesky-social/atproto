import { type Cid, ui8ConcatAsync } from '@atproto/lex-data'
import { BlockMap } from './block-map.js'
import { type ReadCarOptions, readCarStream } from './read.js'
import { writeCarStream } from './write.js'

export * from './block-map.js'
export * from './car-block.js'

export * from './read.js'
export * from './write.js'

export async function blocksToCarFile(
  root: Cid | null,
  blocks: BlockMap,
): Promise<Uint8Array> {
  return ui8ConcatAsync(blocksToCarStream(root, blocks))
}

export async function* blocksToCarStream(
  root: Cid | null,
  blocks: BlockMap,
): AsyncIterable<Uint8Array, void, unknown> {
  yield* writeCarStream(root, blocks.entries())
}

export async function readCar(
  bytes: Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  opts?: ReadCarOptions,
): Promise<{ roots: Cid[]; blocks: BlockMap }> {
  await using reader = await readCarStream(bytes, opts)
  const blockMap = new BlockMap()
  for await (const block of reader.blocks) {
    blockMap.set(block.cid, block.bytes)
  }
  return { roots: reader.roots, blocks: blockMap }
}

export async function readCarWithRoot(
  bytes: Uint8Array,
  opts?: ReadCarOptions,
): Promise<{ root: Cid; blocks: BlockMap }> {
  const { roots, blocks } = await readCar(bytes, opts)
  if (roots.length !== 1) {
    throw new Error(`Expected one root, got ${roots.length}`)
  }
  return {
    root: roots[0],
    blocks,
  }
}
