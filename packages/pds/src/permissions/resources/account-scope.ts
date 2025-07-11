import { NeRoArray, ParsedResourceScope, formatScope } from '../scope-syntax'

const ACCOUNT_FEATURES = Object.freeze(['email', 'emailUpdate'] as const)

export type AccountFeature = (typeof ACCOUNT_FEATURES)[number]
export function isAccountFeature(feature: string): feature is AccountFeature {
  return (ACCOUNT_FEATURES as readonly string[]).includes(feature)
}

export type AccountScopeMatch = {
  feature: AccountFeature
}

const ALLOWED_PARAMS = Object.freeze(['feature'] as const)

export class AccountScope {
  constructor(public readonly features: NeRoArray<AccountFeature>) {}

  matches(options: AccountScopeMatch): boolean {
    if (!options.feature) return true
    if (!this.features) return false
    return this.features.includes(options.feature)
  }

  toString(): string {
    return formatScope('account', [['feature', this.features]])
  }

  static fromString(scope: string): AccountScope | null {
    const parsed = ParsedResourceScope.fromString(scope)

    if (!parsed.is('account')) return null

    const features = parsed.getMulti('feature', true)
    if (features == null) return null
    if (!features.every(isAccountFeature)) {
      return null
    }

    if (parsed.containsParamsOtherThan(ALLOWED_PARAMS)) {
      return null
    }

    return new AccountScope(features as NeRoArray<AccountFeature>)
  }

  static scopeNeededFor(options: AccountScopeMatch): string {
    return new AccountScope([options.feature]).toString()
  }
}
