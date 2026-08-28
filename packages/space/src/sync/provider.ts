import { type CarBlock, buildCarBlock, writeCarStream } from '@atproto/car'
import type { RepoIndex, SignedCommit, SpaceRecord } from '../types.js'
import { formatRecordPath } from '../util.js'

export type SerializedRecord = CarBlock & {
  collection: string
  rkey: string
}

/**
 * Serialize a repo as a car: two roots in order — the signed commit, then the
 * index — followed by one block per index entry, in the index's order. Blobs are
 * excluded.
 *
 * Records are collected up front because the index has to precede the blocks it
 * describes.
 *
 * With `excludeValues` only the two roots are written. The index still
 * authenticates against the commit, since the set hash is folded from the index's
 * entries rather than from the blocks.
 */
export async function* serializeRepo(
  commit: SignedCommit,
  records: AsyncIterable<SerializedRecord> | Iterable<SerializedRecord>,
  opts: { excludeValues?: boolean } = {},
): AsyncIterable<Uint8Array> {
  const byPath = new Map<string, SerializedRecord>()
  for await (const record of records) {
    byPath.set(formatRecordPath(record.collection, record.rkey), record)
  }
  // A consumer walks the index as the cbor encoder ordered its keys, so blocks
  // have to follow that order too.
  const paths = [...byPath.keys()].sort(byCanonicalKey)

  const index: RepoIndex = {}
  for (const path of paths) {
    index[path] = byPath.get(path)!.cid
  }

  const [commitBlock, indexBlock] = await Promise.all([
    buildCarBlock(commit),
    buildCarBlock(index),
  ])

  yield* writeCarStream(
    [commitBlock.cid, indexBlock.cid],
    (function* () {
      yield commitBlock
      yield indexBlock
      if (opts.excludeValues) return
      for (const path of paths) {
        yield byPath.get(path)!
      }
    })(),
  )
}

// Canonical dag-cbor map key order: shortest first, then bytewise.
const byCanonicalKey = (a: string, b: string): number => {
  if (a.length !== b.length) return a.length - b.length
  return a < b ? -1 : a > b ? 1 : 0
}

export const serializeRecord = async (
  collection: string,
  rkey: string,
  record: SpaceRecord,
): Promise<SerializedRecord> => {
  const block = await buildCarBlock(record)
  return { ...block, collection, rkey }
}
