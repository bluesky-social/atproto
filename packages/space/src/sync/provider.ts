import { encode } from '@atproto/lex-cbor'
import { type Cid, cidForCbor } from '@atproto/lex-data'
import type { NsidString, RecordKeyString } from '@atproto/syntax'
import { type StarPair, writeStar } from '../star.js'
import {
  type Commit,
  REPO_STAR_TYPE,
  type RecordPathParts,
  type RepoStarMeta,
  type SpaceRecord,
} from '../types.js'
import { compareBytes, formatRecordPath } from '../util.js'

export type SerializedRecord = RecordPathParts & {
  bytes: Uint8Array
}

/**
 * Serialize a repo as a STAR archive: the commit as the metadata, then one
 * path/record pair per record. Blobs are excluded.
 *
 * Records must be given in strict path order, as the archive requires.
 */
export async function* serializeRepo(
  commit: Commit,
  records: AsyncIterable<SerializedRecord> | Iterable<SerializedRecord>,
): AsyncGenerator<Uint8Array> {
  const meta: RepoStarMeta = { $type: REPO_STAR_TYPE, ...commit }
  yield* writeStar(meta, toStarPairs(records))
}

async function* toStarPairs(
  records: AsyncIterable<SerializedRecord> | Iterable<SerializedRecord>,
): AsyncGenerator<StarPair> {
  const encoder = new TextEncoder()
  let prevKey: Uint8Array | undefined
  for await (const { collection, rkey, bytes } of records) {
    const path = formatRecordPath(collection, rkey)
    const key = encoder.encode(path)
    if (prevKey !== undefined && compareBytes(key, prevKey) <= 0) {
      throw new Error(`records out of order at ${path}`)
    }
    prevKey = key
    yield { key, value: bytes }
  }
}

export const serializeRecord = async (
  collection: NsidString,
  rkey: RecordKeyString,
  record: SpaceRecord,
): Promise<SerializedRecord & { cid: Cid }> => {
  const bytes = encode(record)
  return { collection, rkey, bytes, cid: await cidForCbor(bytes) }
}
