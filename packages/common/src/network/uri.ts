export const ADX_URI_REGEX =
  // protocol-  --did--------------   --name-------------   --path----   --query--   --hash--
  /^(adx:\/\/)?((?:did:[a-z0-9:%-]+)|(?:[a-z][a-z0-9.:-]*))(\/[^?#\s]*)?(\?[^#\s]+)?(#[^\s]+)?$/i
//                       --path-----   --query--  --hash--
const RELATIVE_REGEX = /^(\/[^?#\s]*)?(\?[^#\s]+)?(#[^\s]+)?$/i

export class AdxUri {
  hash: string
  host: string
  pathname: string
  searchParams: URLSearchParams

  constructor(uri: string, base?: string) {
    let parsed
    if (base) {
      parsed = parse(base)
      if (!parsed) {
        throw new Error(`Invalid adx uri: ${base}`)
      }
      const relativep = parseRelative(uri)
      if (!relativep) {
        throw new Error(`Invalid path: ${uri}`)
      }
      Object.assign(parsed, relativep)
    } else {
      parsed = parse(uri)
      if (!parsed) {
        throw new Error(`Invalid adx uri: ${uri}`)
      }
    }

    this.hash = parsed.hash
    this.host = parsed.host
    this.pathname = parsed.pathname
    this.searchParams = parsed.searchParams
  }

  get protocol() {
    return 'adx:'
  }

  get origin() {
    return `adx://${this.host}`
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

  get namespace() {
    return this.pathname.split('/').filter(Boolean)[0] || ''
  }

  set namespace(v: string) {
    const parts = this.pathname.split('/').filter(Boolean)
    parts[0] = v
    this.pathname = parts.join('/')
  }

  get dataset() {
    return this.pathname.split('/').filter(Boolean)[1] || ''
  }

  set dataset(v: string) {
    const parts = this.pathname.split('/').filter(Boolean)
    parts[1] = v
    this.pathname = parts.join('/')
  }

  get collection() {
    if (!this.namespace && !this.dataset) return ''
    return [this.namespace, this.dataset].join('/')
  }

  set collection(v: string) {
    const [namespace = '', dataset = ''] = v.split('/')
    this.namespace = namespace
    this.dataset = dataset
  }

  get recordKey() {
    return this.pathname.split('/').filter(Boolean)[2] || ''
  }

  set recordKey(v: string) {
    const parts = this.pathname.split('/').filter(Boolean)
    if (!parts[0]) parts[0] = 'undefined'
    if (!parts[1]) parts[1] = 'undefined'
    parts[2] = v
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
    return `adx://${this.host}${path}${qs}${hash}`
  }
}

function parse(str: string) {
  const match = ADX_URI_REGEX.exec(str)
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
