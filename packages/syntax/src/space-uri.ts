import { AtUri } from './aturi.js'
import { DidString } from './did.js'

/**
 * Permissioned "space" URIs are ordinary `at://` URIs with a fixed `space`
 * marker segment sitting where a collection NSID would appear in a public
 * atproto URI:
 *
 *     at://{authorityDid}/space/{spaceType}/{skey}[/{authorDid}/{collection}/{rkey}]
 *
 * The two are unambiguous: a public collection is an NSID (always ≥2 dots)
 * whereas the `space` marker has none. Space URIs therefore reuse {@link AtUri}
 * for parsing and validation rather than defining their own scheme; the helpers
 * below add the space-specific reading of the path segments.
 */

export const SPACE_MARKER = 'space'

export class InvalidSpaceUriError extends Error {}

/** Build a space URI from its components. */
export function createSpaceUri(
  authorityDid: string,
  spaceType: string,
  skey: string,
  authorDid?: string,
  collection?: string,
  rkey?: string,
): AtUri {
  let str = `at://${authorityDid}/${SPACE_MARKER}/${spaceType}/${skey}`
  if (authorDid) str += `/${authorDid}`
  if (collection) str += `/${collection}`
  if (rkey) str += `/${rkey}`
  return new AtUri(str)
}

/**
 * A parsed space URI. Wraps {@link AtUri} and exposes the space-specific path
 * segments. Throws {@link InvalidSpaceUriError} if the URI is not a space URI
 * (missing the `space` marker or the required authority/type/skey segments).
 */
export class SpaceUri {
  private readonly uri: AtUri
  private readonly parts: string[]

  readonly authorityDid: DidString

  constructor(uri: string | AtUri) {
    this.uri = typeof uri === 'string' ? new AtUri(uri) : uri
    // The space authority is always a DID (proposal 0016). AtUri.did throws if
    // the host is a handle.
    this.authorityDid = this.uri.did
    this.parts = this.uri.pathname.split('/').filter(Boolean)
    if (this.parts[0] !== SPACE_MARKER) {
      throw new InvalidSpaceUriError(
        `Not a space URI (missing "${SPACE_MARKER}" marker): ${this.uri}`,
      )
    }
    if (!this.parts[1] || !this.parts[2]) {
      throw new InvalidSpaceUriError(
        `Space URI missing type or skey: ${this.uri}`,
      )
    }
  }

  get spaceType(): string {
    return this.parts[1]
  }

  get skey(): string {
    return this.parts[2]
  }

  /** The space portion of the URI: at://{authorityDid}/space/{type}/{skey} */
  get space(): string {
    return `at://${this.authorityDid}/${SPACE_MARKER}/${this.spaceType}/${this.skey}`
  }

  // Record-level segments (present only on a full record URI).

  get authorDid(): string {
    return this.parts[3] ?? ''
  }

  get collection(): string {
    return this.parts[4] ?? ''
  }

  get rkey(): string {
    return this.parts[5] ?? ''
  }

  toString(): string {
    return this.uri.toString()
  }
}
