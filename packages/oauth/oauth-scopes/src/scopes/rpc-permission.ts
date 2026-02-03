import { DidString, NsidString, isValidDid, isValidNsid } from '@atproto/syntax'
import { Parser } from '../lib/parser.js'
import { ResourcePermission } from '../lib/resource-permission.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import { NeRoArray, ScopeSyntax, isScopeStringFor } from '../lib/syntax.js'

export { type DidString, type NsidString, isValidDid, isValidNsid }

export type LxmParam = '*' | NsidString
export const isLxmParam = (value: unknown): value is LxmParam =>
  value === '*' || isValidNsid(value)
export type AudParam = '*' | DidString
export const isAudParam = (value: unknown): value is AudParam =>
  value === '*' || isValidDid(value)

export type RpcPermissionMatch = {
  lxm: NsidString | '*'
  aud: DidString
}

export class RpcPermission
  implements ResourcePermission<'rpc', RpcPermissionMatch>
{
  constructor(
    public readonly aud: '*' | DidString,
    public readonly lxm: NeRoArray<'*' | NsidString>,
  ) {}

  matches(options: RpcPermissionMatch) {
    const { aud, lxm } = this
    return (
      (aud === '*' || aud === options.aud) &&
      (lxm.includes('*') || lxm.includes(options.lxm))
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
            : ([...new Set(value)].sort() as [NsidString, ...NsidString[]]),
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
      aud: options.aud,
      lxm: [options.lxm],
    })
  }
}
