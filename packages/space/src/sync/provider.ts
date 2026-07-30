import { CarBlock, writeCarStream } from '@atproto/common'
import { cidForLex, encode } from '@atproto/lex-cbor'
import { Cid, cidForCbor } from '@atproto/lex-data'
import { SignedCommit, SpaceRecord } from '../types.js'
import { formatRecordPath } from '../util.js'
import { encodeRepoIndex, repoIndex } from './repo-index.js'

export type SerializedRecord = {
  collection: string
  rkey: string
  cid: Cid
  bytes: Uint8Array
}

/**
 * Two roots in order — the signed commit, then the index — followed by record blocks
 * in the index's order. Records are collected up front because the index has to
 * precede the blocks it describes. Blobs are excluded.
 */
export async function* serializeRepo(
  commit: SignedCommit,
  records: AsyncIterable<SerializedRecord> | Iterable<SerializedRecord>,
): AsyncIterable<Uint8Array> {
  const collected: SerializedRecord[] = []
  for await (const record of records) {
    collected.push(record)
  }

  const index = repoIndex(collected)
  const indexBytes = encodeRepoIndex(index)
  const commitBytes = encode(commitToLex(commit))
  const [commitCid, indexCid] = await Promise.all([
    cidForCbor(commitBytes),
    cidForCbor(indexBytes),
  ])

  const byPath = new Map(
    collected.map((r) => [formatRecordPath(r.collection, r.rkey), r]),
  )

  yield* writeCarStream(
    [commitCid, indexCid],
    (function* (): Generator<CarBlock> {
      yield { cid: commitCid, bytes: commitBytes }
      yield { cid: indexCid, bytes: indexBytes }
      for (const path of index.keys()) {
        const record = byPath.get(path)!
        yield { cid: record.cid, bytes: record.bytes }
      }
    })(),
  )
}

export const serializeRecord = async (
  collection: string,
  rkey: string,
  record: SpaceRecord,
): Promise<SerializedRecord> => {
  const bytes = encode(record)
  return { collection, rkey, cid: await cidForLex(record), bytes }
}

export const commitToLex = (commit: SignedCommit) => ({
  ver: commit.ver,
  hash: commit.hash,
  ikm: commit.ikm,
  sig: commit.sig,
  mac: commit.mac,
  rev: commit.rev,
})
