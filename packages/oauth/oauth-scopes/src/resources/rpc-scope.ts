import { Parser } from '../parser.js'
import { NeRoArray, ResourceSyntax } from '../syntax.js'
import { DIDLike, isDIDLike } from './util/did.js'
import { NSID, isNSID } from './util/nsid.js'

export const rpcParser = new Parser(
  'rpc',
  {
    lxm: {
      multiple: true,
      required: true,
      validate: (value) => value === '*' || isNSID(value),
    },
    aud: {
      multiple: false,
      required: true,
      validate: (value) => value === '*' || isDIDLike(value),
    },
  },
  'lxm',
)

export type RpcScopeMatch = {
  lxm: '*' | NSID
  aud: '*' | DIDLike
}

export class RpcScope {
  private constructor(
    public readonly lxm: NeRoArray<'*' | NSID>,
    public readonly aud: '*' | DIDLike,
  ) {}

  matches(options: RpcScopeMatch): boolean {
    return (
      (this.aud === '*' || this.aud === options.aud) &&
      this.lxm.includes(options.lxm)
    )
  }

  toString(): string {
    return rpcParser.format(this)
  }

  static fromString(scope: string): RpcScope | null {
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax): RpcScope | null {
    const result = rpcParser.parse(syntax)
    if (!result) return null

    // rpc:*?aud=* is forbidden
    if (result.aud === '*' && result.lxm.includes('*')) return null

    return new RpcScope(result.lxm, result.aud)
  }

  static scopeNeededFor(options: RpcScopeMatch): string {
    return rpcParser.format({
      lxm: [options.lxm],
      aud: options.aud,
    })
  }
}
