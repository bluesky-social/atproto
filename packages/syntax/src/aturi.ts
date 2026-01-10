import { AtIdentifierString, ensureValidAtIdentifier } from './at-identifier.js'
import { AtUriString } from './aturi_validation.js'
import { ensureValidNsid } from './nsid.js'

export * from './aturi_validation.js'

export const ATP_URI_REGEX =
  // proto-    --did--------------   --name----------------   --path----   --query--   --hash--
  /^(at:\/\/)?((?:did:[a-z0-9:%-]+)|(?:[a-z0-9][a-z0-9.:-]*))(\/[^?#\s]*)?(\?[^#\s]+)?(#[^\s]+)?$/i
//                       --path-----   --query--  --hash--
const RELATIVE_REGEX = /^(\/[^?#\s]*)?(\?[^#\s]+)?(#[^\s]+)?$/i

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

  static make(handleOrDid: string, collection?: string, rkey?: string) {
    let str = handleOrDid
    if (collection) str += '/' + collection
    if (rkey) str += '/' + rkey
    return new AtUri(str)
  }

  get protocol() {
    return 'at:'
  }

  get origin() {
    return `at://${this.host}` as const
  }

  get hostname() {
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
    return this.pathname.split('/').filter(Boolean)[0] || ''
  }

  set collection(v: string) {
    ensureValidNsid(v)
    const parts = this.pathname.split('/').filter(Boolean)
    parts[0] = v
    this.pathname = parts.join('/')
  }

  get rkey() {
    return this.pathname.split('/').filter(Boolean)[1] || ''
  }

  set rkey(v: string) {
    const parts = this.pathname.split('/').filter(Boolean)
    parts[0] ||= 'undefined'
    parts[1] = v
    this.pathname = parts.join('/')
  }

  get href() {
    return this.toString()
  }

  toString(): AtUriString {
    let path = this.pathname || '/'
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
    let qs = ''
    if (this.searchParams.size) {
      qs = `?${this.searchParams.toString()}`
    }
    let hash = this.hash
    if (hash && !hash.startsWith('#')) {
      hash = `#${hash}`
    }
    return `at://${this.host}${path}${qs}${hash}` as AtUriString
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
