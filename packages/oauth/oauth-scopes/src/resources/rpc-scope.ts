import { DIDLike, isDIDLike } from '../lib/did.js'
import { NSID, isNSID } from '../lib/nsid.js'
import { Parser } from '../parser.js'
import { NeRoArray, ResourceSyntax, isScopeForResource } from '../syntax.js'

const validateLxmParam = (value: string) => value === '*' || isNSID(value)
const validateAudParam = (value: string) => value === '*' || isDIDLike(value)

export const rpcParser = new Parser(
  'rpc',
  {
    lxm: {
      multiple: true,
      required: true,
      validate: validateLxmParam,
    },
    aud: {
      multiple: false,
      required: true,
      validate: validateAudParam,
    },
  },
  'lxm',
)

export type RpcScopeMatch = {
  lxm: string
  aud: string
}

export class RpcScope {
  constructor(
    public readonly aud: '*' | DIDLike,
    public readonly lxm: NeRoArray<'*' | NSID>,
  ) {}

  matches(options: RpcScopeMatch): boolean {
    const { aud, lxm } = this
    return (
      (aud === '*' || aud === options.aud) &&
      (lxm.includes('*') || (lxm as readonly string[]).includes(options.lxm))
    )
  }

  toString(): string {
    const { lxm, aud } = this
    return rpcParser.format({
      aud,
      lxm: lxm.includes('*')
        ? ['*']
        : ([...new Set(lxm)].sort() as [NSID, ...NSID[]]),
    })
  }

  static fromString(scope: string): RpcScope | null {
    if (!isScopeForResource(scope, 'rpc')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax): RpcScope | null {
    const result = rpcParser.parse(syntax)
    if (!result) return null

    // rpc:*?aud=* is forbidden
    if (result.aud === '*' && result.lxm.includes('*')) return null

    return new RpcScope(result.aud, result.lxm)
  }

  static scopeNeededFor(options: RpcScopeMatch): string {
    return rpcParser.format({
      aud: options.aud as DIDLike,
      lxm: [options.lxm as NSID],
    })
  }
}
