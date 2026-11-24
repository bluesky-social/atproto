import type { DidString, NsidString, SpaceRefString } from '@atproto/syntax'

/** Matches the uris strictly between `gt` and `lt`. */
export type UriRange = { gt: string; lt: string }

// A space record uri is `{space}/{authorDid}/{collection}/{rkey}`, and a space
// uri is `at://{authorityDid}/space/{type}/{skey}`. No DID, NSID, skey or rkey
// contains '/', and an actor store holds the records of a single author DID. So
// every uri that starts with one of these '/'-terminated prefixes lies strictly
// between the prefix and the prefix with its '/' replaced by '0', the byte after
// '/', and no other uri does. That lets the uri primary key serve these filters
// as a range, in uri order.
const prefixRange = (prefix: string): UriRange => ({
  gt: prefix,
  lt: `${prefix.slice(0, -1)}0`,
})

/** The records in a space. */
export const spaceRecordRange = (space: SpaceRefString): UriRange =>
  prefixRange(`${space}/`)

/** The records of one collection in a space, written by `did`. */
export const collectionRecordRange = (
  space: SpaceRefString,
  did: DidString,
  collection: NsidString,
): UriRange => prefixRange(`${space}/${did}/${collection}/`)

/** The spaces whose authority is `did`. */
export const authoritySpaceRange = (did: DidString): UriRange =>
  prefixRange(`at://${did}/space/`)
