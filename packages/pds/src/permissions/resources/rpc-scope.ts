import { ParsedResourceScope, formatScope } from '../scope-syntax'

export type RpcScopeMatch = {
  aud: string
  lxm?: string
}

const ALLOWED_PARAMS = Object.freeze(['aud', 'lxm'] as const)

export class RpcScope {
  private constructor(
    public readonly aud: string,
    public readonly lxm?: readonly [string, ...string[]],
  ) {}

  matches(options: RpcScopeMatch): boolean {
    const { aud, lxm } = this
    if (aud !== '*' && aud !== options.aud) return false
    if (!lxm) return true // No lxm means all methods are allowed
    return options.lxm != null && lxm.includes(options.lxm)
  }

  toString(): string {
    return formatScope(
      'rpc',
      [
        ['aud', this.aud],
        ['lxm', this.lxm],
      ],
      'aud',
    )
  }

  static fromString(scope: string): RpcScope | null {
    const parsed = ParsedResourceScope.fromString(scope)
    return this.fromParsed(parsed)
  }

  static fromParsed(parsed: ParsedResourceScope): RpcScope | null {
    if (!parsed.is('rpc')) return null

    const aud = parsed.getSingle('aud', true)

    // a (single) audience value is required
    if (!aud) return null

    const lxm = parsed.getMulti('lxm')

    if (aud === '*' && !lxm) return null // "rpc" cannot be unbound

    if (parsed.containsParamsOtherThan(ALLOWED_PARAMS)) {
      return null
    }

    return new RpcScope(aud, lxm)
  }

  static scopeNeededFor(options: RpcScopeMatch): string {
    return new RpcScope(
      options.aud,
      options.lxm ? [options.lxm] : undefined,
    ).toString()
  }
}
