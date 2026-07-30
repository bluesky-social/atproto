import { readCarStream } from '@atproto/common'
import { decode } from '@atproto/lex-cbor'
import { Cid, LexMap } from '@atproto/lex-data'
import { RepoVerificationError } from '../error.js'
import { RepoCommit, verifyCommit } from '../repo-commit.js'
import { CommitCtx, SignedCommit, SpaceRecord } from '../types.js'
import { RepoIndex, decodeRepoIndex, repoIndexEntries } from './repo-index.js'

export type VerifyRepoOpts = {
  space: string
  author: string
  didKey: string
}

export type VerifiedRecord = {
  collection: string
  rkey: string
  cid: Cid
  record: SpaceRecord
}

/**
 * Verifies in three stages, following the CAR's layout so nothing needs buffering:
 * the commit, then the index against the commit's hash (which authenticates every
 * path/cid pair without reading a record), then each block against its index entry.
 *
 * The last stage runs lazily, so `records` must be drained to know the repo was
 * complete. Use {@link verifyRepoCarFull} to do that.
 */
export const verifyRepoCar = async (
  car: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  opts: VerifyRepoOpts,
): Promise<{
  commit: SignedCommit
  index: RepoIndex
  repo: RepoCommit
  records: AsyncGenerator<VerifiedRecord>
}> => {
  // The reader hashes every block against its cid as it streams.
  const { roots, blocks } = await readCarStream(car)
  if (roots.length !== 2) {
    throw new RepoVerificationError(
      `Expected 2 CAR roots (commit, index), got ${roots.length}`,
    )
  }
  const [commitCid, indexCid] = roots

  const commitBlock = await blocks.next()
  if (commitBlock.done || !commitBlock.value.cid.equals(commitCid)) {
    throw new RepoVerificationError('Expected the commit block to lead the CAR')
  }
  const commit = parseSignedCommit(commitBlock.value.bytes)

  const ctx: CommitCtx = {
    space: opts.space,
    author: opts.author,
    rev: commit.rev,
  }
  if (!(await verifyCommit(commit, ctx, opts.didKey))) {
    throw new RepoVerificationError('Commit failed verification')
  }

  const indexBlock = await blocks.next()
  if (indexBlock.done || !indexBlock.value.cid.equals(indexCid)) {
    throw new RepoVerificationError(
      'Expected the index block to follow the commit',
    )
  }
  const index = decodeRepoIndex(indexBlock.value.bytes)

  const repo = RepoCommit.fromRecords(repoIndexEntries(index))
  if (!repo.matches(commit)) {
    throw new RepoVerificationError('Repo index does not match the commit hash')
  }

  return { commit, index, repo, records: verifyRecords(blocks, index) }
}

/**
 * Verify a serialized repo and collect its records. Prefer {@link verifyRepoCar}
 * for large repos, where streaming avoids buffering every record at once.
 */
export const verifyRepoCarFull = async (
  car: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  opts: VerifyRepoOpts,
): Promise<{
  commit: SignedCommit
  index: RepoIndex
  repo: RepoCommit
  records: VerifiedRecord[]
}> => {
  const { commit, index, repo, records } = await verifyRepoCar(car, opts)
  const collected: VerifiedRecord[] = []
  for await (const record of records) {
    collected.push(record)
  }
  return { commit, index, repo, records: collected }
}

// Record blocks follow the index, in its order, one per entry.
async function* verifyRecords(
  blocks: AsyncIterable<{ cid: Cid; bytes: Uint8Array }>,
  index: RepoIndex,
): AsyncGenerator<VerifiedRecord> {
  const entries = repoIndexEntries(index)[Symbol.iterator]()

  for await (const block of blocks) {
    const next = entries.next()
    if (next.done) {
      throw new RepoVerificationError('CAR has more blocks than index entries')
    }
    const { collection, rkey, cid } = next.value
    if (!block.cid.equals(cid)) {
      throw new RepoVerificationError(
        `Expected block ${cid} for ${collection}/${rkey}, got ${block.cid}`,
      )
    }
    yield { collection, rkey, cid, record: parseRecord(block.bytes) }
  }

  if (!entries.next().done) {
    throw new RepoVerificationError('CAR is missing records named in the index')
  }
}

const parseSignedCommit = (bytes: Uint8Array): SignedCommit => {
  const { ver, hash, ikm, sig, mac, rev } = decodeMap(bytes)
  if (typeof ver !== 'number') {
    throw new RepoVerificationError('Commit is missing "ver"')
  }
  if (typeof rev !== 'string' || !rev) {
    throw new RepoVerificationError('Commit is missing "rev"')
  }
  return {
    ver,
    hash: asBytes(hash, 'hash'),
    ikm: asBytes(ikm, 'ikm'),
    sig: asBytes(sig, 'sig'),
    mac: asBytes(mac, 'mac'),
    rev,
  }
}

const parseRecord = (bytes: Uint8Array): SpaceRecord =>
  decodeMap(bytes) as LexMap

const decodeMap = (bytes: Uint8Array): Record<string, unknown> => {
  const decoded = decode(bytes)
  if (
    decoded === null ||
    typeof decoded !== 'object' ||
    Array.isArray(decoded)
  ) {
    throw new RepoVerificationError('Expected a CBOR map')
  }
  return decoded as Record<string, unknown>
}

const asBytes = (value: unknown, field: string): Uint8Array => {
  if (!(value instanceof Uint8Array)) {
    throw new RepoVerificationError(`Commit "${field}" must be bytes`)
  }
  return value
}
