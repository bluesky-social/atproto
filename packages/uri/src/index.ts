export * from './validation'

export const ATP_URI_REGEX =
  // proto-    --did--------------   --name----------------   --path----   --query--   --hash--
  /^(at:\/\/)?((?:did:[a-z0-9:%-]+)|(?:[a-z0-9][a-z0-9.:-]*))(\/[^?#\s]*)?(\?[^#\s]+)?(#[^\s]+)?$/i
//                       --path-----   --query--  --hash--
const RELATIVE_REGEX = /^(\/[^?#\s]*)?(\?[^#\s]+)?(#[^\s]+)?$/i

export class AtUri {
  hash: string
  host: string
  pathname: string
  searchParams: URLSearchParams

  constructor(uri: string, base?: string) {
    let parsed
    if (base) {
      parsed = parse(base)
      if (!parsed) {
        throw new Error(`Invalid at uri: ${base}`)
      }
      const relativep = parseRelative(uri)
      if (!relativep) {
        throw new Error(`Invalid path: ${uri}`)
      }
      Object.assign(parsed, relativep)
    } else {
      parsed = parse(uri)
      if (!parsed) {
        throw new Error(`Invalid at uri: ${uri}`)
      }
    }

    this.hash = parsed.hash
    this.host = parsed.host
    this.pathname = parsed.pathname
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
    return `at://${this.host}`
  }

  get hostname() {
    return this.host
  }

  set hostname(v: string) {
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
    const parts = this.pathname.split('/').filter(Boolean)
    parts[0] = v
    this.pathname = parts.join('/')
  }

  get rkey() {
    return this.pathname.split('/').filter(Boolean)[1] || ''
  }

  set rkey(v: string) {
    const parts = this.pathname.split('/').filter(Boolean)
    if (!parts[0]) parts[0] = 'undefined'
    parts[1] = v
    this.pathname = parts.join('/')
  }

  get href() {
    return this.toString()
  }

  toString() {
    let path = this.pathname || '/'
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
    let qs = this.searchParams.toString()
    if (qs && !qs.startsWith('?')) {
      qs = `?${qs}`
    }
    let hash = this.hash
    if (hash && !hash.startsWith('#')) {
      hash = `#${hash}`
    }
    return `at://${this.host}${path}${qs}${hash}`
  }
}

function parse(str: string) {
  const match = ATP_URI_REGEX.exec(str)
  if (match) {
    return {
      hash: match[5] || '',
      host: match[2] || '',
      pathname: match[3] || '',
      searchParams: new URLSearchParams(match[4] || ''),
    }
  }
  return undefined
}

function parseRelative(str: string) {
  const match = RELATIVE_REGEX.exec(str)
  if (match) {
    return {
      hash: match[3] || '',
      pathname: match[1] || '',
      searchParams: new URLSearchParams(match[2] || ''),
    }
  }
  return undefined
}
