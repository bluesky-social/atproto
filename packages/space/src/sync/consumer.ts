import { type LexValue, decode, encode } from '@atproto/lex-cbor'
import {
  type CborCid,
  cidForCbor,
  isPlainObject,
  parseCidSafe,
} from '@atproto/lex-data'
import { type StarPair, readStar } from '@atproto/star'
import type {
  NsidString,
  RecordKeyString,
  SpaceAtUriString,
} from '@atproto/syntax'
import { compareBytes } from '../bytes.js'
import { SpaceRepoVerificationError } from '../error.js'
import { type VerifyMacParams, verifyRecordMac } from '../mac.js'
import {
  RepoCommit,
  type VerifyCommitParams,
  verifyCommit,
} from '../repo-commit.js'
import {
  COMMIT_VERSION,
  REPO_STAR_LIMITS,
  type SpaceCommit,
  type SpaceRecord,
  defs,
} from '../types.js'
import { parseRecordPath } from '../util.js'

export type VerifySpaceRepoParams = VerifyCommitParams

export type VerifiedRecord = {
  collection: NsidString
  rkey: RecordKeyString
  cid: CborCid
  record: SpaceRecord
}

/**
 * @note **IMPORTANT** to avoid resource leaks, the {@link VerifiedSpaceRepo} must be
 * disposed of when done, either by calling its `[Symbol.asyncDispose]()`
 * method, by using it in a `using` statement, or by consuming at least one of
 * its `records` (and then `return()`ing the iterator).
 */
export type VerifiedSpaceRepo = AsyncDisposable & {
  commit: SpaceCommit
  records: AsyncGenerator<VerifiedRecord>
}

/**
 * Read a serialized repo, streaming out its records, without authenticating its
 * commit. The records are checked against the commit's data as in
 * {@link verifyRepoStar}, but nothing vouches for the commit itself. This suits a
 * repo host importing an account's own repo, which comes with no MAC to check.
 */
export async function readRepoStar(
  star: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<VerifiedSpaceRepo> {
  const starReader = await readStar(star, REPO_STAR_LIMITS)
  // Note the try/catch would better be implemented with a DisposableStack, but
  // that isn't (widely) available yet.
  try {
    const commit = parseMeta(starReader.meta)
    if (commit.ver !== COMMIT_VERSION) {
      throw new SpaceRepoVerificationError(
        `unsupported commit version: ${commit.ver}`,
      )
    }

    return {
      commit,
      records: verifyStarRecords(starReader.pairs, commit),
      [Symbol.asyncDispose]: starReader[Symbol.asyncDispose].bind(starReader),
    }
  } catch (err) {
    await starReader[Symbol.asyncDispose]()
    throw err
  }
}

/**
 * Verify a serialized repo, streaming out its records.
 *
 * The commit in the archive's metadata is verified against the response's MAC
 * up front. Each record is folded into a running set hash as `records` is
 * drained, and the result is compared against the commit's data once the
 * archive ends. Only that match shows the repo was received complete, so
 * `records` must be fully consumed before trusting what it yielded —
 * {@link verifyRepoStarFull} does that.
 */
export async function verifyRepoStar(
  star: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  params: VerifySpaceRepoParams,
): Promise<VerifiedSpaceRepo> {
  const repo = await readRepoStar(star)
  try {
    verifyCommit(repo.commit, params)
    return repo
  } catch (err) {
    await repo[Symbol.asyncDispose]()
    throw err
  }
}

/**
 * Verify a serialized repo and collect its records. Prefer {@link verifyRepoStar}
 * for large repos, where streaming avoids holding every record at once.
 */
export async function verifyRepoStarFull(
  star: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  params: VerifySpaceRepoParams,
): Promise<{ commit: SpaceCommit; records: VerifiedRecord[] }> {
  const { commit, records } = await verifyRepoStar(star, params)
  const collected: VerifiedRecord[] = []
  for await (const record of records) {
    collected.push(record)
  }
  return { commit, records: collected }
}

export type VerifyRecordParams = VerifyMacParams & {
  // The uri of the record that was requested.
  uri: SpaceAtUriString
}

/**
 * Verify a `getRecord` response against the MAC it carried: it must be the
 * record that was requested, the MAC must cover its uri and cid, and its value
 * must encode to that cid.
 *
 * @throws {SpaceRepoVerificationError} if the record is not the one requested,
 * or its value does not match its cid
 * @throws {SpaceMacError} if the MAC does not match
 */
export async function verifyRecord(
  record: { uri: string; cid: string; value: SpaceRecord },
  params: VerifyRecordParams,
): Promise<void> {
  if (record.uri !== params.uri) {
    throw new SpaceRepoVerificationError(
      `record is not the one requested: ${record.uri}`,
    )
  }
  const cid = parseCidSafe(record.cid, { flavor: 'cbor' })
  if (!cid) {
    throw new SpaceRepoVerificationError(`invalid record cid: ${record.cid}`)
  }
  verifyRecordMac(params.uri, cid, params)
  const valueCid = await cidForCbor(encode(record.value))
  if (!valueCid.equals(cid)) {
    throw new SpaceRepoVerificationError('record value does not match its cid')
  }
}

async function* verifyStarRecords(
  pairs: AsyncIterable<StarPair>,
  commit: SpaceCommit,
): AsyncGenerator<VerifiedRecord> {
  const decoder = new TextDecoder()
  const repo = new RepoCommit()
  let prevKey: Uint8Array | undefined

  for await (const { key, value } of pairs) {
    const path = decoder.decode(key)
    const { collection, rkey } = parseRecordPath(path)

    if (prevKey !== undefined && compareBytes(key, prevKey) <= 0) {
      throw new SpaceRepoVerificationError(`records out of order at ${path}`)
    }
    prevKey = key

    let record: LexValue
    try {
      record = decode(value)
    } catch (cause) {
      throw new SpaceRepoVerificationError(`invalid record cbor at ${path}`, {
        cause,
      })
    }
    // Ensure that the encoded record is a plain object (LexMap)
    if (!isPlainObject(record)) {
      throw new SpaceRepoVerificationError(`invalid record at ${path}`)
    }

    const cid = await cidForCbor(value)
    repo.add(collection, rkey, cid)
    yield { collection, rkey, cid, record }
  }

  if (!repo.matches(commit)) {
    throw new SpaceRepoVerificationError('records do not match the commit data')
  }
}

function parseMeta(meta: unknown) {
  try {
    return defs.repoStarMeta.schema.parse(meta)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new SpaceRepoVerificationError(
      `invalid ${defs.repoStarMeta.name}: ${message}`,
      { cause: err },
    )
  }
}
