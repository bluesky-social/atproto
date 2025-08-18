import { AtprotoDid, isAtprotoDid } from '@atproto/did'
import { LexPermission } from '@atproto/lexicon'
import { Nsid, isNsid } from '../lib/nsid.js'
import { Parser } from '../parser.js'
import { NeRoArray, ResourceSyntax, isScopeForResource } from '../syntax.js'

export type { AtprotoDid }

export type LxmParam = '*' | Nsid
export const isLxmParam = (value: unknown): value is LxmParam =>
  value === '*' || isNsid(value)
export type AudParam = '*' | AtprotoDid
export const isAudParam = (value: unknown): value is AudParam =>
  value === '*' || isAtprotoDid(value)

export type RpcPermissionMatch = {
  lxm: string
  aud: string
}

export class RpcPermission {
  constructor(
    public readonly aud: '*' | AtprotoDid,
    public readonly lxm: NeRoArray<'*' | Nsid>,
  ) {}

  matches(options: RpcPermissionMatch): boolean {
    const { aud, lxm } = this
    return (
      (aud === '*' || aud === options.aud) &&
      (lxm.includes('*') || (lxm as readonly string[]).includes(options.lxm))
    )
  }

  toString(): string {
    const { lxm, aud } = this
    return RpcPermission.parser.format({
      aud,
      lxm: lxm.includes('*')
        ? ['*']
        : ([...new Set(lxm)].sort() as [Nsid, ...Nsid[]]),
    })
  }

  static readonly parser = new Parser(
    'rpc',
    {
      lxm: {
        multiple: true,
        required: true,
        validate: isLxmParam,
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
    if (!isScopeForResource(scope, 'rpc')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return RpcPermission.fromSyntax(syntax)
  }

  static fromLex(lexPermission: LexPermission) {
    if (lexPermission.resource !== 'rpc') return null
    const syntax = ResourceSyntax.fromLex(lexPermission)
    return RpcPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax): RpcPermission | null {
    const result = RpcPermission.parser.parse(syntax)
    if (!result) return null

    // rpc:*?aud=* is forbidden
    if (result.aud === '*' && result.lxm.includes('*')) return null

    return new RpcPermission(result.aud, result.lxm)
  }

  static scopeNeededFor(options: RpcPermissionMatch): string {
    return RpcPermission.parser.format({
      aud: options.aud as AtprotoDid,
      lxm: [options.lxm as Nsid],
    })
  }
}
