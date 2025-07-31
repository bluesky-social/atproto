import {
  NeRoArray,
  ParsedResourceScope,
  ScopeForResource,
  formatScope,
} from '../syntax'

const ACCOUNT_PARAMS = Object.freeze(['feature'] as const)
const ACCOUNT_FEATURES = Object.freeze(['*', 'email', 'email-update'] as const)

export type AccountFeature = (typeof ACCOUNT_FEATURES)[number]
export function isAccountFeature(feature: string): feature is AccountFeature {
  return (ACCOUNT_FEATURES as readonly string[]).includes(feature)
}

export function isAccountFeatureArray(
  features: NeRoArray<string>,
): features is NeRoArray<AccountFeature> {
  return features.every(isAccountFeature)
}

export type AccountScopeMatch = {
  feature: AccountFeature
}

export class AccountScope {
  constructor(public readonly features: NeRoArray<AccountFeature>) {}

  matches(options: AccountScopeMatch): boolean {
    return (
      this.features.includes('*') || this.features.includes(options.feature)
    )
  }

  toString(): ScopeForResource<'account'> {
    const feature: NeRoArray<string> = this.features.includes('*')
      ? ['*']
      : this.features

    return formatScope('account', [['feature', feature]], 'feature')
  }

  static fromString(scope: string): AccountScope | null {
    const parsed = ParsedResourceScope.fromString(scope)
    return this.fromParsed(parsed)
  }

  static fromParsed(parsed: ParsedResourceScope): AccountScope | null {
    if (!parsed.is('account')) return null

    const features = parsed.getMulti('feature', true)
    if (!features || !isAccountFeatureArray(features)) return null

    if (parsed.containsParamsOtherThan(ACCOUNT_PARAMS)) {
      return null
    }

    // No features means "any" feature
    return new AccountScope(features ?? ACCOUNT_FEATURES)
  }

  static scopeNeededFor(options: AccountScopeMatch): string {
    return new AccountScope([options.feature]).toString()
  }
}
