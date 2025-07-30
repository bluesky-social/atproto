import { NeRoArray, ParsedResourceScope, formatScope } from '../syntax'

type Accept = `${string}/${string}`
function isAccept(value: string): value is Accept {
  const slashIndex = value.indexOf('/')

  if (slashIndex === -1) return false
  if (slashIndex === 0 || slashIndex === value.length - 1) return false

  if (value.includes('/', slashIndex + 1)) return false
  if (value.includes(' ')) return false

  return true
}

const ALLOWED_PARAMS = Object.freeze(['accept'] as const)

function matchAccept(accept: Accept, mime: string): boolean {
  if (accept === '*/*') {
    return true
  }
  if (accept.endsWith('/*')) {
    return mime.startsWith(accept.slice(0, -1))
  }
  return accept === mime
}

export type BlobScopeMatch = {
  mime: string
}

export class BlobScope {
  constructor(public readonly accept: NeRoArray<Accept>) {}

  matches(options: BlobScopeMatch): boolean {
    for (const accept of this.accept) {
      if (matchAccept(accept, options.mime)) {
        return true
      }
    }
    return false
  }

  toString(): string {
    return formatScope('blob', [['accept', this.accept]], 'accept')
  }

  static fromString(scope: string): BlobScope | null {
    const parsed = ParsedResourceScope.fromString(scope)
    return this.fromParsed(parsed)
  }

  static fromParsed(parsed: ParsedResourceScope): BlobScope | null {
    if (!parsed.is('blob')) return null

    const accept = parsed.getMulti('accept', true)
    if (accept == null) return null
    if (!accept.every(isAccept)) return null

    if (parsed.containsParamsOtherThan(ALLOWED_PARAMS)) {
      return null
    }

    return new BlobScope(accept as NeRoArray<Accept>)
  }

  static scopeNeededFor(options: BlobScopeMatch): string {
    return `blob:${encodeURIComponent(options.mime)}`
  }
}
