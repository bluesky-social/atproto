import { Parser } from '../parser.js'
import { NeRoArray, ResourceSyntax } from '../syntax.js'
import { Accept, isAccept, matchesAnyAccept } from './util/accept.js'

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
        // @TODO remove specific accept values that are covered by partial
        // accept (e.g. remove "image/png" if "image/*" is present)
        return value
      },
      default: DEFAULT_ACCEPT,
    },
  },
  'accept',
)

export type BlobScopeMatch = {
  mime: Accept
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
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = blobParser.parse(syntax)
    if (!result) return null

    return new BlobScope(result.accept)
  }

  static scopeNeededFor(options: BlobScopeMatch) {
    return blobParser.format({ accept: [options.mime] })
  }
}
