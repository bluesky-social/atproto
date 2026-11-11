import type { Cid } from '@atproto/lex-data'
import type { AtUriString, DidString } from '@atproto/syntax'
import {
  COMMIT_MAC_PROFILE,
  type MacParams,
  RECORD_MAC_PROFILE,
  type SpaceCommit,
  createCommitMacHeaders,
  createRecordMacHeaders,
  formatMacRequest,
  parseMacRequest,
} from '../src/index.js'

// Stands in for the key share of a syncer's MAC request. These tests pick the
// shared secret directly rather than deriving it, so the key is never used.
export const KEY_SHARE: DidString = 'did:key:zDnaExample'

/**
 * What a syncer verifies a commit with after a host MACs it under `hostSecret`.
 * The syncer expects `sharedSecret`, so the two differ only when a test says so.
 */
export function commitMacParams(
  commit: SpaceCommit,
  sharedSecret: Uint8Array,
  hostSecret = sharedSecret,
): MacParams {
  const request = parseMacRequest(
    formatMacRequest(COMMIT_MAC_PROFILE, KEY_SHARE),
    COMMIT_MAC_PROFILE,
  )!
  const headers = createCommitMacHeaders(request, hostSecret, commit)
  return { keyShare: KEY_SHARE, sharedSecret, headers: new Headers(headers) }
}

/** As {@link commitMacParams}, for a record. */
export function recordMacParams(
  uri: AtUriString,
  cid: Cid,
  sharedSecret: Uint8Array,
  hostSecret = sharedSecret,
): MacParams {
  const request = parseMacRequest(
    formatMacRequest(RECORD_MAC_PROFILE, KEY_SHARE),
    RECORD_MAC_PROFILE,
  )!
  const headers = createRecordMacHeaders(request, hostSecret, uri, cid)
  return { keyShare: KEY_SHARE, sharedSecret, headers: new Headers(headers) }
}
