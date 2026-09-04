import type { Cid } from '@atproto/lex-data'
import {
  type NsidString,
  type RecordKeyString,
  isValidNsid,
  isValidRecordKey,
} from '@atproto/syntax'
import { RepoVerificationError } from './error.js'
import type { IndexKey, RecordPath } from './types.js'

export function formatRecordPath<
  TCollection extends NsidString,
  TRkey extends RecordKeyString,
>(collection: TCollection, rkey: TRkey): IndexKey<TCollection, TRkey> {
  return `${collection}/${rkey}` as const
}

export function parseRecordPath(path: string): RecordPath {
  const { length, 0: collection, 1: rkey } = path.split('/')
  if (length !== 2) {
    throw new RepoVerificationError(`invalid record path: ${path}`)
  }
  if (!isValidNsid(collection)) {
    throw new RepoVerificationError(`invalid NSID in record path: ${path}`)
  }
  if (!isValidRecordKey(rkey)) {
    throw new RepoVerificationError(
      `invalid record key in record path: ${path}`,
    )
  }
  return { collection, rkey }
}

// The element a record contributes to a repo's set hash.
export function formatSetHashElement<
  TCollection extends NsidString,
  TRkey extends RecordKeyString,
>(
  collection: TCollection,
  rkey: TRkey,
  cid: Cid,
): `${IndexKey<TCollection, TRkey>}/${string}` {
  const path = formatRecordPath(collection, rkey)
  return `${path}/${cid.toString()}`
}
