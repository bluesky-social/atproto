import { AtprotoAudience, isAtprotoAudience } from '@atproto/did'
import { Nsid, isNsid } from '../lib/nsid.js'
import { Parser } from '../lib/parser.js'
import { ResourcePermission } from '../lib/resource-permission.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import { NeRoArray, ScopeSyntax, isScopeStringFor } from '../lib/syntax.js'

export { type AtprotoAudience, type Nsid, isAtprotoAudience, isNsid }

export type LxmParam = '*' | Nsid
export const isLxmParam = (value: unknown): value is LxmParam =>
  value === '*' || isNsid(value)
export type AudParam = '*' | AtprotoAudience
export const isAudParam = (value: unknown): value is AudParam =>
  value === '*' || isAtprotoAudience(value)

export type RpcPermissionMatch = {
  lxm: string
  aud: string
}

export class RpcPermission
  implements ResourcePermission<'rpc', RpcPermissionMatch>
{
  constructor(
    public readonly aud: '*' | AtprotoAudience,
    public readonly lxm: NeRoArray<'*' | Nsid>,
  ) {}

  matches(options: RpcPermissionMatch) {
    const { aud, lxm } = this
    return (
      (aud === '*' || aud === options.aud) &&
      (lxm.includes('*') || (lxm as readonly string[]).includes(options.lxm))
    )
  }

  toString() {
    return RpcPermission.parser.format(this)
  }

  protected static readonly parser = new Parser(
    'rpc',
    {
      lxm: {
        multiple: true,
        required: true,
        validate: isLxmParam,
        normalize: (value) =>
          value.length > 1 && value.includes('*')
            ? (['*'] as const)
            : ([...new Set(value)].sort() as [Nsid, ...Nsid[]]),
      },
      aud: {
        multiple: false,
        required: true,
        validate: isAudParam,
      },
    },
    'lxm',
  )

  static fromString(scope: string): RpcPermission | null {
    if (!isScopeStringFor(scope, 'rpc')) return null
    const syntax = ScopeStringSyntax.fromString(scope)
    return RpcPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax<'rpc'>): RpcPermission | null {
    const result = RpcPermission.parser.parse(syntax)
    if (!result) return null

    // rpc:*?aud=* is forbidden
    if (result.aud === '*' && result.lxm.includes('*')) return null

    return new RpcPermission(result.aud, result.lxm)
  }

  static scopeNeededFor(options: RpcPermissionMatch): string {
    return RpcPermission.parser.format({
      aud: options.aud as AtprotoAudience,
      lxm: [options.lxm as Nsid],
    })
  }
}
