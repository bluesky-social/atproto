import type {
  AtUriString,
  DidString,
  NsidString,
  SpaceRefString,
} from '@atproto/syntax'

/**
 * Matches the uris strictly between `gt` and `lt`. The bounds aren't uris
 * themselves, but are typed as the column they're compared with.
 */
export type UriRange<T extends string = string> = { gt: T; lt: T }

// A space record uri is `{space}/{authorDid}/{collection}/{rkey}`, and a space
// uri is `at://{authorityDid}/space/{type}/{skey}`. No DID, NSID, skey or rkey
// contains '/', and an actor store holds the records of a single author DID. So
// every uri that starts with one of these '/'-terminated prefixes lies strictly
// between the prefix and the prefix with its '/' replaced by '0', the byte after
// '/', and no other uri does. That lets the uri primary key serve these filters
// as a range, in uri order.
const prefixRange = <T extends string>(prefix: string): UriRange<T> => ({
  gt: prefix as T,
  lt: `${prefix.slice(0, -1)}0` as T,
})

/** The records in a space. */
export const spaceRecordRange = (
  space: SpaceRefString,
): UriRange<AtUriString> => prefixRange(`${space}/`)

/** The records of one collection in a space, written by `did`. */
export const collectionRecordRange = (
  space: SpaceRefString,
  did: DidString,
  collection: NsidString,
): UriRange<AtUriString> => prefixRange(`${space}/${did}/${collection}/`)

/** The spaces whose authority is `did`. */
export const authoritySpaceRange = (did: DidString): UriRange<SpaceRefString> =>
  prefixRange(`at://${did}/space/`)

// A paging cursor replaces the range's bound on its side, rather than adding a
// second bound there: given two lower (or upper) bounds on a column, SQLite
// seeks on one and checks the other row by row, so later pages would read every
// row before the cursor again. A range's bounds are ASCII, so comparing them to
// a cursor in JS agrees with SQLite's byte order, whatever the cursor holds.

/** The uris in `range` after `cursor`. */
export const rangeAfter = <T extends string>(
  range: UriRange<T>,
  cursor?: T,
): UriRange<T> =>
  cursor !== undefined && cursor > range.gt ? { ...range, gt: cursor } : range

/** The uris in `range` before `cursor`. */
export const rangeBefore = <T extends string>(
  range: UriRange<T>,
  cursor?: T,
): UriRange<T> =>
  cursor !== undefined && cursor < range.lt ? { ...range, lt: cursor } : range
