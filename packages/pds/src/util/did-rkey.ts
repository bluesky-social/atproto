import type { DidString, RecordKeyString } from '@atproto/syntax'

// A DID used as a record key, such as a member's published record. A record key
// can't contain `%`, so the percent-encoded port of a localhost did:web is left
// unencoded: did:web:localhost%3A2583 <-> did:web:localhost:2583. This is
// unambiguous because the unencoded form would otherwise be a did:web path, which
// atproto doesn't support.
// @TODO a stopgap until Lexicon has a record key format for DIDs

export function didToRecordKey(did: DidString): RecordKeyString {
  return did.replace('%3A', ':')
}

export function recordKeyToDid(rkey: string): string {
  return rkey.replace(/^(did:web:[^:]+):(\d+)$/, '$1%3A$2')
}
