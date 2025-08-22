import { AtprotoDid, isAtprotoDid } from '@atproto/did'
import { Nsid, isNsid } from '../lib/nsid.js'
import { Parser } from '../parser.js'
import { ResourceSyntax, isResourceSyntaxFor } from '../syntax.js'

export class IncludeScope {
  constructor(
    public readonly nsid: Nsid,
    public readonly aud: undefined | AtprotoDid,
  ) {}

  toString() {
    return IncludeScope.parser.format(this)
  }

  static readonly parser = new Parser(
    'include',
    {
      nsid: {
        multiple: false,
        required: true,
        validate: isNsid,
      },
      aud: {
        multiple: false,
        required: false,
        validate: isAtprotoDid,
      },
    },
    'nsid',
  )

  static fromString(scope: string) {
    if (!isResourceSyntaxFor(scope, 'include')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return IncludeScope.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = IncludeScope.parser.parse(syntax)
    if (!result) return null
    return new IncludeScope(result.nsid, result.aud)
  }
}
