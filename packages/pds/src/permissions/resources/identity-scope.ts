import { ParsedResourceScope, formatScope } from '../scope-syntax'

const IDENTITY_PARAMS = Object.freeze(['feature'] as const)
const IDENTITY_FEATURES = Object.freeze([
  'plc',
  'plc-unsafe',
  'handle',
] as const)

export type IdentityScopeFeatures = (typeof IDENTITY_FEATURES)[number]
export function isIdentityScopeFeature(
  feature: string,
): feature is IdentityScopeFeatures {
  return (IDENTITY_FEATURES as readonly string[]).includes(feature)
}

export type IdentityScopeMatch = {
  feature: IdentityScopeFeatures
}

export class IdentityScope {
  constructor(
    public readonly features?: readonly [
      IdentityScopeFeatures,
      ...IdentityScopeFeatures[],
    ],
  ) {}

  matches(options: IdentityScopeMatch): boolean {
    return !this.features || this.features.includes(options.feature)
  }

  toString(): string {
    return formatScope('identity', [['feature', this.features]])
  }

  static fromString(scope: string): IdentityScope | null {
    const parsed = ParsedResourceScope.fromString(scope)
    return this.fromParsed(parsed)
  }

  static fromParsed(parsed: ParsedResourceScope): IdentityScope | null {
    if (!parsed.is('identity')) return null

    const features = parsed.getMulti('feature', true)
    if (features === null) return null
    if (features !== undefined && !features.every(isIdentityScopeFeature)) {
      return null
    }

    if (parsed.containsParamsOtherThan(IDENTITY_PARAMS)) {
      return null
    }

    return new IdentityScope(
      features as [IdentityScopeFeatures, ...IdentityScopeFeatures[]],
    )
  }

  static scopeNeededFor(options: IdentityScopeMatch): string {
    return new IdentityScope([options.feature]).toString()
  }
}
