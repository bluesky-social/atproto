import { type LexValue, decode, encode } from '@atproto/lex-cbor'
import {
  type Cid,
  cidForCbor,
  isPlainObject,
  parseCidSafe,
} from '@atproto/lex-data'
import type { NsidString, RecordKeyString } from '@atproto/syntax'
import { compareBytes } from '../bytes.js'
import { RepoVerificationError } from '../error.js'
import { verifyRecordMac } from '../mac.js'
import {
  RepoCommit,
  type VerifyCommitParams,
  verifyCommit,
} from '../repo-commit.js'
import { type StarPair, readStar } from '../star.js'
import {
  COMMIT_VERSION,
  type Commit,
  MAX_RECORD_SIZE,
  type SpaceRecord,
  defs,
} from '../types.js'
import { parseRecordPath } from '../util.js'

export type VerifyRepoParams = VerifyCommitParams

export type VerifiedRecord = {
  collection: NsidString
  rkey: RecordKeyString
  cid: Cid
  record: SpaceRecord
}

/**
 * @note **IMPORTANT** to avoid resource leaks, the {@link VerifiedRepo} must be
 * disposed of when done, either by calling its `[Symbol.asyncDispose]()`
 * method, by using it in a `using` statement, or by consuming at least one of
 * its `records` (and then `return()`ing the iterator).
 */
export type VerifiedRepo = AsyncDisposable & {
  commit: Commit
  records: AsyncGenerator<VerifiedRecord>
}

/**
 * Read a serialized repo, streaming out its records, without authenticating its
 * commit. The records are checked against the commit's data as in
 * {@link verifyRepoStar}, but nothing vouches for the commit itself. This suits a
 * repo host importing an account's own repo, which comes with no MAC to check.
 */
export const readRepoStar = async (
  star: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<VerifiedRepo> => {
  const starReader = await readStar(star, { maxValueLength: MAX_RECORD_SIZE })
  // Note the try/catch would better be implemented with a DisposableStack, but
  // that isn't (widely) available yet.
  try {
    const commit = parseMeta(starReader.meta)
    if (commit.ver !== COMMIT_VERSION) {
      throw new RepoVerificationError(
        `unsupported commit version: ${commit.ver}`,
      )
    }

    return {
      commit,
      records: verifyStarRecords(starReader.pairs, commit),
      [Symbol.asyncDispose]: starReader[Symbol.asyncDispose],
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
export const verifyRepoStar = async (
  star: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  params: VerifyRepoParams,
): Promise<VerifiedRepo> => {
  const repo = await readRepoStar(star)
  try {
    if (!verifyCommit(repo.commit, params)) {
      throw new RepoVerificationError('commit failed verification')
    }
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
export const verifyRepoStarFull = async (
  star: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  params: VerifyRepoParams,
): Promise<{ commit: Commit; records: VerifiedRecord[] }> => {
  const { commit, records } = await verifyRepoStar(star, params)
  const collected: VerifiedRecord[] = []
  for await (const record of records) {
    collected.push(record)
  }
  return { commit, records: collected }
}

export type VerifyRecordParams = {
  // The uri of the record that was requested.
  uri: string
  // The shared secret for the request, and the MAC from its response header.
  sharedSecret: Uint8Array
  mac: Uint8Array
}

/**
 * Verify a `getRecord` response against the MAC it carried: it must be the
 * record that was requested, the MAC must cover its uri and cid, and its value
 * must encode to that cid.
 */
export const verifyRecord = async (
  record: { uri: string; cid: string; value: SpaceRecord },
  params: VerifyRecordParams,
): Promise<boolean> => {
  if (record.uri !== params.uri) return false
  const cid = parseCidSafe(record.cid)
  if (!cid) return false
  if (!verifyRecordMac(params.sharedSecret, record.uri, cid, params.mac)) {
    return false
  }
  const valueCid = await cidForCbor(encode(record.value))
  return valueCid.equals(cid)
}

async function* verifyStarRecords(
  pairs: AsyncIterable<StarPair>,
  commit: Commit,
): AsyncGenerator<VerifiedRecord> {
  const decoder = new TextDecoder()
  const repo = new RepoCommit()
  let prevKey: Uint8Array | undefined

  for await (const { key, value } of pairs) {
    const path = decoder.decode(key)
    const { collection, rkey } = parseRecordPath(path)

    if (prevKey !== undefined && compareBytes(key, prevKey) <= 0) {
      throw new RepoVerificationError(`records out of order at ${path}`)
    }
    prevKey = key

    let record: LexValue
    try {
      record = decode(value)
    } catch (cause) {
      throw new RepoVerificationError(`invalid record cbor at ${path}`, {
        cause,
      })
    }
    // Ensure that the encoded record is a plain object (LexMap)
    if (!isPlainObject(record)) {
      throw new RepoVerificationError(`invalid record at ${path}`)
    }

    const cid = await cidForCbor(value)
    repo.add(collection, rkey, cid)
    yield { collection, rkey, cid, record }
  }

  if (!repo.matches(commit)) {
    throw new RepoVerificationError('records do not match the commit data')
  }
}

function parseMeta(meta: unknown) {
  try {
    return defs.repoStarMeta.schema.parse(meta)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new RepoVerificationError(
      `invalid ${defs.repoStarMeta.name}: ${message}`,
    )
  }
}
