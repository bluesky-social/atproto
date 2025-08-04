import { Accept, isAccept, matchesAnyAccept } from '../lib/mime.js'
import { Parser } from '../parser.js'
import { NeRoArray, ResourceSyntax, isScopeForResource } from '../syntax.js'

export const DEFAULT_ACCEPT = Object.freeze(['*/*'] as const)

export const blobParser = new Parser(
  'blob',
  {
    accept: {
      multiple: true,
      required: false,
      validate: isAccept,
      normalize: (value) => {
        if (value.includes('*/*')) return DEFAULT_ACCEPT
        return value
          .map(toLowerCase)
          .filter(isWildcardOrHasNoWildcardMatch) as [string, ...string[]]
      },
      default: DEFAULT_ACCEPT,
    },
  },
  'accept',
)

export type BlobScopeMatch = {
  mime: string
}

export class BlobScope {
  constructor(public readonly accept: NeRoArray<Accept>) {}

  matches(options: BlobScopeMatch) {
    return matchesAnyAccept(this.accept, options.mime)
  }

  toString() {
    return blobParser.format(this)
  }

  static fromString(scope: string) {
    if (!isScopeForResource(scope, 'blob')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = blobParser.parse(syntax)
    if (!result) return null

    return new BlobScope(result.accept)
  }

  static scopeNeededFor(options: BlobScopeMatch) {
    return blobParser.format({
      accept: [options.mime as Accept],
    })
  }
}

function toLowerCase(value: string): string {
  return value.toLowerCase()
}

function isWildcardOrHasNoWildcardMatch(
  value: string,
  index: number,
  arr: readonly string[],
): boolean {
  if (value.endsWith('/*')) {
    // keep wildcards
    return true
  }
  if (arr.includes(`${value.split('/')[0]}/*`)) {
    // skip mimes that have a wildcard match
    return false
  }
  return true
}
