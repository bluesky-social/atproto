import { type check, readCarStream } from '@atproto/common'
import { decode } from '@atproto/lex-cbor'
import type { Cid, LexMap } from '@atproto/lex-data'
import { RepoVerificationError } from '../error.js'
import { RepoCommit, verifyCommit } from '../repo-commit.js'
import {
  type CommitCtx,
  type RepoIndex,
  type SignedCommit,
  type SpaceRecord,
  def,
} from '../types.js'
import { parseRecordPath } from '../util.js'

export type VerifyRepoParams = {
  space: string
  author: string
  didKey: string
  // False for an index-only car, which carries no record blocks. Defaults to true.
  expectValues?: boolean
}

export type VerifiedRecord = {
  collection: string
  rkey: string
  cid: Cid
  record: SpaceRecord
}

export type VerifiedRepo = {
  commit: SignedCommit
  index: RepoIndex
  repo: RepoCommit
  records: AsyncGenerator<VerifiedRecord>
}

/**
 * Verify a serialized repo, streaming out its records.
 *
 * The three stages follow the CAR's layout, so nothing needs buffering: the
 * commit, then the index against the commit's hash (which authenticates every
 * path/cid pair without reading a record), then each block against its index
 * entry. That last stage runs as `records` is drained, so it must be consumed to
 * know the repo was complete — {@link verifyRepoCarFull} does that.
 */
export const verifyRepoCar = async (
  car: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  params: VerifyRepoParams,
): Promise<VerifiedRepo> => {
  // The reader hashes every block against its cid as it streams.
  const { roots, blocks } = await readCarStream(car)
  if (roots.length !== 2) {
    throw new RepoVerificationError(
      `expected 2 car roots (commit, index), got ${roots.length}`,
    )
  }
  const [commitRoot, indexRoot] = roots

  const commitBlock = await blocks.next()
  if (commitBlock.done || !commitBlock.value.cid.equals(commitRoot)) {
    throw new RepoVerificationError('expected the commit block to lead the car')
  }
  const commit = parseBlock(commitBlock.value.bytes, def.signedCommit)

  const ctx: CommitCtx = { ...params, rev: commit.rev }
  if (!(await verifyCommit(commit, ctx, params.didKey))) {
    throw new RepoVerificationError('commit failed verification')
  }

  const indexBlock = await blocks.next()
  if (indexBlock.done || !indexBlock.value.cid.equals(indexRoot)) {
    throw new RepoVerificationError(
      'expected the index block to follow the commit',
    )
  }
  const index = parseBlock(indexBlock.value.bytes, def.repoIndex)

  const repo = RepoCommit.fromIndex(index)
  if (!repo.matches(commit)) {
    throw new RepoVerificationError('index does not match the commit hash')
  }

  return {
    commit,
    index,
    repo,
    records: verifyRecords(blocks, index, params.expectValues !== false),
  }
}

/**
 * Verify a serialized repo and collect its records. Prefer {@link verifyRepoCar}
 * for large repos, where streaming avoids holding every record at once.
 */
export const verifyRepoCarFull = async (
  car: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  params: VerifyRepoParams,
): Promise<Omit<VerifiedRepo, 'records'> & { records: VerifiedRecord[] }> => {
  const { records, ...rest } = await verifyRepoCar(car, params)
  const collected: VerifiedRecord[] = []
  for await (const record of records) {
    collected.push(record)
  }
  return { ...rest, records: collected }
}

// The car holds one record block per index entry, in the index's order.
async function* verifyRecords(
  blocks: AsyncIterable<{ cid: Cid; bytes: Uint8Array }>,
  index: RepoIndex,
  expectValues: boolean,
): AsyncGenerator<VerifiedRecord> {
  const paths = Object.keys(index)
  let i = 0

  for await (const block of blocks) {
    if (i >= paths.length) {
      throw new RepoVerificationError('car has more blocks than index entries')
    }
    const path = paths[i]
    const cid = index[path]
    i++

    if (!block.cid.equals(cid)) {
      throw new RepoVerificationError(
        `expected block ${cid} at ${path}, got ${block.cid}`,
      )
    }
    const { collection, rkey } = parseRecordPath(path)
    yield { collection, rkey, cid, record: decode(block.bytes) as LexMap }
  }

  const isIndexOnly = !expectValues && i === 0
  if (i < paths.length && !isIndexOnly) {
    throw new RepoVerificationError(
      `car is missing ${paths.length - i} record(s) named in the index`,
    )
  }
}

const parseBlock = <T>(bytes: Uint8Array, def: check.Def<T>): T => {
  const parsed = def.schema.safeParse(decode(bytes))
  if (!parsed.success) {
    throw new RepoVerificationError(
      `invalid ${def.name}: ${parsed.error.message}`,
    )
  }
  return parsed.data
}
