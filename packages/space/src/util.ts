import type { Cid } from '@atproto/lex-data'
import {
  type NsidString,
  type RecordKeyString,
  isValidNsid,
  isValidRecordKey,
} from '@atproto/syntax'
import { SpaceRepoVerificationError } from './error.js'
import type { RecordPathParts, RecordPathString } from './types.js'

export function formatRecordPath<
  TCollection extends NsidString,
  TRkey extends RecordKeyString,
>(collection: TCollection, rkey: TRkey): RecordPathString<TCollection, TRkey> {
  return `${collection}/${rkey}` as const
}

export function parseRecordPath(path: string): RecordPathParts {
  const { length, 0: collection, 1: rkey } = path.split('/')
  if (length !== 2) {
    throw new SpaceRepoVerificationError(`invalid record path: ${path}`)
  }
  if (!isValidNsid(collection)) {
    throw new SpaceRepoVerificationError(`invalid NSID in record path: ${path}`)
  }
  if (!isValidRecordKey(rkey)) {
    throw new SpaceRepoVerificationError(
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
): `${RecordPathString<TCollection, TRkey>}/${string}` {
  const path = formatRecordPath(collection, rkey)
  return `${path}/${cid.toString()}`
}
