import { ensureValidAtIdentifier, isDidIdentifier } from './at-identifier.js'
import type { AtIdentifierString } from './at-identifier.js'
import type { AtUriString, SpaceRefString } from './aturi_validation.js'
import { InvalidAtUriError, SPACE_MARKER } from './aturi_validation.js'
import type { DidString } from './did.js'
import { InvalidDidError, ensureValidDid, isValidDid } from './did.js'
import type { NsidString } from './nsid.js'
import { ensureValidNsid, isValidNsid } from './nsid.js'
import type { RecordKeyString } from './recordkey.js'
import { ensureValidRecordKey } from './recordkey.js'

export * from './aturi_validation.js'

// Re-export types used in public interface
export type {
  AtIdentifierString,
  AtUriString,
  DidString,
  NsidString,
  RecordKeyString,
}

export const ATP_URI_REGEX =
  // proto-    --did--------------   --name----------------   --path----   --query--   --hash--
  /^(at:\/\/)?((?:did:[a-z0-9:%-]+)|(?:[a-z0-9][a-z0-9.:-]*))(\/[^?#\s]*)?(\?[^#\s]+)?(#[^\s]+)?$/i
//                       --path-----   --query--  --hash--
const RELATIVE_REGEX = /^(\/[^?#\s]*)?(\?[^#\s]+)?(#[^\s]+)?$/i

/**
 * An AT URI, addressing either public repo data or permissioned space data:
 *
 *     at://{authorDid}/{collection}/{rkey}                                        (public)
 *     at://{spaceDid}/space/{spaceType}/{skey}[/{authorDid}/{collection}/{rkey}]  (space)
 */
export class AtUri {
  hash: string
  host: AtIdentifierString
  pathname: string
  searchParams: URLSearchParams

  constructor(uri: string, base?: string | AtUri) {
    const parsed =
      base !== undefined
        ? typeof base === 'string'
          ? Object.assign(parse(base), parseRelative(uri))
          : Object.assign({ host: base.host }, parseRelative(uri))
        : parse(uri)

    ensureValidAtIdentifier(parsed.host)

    this.hash = parsed.hash ?? ''
    this.host = parsed.host
    this.pathname = parsed.pathname ?? ''
    this.searchParams = parsed.searchParams
  }

  private get parts(): AtUriPathParts {
    return parsePath(this.host, this.pathname)
  }

  static make(handleOrDid: string, collection?: string, rkey?: string) {
    let str = handleOrDid
    if (collection) str += '/' + collection
    if (rkey) str += '/' + rkey
    return new AtUri(str)
  }

  static makeSpace(
    spaceDid: string,
    spaceType: string,
    skey: string,
    authorDid?: string,
    collection?: string,
    rkey?: string,
  ) {
    ensureValidDid(spaceDid)
    ensureValidNsid(spaceType)
    ensureValidRecordKey(skey)
    if (authorDid) ensureValidDid(authorDid)
    if (collection) ensureValidNsid(collection)
    if (rkey) ensureValidRecordKey(rkey)

    let str = `at://${spaceDid}/${SPACE_MARKER}/${spaceType}/${skey}`
    if (authorDid) str += '/' + authorDid
    if (collection) str += '/' + collection
    if (rkey) str += '/' + rkey
    return new AtUri(str)
  }

  get isSpace(): boolean {
    return this.parts.isSpace
  }

  get protocol() {
    return 'at:'
  }

  get origin() {
    return `at://${this.host}` as const
  }

  /**
   * The authority, as a DID.
   *
   * @deprecated ambiguous on space URIs, where the authority owns the space but
   * the record belongs to one of its members. Use {@link AtUri#authorDid} for the
   * account whose record this is, or {@link AtUri#spaceDid} for the space's
   * authority.
   */
  get did(): DidString {
    const { host } = this
    if (isDidIdentifier(host)) return host
    throw new InvalidDidError(`AtUri "${this}" does not have a DID hostname`)
  }

  get authorDid(): DidString | undefined {
    return this.parts.authorDid
  }

  get hostname(): AtIdentifierString {
    return this.host
  }

  set hostname(v: string) {
    ensureValidAtIdentifier(v)
    this.host = v
  }

  get search() {
    return this.searchParams.toString()
  }

  set search(v: string) {
    this.searchParams = new URLSearchParams(v)
  }

  get collection() {
    return this.parts.collection || ''
  }

  get collectionSafe(): NsidString {
    const { collection } = this
    ensureValidNsid(collection)
    return collection
  }

  set collection(v: string) {
    ensureValidNsid(v)
    this.unsafelySetCollection(v)
  }

  unsafelySetCollection(v: string) {
    const segments = this.pathname.split('/').filter(Boolean)
    segments[this.isSpace ? 4 : 0] = v
    this.pathname = segments.join('/')
  }

  get rkey() {
    return this.parts.rkey || ''
  }

  get rkeySafe(): RecordKeyString {
    const { rkey } = this
    ensureValidRecordKey(rkey)
    return rkey
  }

  set rkey(v: string) {
    ensureValidRecordKey(v)
    this.unsafelySetRkey(v)
  }

  unsafelySetRkey(v: string) {
    const segments = this.pathname.split('/').filter(Boolean)
    const collectionAt = this.isSpace ? 4 : 0
    segments[collectionAt] ||= 'undefined'
    segments[collectionAt + 1] = v
    this.pathname = segments.join('/')
  }

  get spaceDid(): DidString | undefined {
    return this.parts.spaceDid
  }

  get spaceType(): NsidString | undefined {
    return this.parts.spaceType
  }

  get skey(): string | undefined {
    return this.parts.skey
  }

  /**
   * The space this URI belongs to, whether it names the space itself or a record
   * within it. Undefined on a public URI.
   */
  spaceRef(): SpaceRef | undefined {
    const { spaceDid, spaceType, skey } = this.parts
    if (!spaceDid || !spaceType || !skey) return undefined
    return new SpaceRef(spaceDid, spaceType, skey)
  }

  get href() {
    return this.toString()
  }

  toString(): AtUriString {
    let pathname = this.pathname
    if (pathname && !pathname.startsWith('/')) {
      pathname = `/${pathname}`
    }
    while (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    let qs = ''
    if (this.searchParams.size) {
      qs = `?${this.searchParams.toString()}`
    }
    // @NOTE We keep the hash as-is, even if it doesn't start with a '/'.
    let fragment = this.hash
    if (fragment === '#') {
      fragment = ''
    } else if (fragment && !fragment.startsWith('#')) {
      fragment = `#${fragment}`
    }
    return `at://${this.host}${pathname}${qs}${fragment}` as AtUriString
  }
}

/**
 * A reference to a space, as distinct from a record within one:
 *
 *     at://{spaceDid}/space/{spaceType}/{skey}
 */
export class SpaceRef {
  constructor(
    readonly spaceDid: DidString,
    readonly spaceType: NsidString,
    readonly skey: string,
  ) {}

  static parse(ref: string): SpaceRef {
    const parsed = new AtUri(ref).spaceRef()
    if (!parsed || parsed.toString() !== ref) {
      throw new InvalidAtUriError(`Invalid space ref: ${ref}`)
    }
    return parsed
  }

  toString(): SpaceRefString {
    return `at://${this.spaceDid}/${SPACE_MARKER}/${this.spaceType}/${this.skey}` as SpaceRefString
  }
}

type AtUriPathParts = {
  isSpace: boolean
  spaceDid?: DidString
  spaceType?: NsidString
  skey?: string
  authorDid?: DidString
  collection?: string
  rkey?: string
}

function parsePath(host: string, pathname: string): AtUriPathParts {
  const segments = pathname.split('/').filter(Boolean)

  if (segments[0] !== SPACE_MARKER) {
    const [collection, rkey] = segments
    return {
      isSpace: false,
      authorDid: isValidDid(host) ? host : undefined,
      collection,
      rkey,
    }
  }

  const [, spaceType, skey, author, collection, rkey] = segments
  return {
    isSpace: true,
    spaceDid: isValidDid(host) ? host : undefined,
    spaceType: spaceType && isValidNsid(spaceType) ? spaceType : undefined,
    skey,
    authorDid: author && isValidDid(author) ? author : undefined,
    collection,
    rkey,
  }
}

function parse(str: string) {
  const match = str.match(ATP_URI_REGEX) as null | {
    0: string
    1: string | undefined // proto
    2: string // host
    3: string | undefined // path
    4: string | undefined // query
    5: string | undefined // hash
  }

  if (!match) {
    throw new Error(`Invalid AT uri: ${str}`)
  }

  return {
    host: match[2],
    hash: match[5],
    pathname: match[3],
    searchParams: new URLSearchParams(match[4]),
  }
}

function parseRelative(str: string) {
  const match = str.match(RELATIVE_REGEX) as null | {
    0: string
    1: string | undefined // path
    2: string | undefined // query
    3: string | undefined // hash
  }

  if (!match) {
    throw new Error(`Invalid path: ${str}`)
  }

  return {
    hash: match[3],
    pathname: match[1],
    searchParams: new URLSearchParams(match[2]),
  }
}
