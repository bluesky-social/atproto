import { ReadCarOptions, readCarBytes, writeCarStream } from '@atproto/common'
import { Cid } from '@atproto/lex-data'
import { BlockMap } from './block-map.js'
import { concatBytesAsync } from './util.js'

// CAR framing lives in @atproto/common so that non-MST callers (e.g. permissioned
// repos, which declare two roots) can share it.
export {
  type BytesReader,
  type CarBlockIterable,
  type ReadCarOptions,
  readCarBytes,
  readCarReader,
  readCarStream,
  verifyIncomingCarBlocks,
  writeCarStream,
} from '@atproto/common'

export async function blocksToCarFile(
  root: Cid | null,
  blocks: BlockMap,
): Promise<Uint8Array> {
  return concatBytesAsync(blocksToCarStream(root, blocks))
}

export const blocksToCarStream = (
  root: Cid | null,
  blocks: BlockMap,
): AsyncIterable<Uint8Array> => {
  return writeCarStream(root, iterateBlocks(blocks))
}

async function* iterateBlocks(blocks: BlockMap) {
  for (const entry of blocks.entries()) {
    yield { cid: entry.cid, bytes: entry.bytes }
  }
}

export const readCar = async (
  bytes: Uint8Array,
  opts?: ReadCarOptions,
): Promise<{ roots: Cid[]; blocks: BlockMap }> => {
  const { roots, blocks } = await readCarBytes(bytes, opts)
  const blockMap = new BlockMap()
  for await (const block of blocks) {
    blockMap.set(block.cid, block.bytes)
  }
  return { roots, blocks: blockMap }
}

export const readCarWithRoot = async (
  bytes: Uint8Array,
  opts?: ReadCarOptions,
): Promise<{ root: Cid; blocks: BlockMap }> => {
  const { roots, blocks } = await readCar(bytes, opts)
  if (roots.length !== 1) {
    throw new Error(`Expected one root, got ${roots.length}`)
  }
  const root = roots[0]
  return {
    root,
    blocks,
  }
}
