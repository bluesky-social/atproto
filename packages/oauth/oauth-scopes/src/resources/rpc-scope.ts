import { Parser } from '../parser.js'
import { NeRoArray, ResourceSyntax } from '../syntax.js'
import { DIDLike, isDIDLike } from './util/did.js'
import { NSID, isNSID } from './util/nsid.js'

const validateLxm = (value: string) => value === '*' || isNSID(value)
const validateAud = (value: string) => value === '*' || isDIDLike(value)

export const rpcParser = new Parser(
  'rpc',
  {
    lxm: {
      multiple: true,
      required: true,
      validate: validateLxm,
    },
    aud: {
      multiple: false,
      required: true,
      validate: validateAud,
    },
  },
  'lxm',
)

export type RpcScopeMatch = {
  lxm: string
  aud: string
}

export class RpcScope {
  private constructor(
    public readonly lxm: NeRoArray<'*' | NSID>,
    public readonly aud: '*' | DIDLike,
  ) {}

  matches(options: RpcScopeMatch): boolean {
    return (
      (this.aud === '*' || this.aud === options.aud) &&
      (this.lxm as readonly string[]).includes(options.lxm)
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
      aud: options.aud as DIDLike,
      lxm: [options.lxm as NSID],
    })
  }
}
