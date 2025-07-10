import { ParsedResourceScope } from '../scope-syntax'

type Accept = `${string}/${string}`
function isAccept(value: string): value is Accept {
  return (
    value.includes('/') &&
    !value.startsWith('/') &&
    !value.endsWith('/') &&
    !value.includes(' ')
  )
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
  constructor(public readonly accept: Accept = '*/*') {}

  matches(options: BlobScopeMatch): boolean {
    return matchAccept(this.accept, options.mime)
  }

  static scopeNeededFor(options: BlobScopeMatch): string {
    return `blob:${encodeURIComponent(options.mime)}`
  }

  static fromString(scope: string): BlobScope | null {
    const parsed = ParsedResourceScope.fromString(scope)

    if (!parsed.is('blob')) return null

    const accept = parsed.getSingle('accept', true)
    if (accept === null) return null
    if (accept !== undefined && !isAccept(accept)) return null

    if (parsed.containsParamsOtherThan(ALLOWED_PARAMS)) {
      return null
    }

    return new BlobScope(accept)
  }
}
