import { type LexValue, decode } from '@atproto/lex-cbor'
import { type Cid, cidForCbor, isPlainObject } from '@atproto/lex-data'
import type { NsidString, RecordKeyString } from '@atproto/syntax'
import { RepoVerificationError } from '../error.js'
import {
  RepoCommit,
  type VerifyCommitParams,
  verifyCommit,
} from '../repo-commit.js'
import { type StarPair, readStar } from '../star.js'
import {
  type Commit,
  MAX_RECORD_SIZE,
  type SpaceRecord,
  defs,
} from '../types.js'
import { compareBytes, parseRecordPath } from '../util.js'

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
 * Verify a serialized repo, streaming out its records.
 *
 * The commit in the archive's metadata is verified against the response's MAC
 * up front. Each record is folded into a running set hash as `records` is
 * drained, and the result is compared against the commit's data once the
 * archive ends. Only that match
 * shows the repo was received complete, so `records` must be fully consumed
 * before trusting what it yielded — {@link verifyRepoStarFull} does that.
 */
export const verifyRepoStar = async (
  star: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  params: VerifyRepoParams,
): Promise<VerifiedRepo> => {
  const starReader = await readStar(star, { maxValueLength: MAX_RECORD_SIZE })
  // Note the try/catch would better be implemented with a DisposableStack, but
  // that isn't (widely) available yet.
  try {
    const commit = parseMeta(starReader.meta)
    if (!verifyCommit(commit, params)) {
      throw new RepoVerificationError('commit failed verification')
    }

    return {
      commit,
      records: verifyRecords(starReader.pairs, commit),
      [Symbol.asyncDispose]: starReader[Symbol.asyncDispose],
    }
  } catch (err) {
    await starReader[Symbol.asyncDispose]()
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

async function* verifyRecords(
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
