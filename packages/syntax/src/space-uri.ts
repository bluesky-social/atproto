import { DidString, ensureValidDid, isValidDid } from './did.js'
import { NsidString, ensureValidNsid, isValidNsid } from './nsid.js'
import { isValidRecordKey } from './recordkey.js'

/**
 * Space URI format:
 * ats://spaceDid/spaceType/skey[/userDid/collection/rkey]
 *
 * First three parts (spaceDid, spaceType, skey) are required.
 * Last three parts (userDid, collection, rkey) are optional.
 */

export type SpaceUriString = `ats://${string}`

// Parser regex accepts the optional `ats://` prefix (constructor convenience).
// Strict format validation (isSpaceUriString / assertSpaceUriString) requires it.
const SPACE_URI_REGEX = /^(ats:\/\/)?([^/?#\s]+)(\/[^?#\s]*)?$/i

// Used by the format validators below. Mirrors the at-uri charset policy.
const INVALID_CHAR_REGEXP = /[^a-zA-Z0-9._~:@!$&'()*+,;=%/\\[\]#?-]/
const STRICT_SPACE_URI_REGEXP =
  /^ats:\/\/(?<authority>[^/?#\s]+)(?:\/(?<spaceType>[^/?#\s]+)(?:\/(?<skey>[^/?#\s]+)(?:\/(?<userDid>[^/?#\s]+)(?:\/(?<collection>[^/?#\s]+)(?:\/(?<rkey>[^/?#\s]+))?)?)?)?)?$/i

export type ParseSpaceUriStringOptions = {
  /**
   * If true, validates NSID / DID / record key components strictly. If false,
   * any non-empty path segment is accepted.
   *
   * @default true
   */
  strict?: boolean
}

/**
 * Type guard: checks whether an input is a valid {@link SpaceUriString}.
 *
 * @see {@link SpaceUriString}
 */
export function isSpaceUriString<I>(
  input: I,
  options?: ParseSpaceUriStringOptions,
): input is I & SpaceUriString {
  if (typeof input !== 'string') return false
  if (input.length > 8192) return false
  if (INVALID_CHAR_REGEXP.test(input)) return false

  const match = input.match(STRICT_SPACE_URI_REGEXP)
  const groups = match?.groups
  if (!groups) return false

  if (!isValidDid(groups.authority)) return false

  if (options?.strict !== false) {
    if (groups.spaceType && !isValidNsid(groups.spaceType)) return false
    if (groups.userDid && !isValidDid(groups.userDid)) return false
    if (groups.collection && !isValidNsid(groups.collection)) return false
    if (groups.rkey && !isValidRecordKey(groups.rkey)) return false
  }

  return true
}

/** Returns the input if it is a valid {@link SpaceUriString}, otherwise undefined. */
export function ifSpaceUriString<I>(
  input: I,
  options?: ParseSpaceUriStringOptions,
): undefined | (I & SpaceUriString) {
  return isSpaceUriString(input, options) ? input : undefined
}

/** Casts to {@link SpaceUriString}, throwing if invalid. */
export function asSpaceUriString<I>(
  input: I,
  options?: ParseSpaceUriStringOptions,
): I & SpaceUriString {
  assertSpaceUriString(input, options)
  return input
}

/** Asserts the input is a valid {@link SpaceUriString}. */
export function assertSpaceUriString<I>(
  input: I,
  options?: ParseSpaceUriStringOptions,
): asserts input is I & SpaceUriString {
  if (!isSpaceUriString(input, options)) {
    throw new InvalidSpaceUriError(
      typeof input === 'string'
        ? `Invalid Space URI: ${input}`
        : 'Space URI must be a string',
    )
  }
}

export class InvalidSpaceUriError extends Error {}

export class SpaceUri {
  spaceDid: DidString
  pathname: string

  constructor(uri: string) {
    const match = uri.match(SPACE_URI_REGEX)
    if (!match) {
      throw new Error(`Invalid Space URI: ${uri}`)
    }
    const did = match[2]
    ensureValidDid(did)
    this.spaceDid = did
    this.pathname = match[3] ?? ''
  }

  private get parts(): string[] {
    return this.pathname.split('/').filter(Boolean)
  }

  static make(
    spaceDid: string,
    spaceType: string,
    skey: string,
    userDid?: string,
    collection?: string,
    rkey?: string,
  ) {
    let str = `ats://${spaceDid}/${spaceType}/${skey}`
    if (userDid) str += `/${userDid}`
    if (collection) str += `/${collection}`
    if (rkey) str += `/${rkey}`
    return new SpaceUri(str)
  }

  get protocol() {
    return 'ats:'
  }

  get origin(): `ats://${DidString}` {
    return `ats://${this.spaceDid}`
  }

  // --- Required parts ---

  get spaceType(): string {
    return this.parts[0] ?? ''
  }

  get spaceTypeSafe(): NsidString {
    const val = this.spaceType
    ensureValidNsid(val)
    return val
  }

  get skey(): string {
    return this.parts[1] ?? ''
  }

  /** The space portion of the URI: ats://spaceDid/type/skey */
  get space(): string {
    return `ats://${this.spaceDid}/${this.spaceType}/${this.skey}`
  }

  // --- Optional parts (user/collection/rkey) ---

  get userDid(): string {
    return this.parts[2] ?? ''
  }

  get userDidSafe(): DidString {
    const val = this.userDid
    ensureValidDid(val)
    return val
  }

  get collection(): string {
    return this.parts[3] ?? ''
  }

  get collectionSafe(): NsidString {
    const val = this.collection
    ensureValidNsid(val)
    return val
  }

  get rkey(): string {
    return this.parts[4] ?? ''
  }

  get href() {
    return this.toString()
  }

  toString(): SpaceUriString {
    let path = this.pathname || ''
    if (path && !path.startsWith('/')) {
      path = `/${path}`
    }
    return `ats://${this.spaceDid}${path}`
  }
}
