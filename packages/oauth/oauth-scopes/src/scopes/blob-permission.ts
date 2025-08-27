import { Accept, isAccept, matchesAnyAccept } from '../lib/mime.js'
import { Parser } from '../lib/parser.js'
import { ResourcePermission } from '../lib/resource-permission.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import {
  NeArray,
  NeRoArray,
  ParamValue,
  ScopeSyntax,
  isScopeStringFor,
} from '../lib/syntax.js'

export { type Accept }

export const DEFAULT_ACCEPT = Object.freeze(['*/*'] as const)

export type BlobPermissionMatch = {
  mime: string
}

export class BlobPermission
  implements ResourcePermission<'blob', BlobPermissionMatch>
{
  constructor(public readonly accept: NeRoArray<Accept>) {}

  matches(options: BlobPermissionMatch) {
    return matchesAnyAccept(this.accept, options.mime)
  }

  toString() {
    return BlobPermission.parser.format(this)
  }

  protected static readonly parser = new Parser(
    'blob',
    {
      accept: {
        multiple: true,
        required: true,
        validate: isAccept,
        normalize: (value) => {
          // Returns a more concise representation of the accept values.
          if (value.includes('*/*')) return DEFAULT_ACCEPT

          return value
            .map(toLowerCase)
            .filter(isNonRedundant)
            .sort() as NeArray<Accept>
        },
      },
    },
    'accept',
  )

  static fromString(scope: string) {
    if (!isScopeStringFor(scope, 'blob')) return null
    const syntax = ScopeStringSyntax.fromString(scope)
    return BlobPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax<'blob'>) {
    const result = BlobPermission.parser.parse(syntax)
    if (!result) return null

    return new BlobPermission(result.accept)
  }

  static scopeNeededFor(options: BlobPermissionMatch) {
    return BlobPermission.parser.format({
      accept: [options.mime as Accept],
    })
  }
}

function toLowerCase<T extends ParamValue>(
  value: T,
): T extends string ? string : T {
  return (
    typeof value === 'string' ? value.toLowerCase() : value
  ) as T extends string ? string : T
}

function isNonRedundant(
  value: ParamValue,
  index: number,
  arr: readonly ParamValue[],
): boolean {
  if (typeof value !== 'string') {
    return true
  }
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
