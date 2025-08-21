import { Accept, isAccept, matchesAnyAccept } from '../lib/mime.js'
import { Parser } from '../parser.js'
import { NeRoArray, ResourceSyntax, isScopeForResource } from '../syntax.js'

export const DEFAULT_ACCEPT = Object.freeze(['*/*'] as const)

export const blobParser = new Parser(
  'blob',
  {
    accept: {
      multiple: true,
      required: true,
      validate: isAccept,
      normalize: (value) => {
        // Returns a more concise representation of the accept values.
        if (value.includes('*/*')) return DEFAULT_ACCEPT

        return value.map(toLowerCase).filter(isNonRedundant) as [
          Accept,
          ...Accept[],
        ]
      },
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

function isNonRedundant(
  value: string,
  index: number,
  arr: readonly string[],
): boolean {
  if (value.endsWith('/*')) {
    // assuming the array contains unique element, wildcards cannot be redundant
    // with one another ('image/*' is not redundant with 'text/*')
    return true
  }
  const base = value.split('/', 1)[0]
  if (arr.includes(`${base}/*`)) {
    // If another value in the array is a wildcard for the same base, we can
    // skip this one as it is redundant. e.g. if the array contains 'image/png'
    // and 'image/*', we can skip 'image/png' because 'image/*' already covers
    // it.
    return false
  }
  return true
}
