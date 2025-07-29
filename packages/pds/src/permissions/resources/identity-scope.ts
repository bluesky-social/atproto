import {
  NeRoArray,
  ParsedResourceScope,
  ScopeForResource,
  formatScope,
} from '../scope-syntax'

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

export function isIdentityScopeFeatureArray(
  features: NeRoArray<string>,
): features is NeRoArray<IdentityScopeFeatures> {
  return features.every(isIdentityScopeFeature)
}

export type IdentityScopeMatch = {
  feature: IdentityScopeFeatures
}

export class IdentityScope {
  constructor(public readonly features: NeRoArray<IdentityScopeFeatures>) {}

  matches(options: IdentityScopeMatch): boolean {
    return this.features.includes(options.feature)
  }

  toString(): ScopeForResource<'identity'> {
    const params: [string, NeRoArray<string>][] = []
    // If no features are specified, it means "any" feature is allowed
    if (!IDENTITY_FEATURES.every((f) => this.features.includes(f))) {
      params.push(['feature', this.features])
    }
    return formatScope('identity', params)
  }

  static fromString(scope: string): IdentityScope | null {
    const parsed = ParsedResourceScope.fromString(scope)
    return this.fromParsed(parsed)
  }

  static fromParsed(parsed: ParsedResourceScope): IdentityScope | null {
    if (!parsed.is('identity')) return null

    const features = parsed.getMulti('feature', true)
    if (features === null) return null
    if (features !== undefined && !isIdentityScopeFeatureArray(features)) {
      return null
    }

    if (parsed.containsParamsOtherThan(IDENTITY_PARAMS)) {
      return null
    }

    // No features means "any" feature
    return new IdentityScope(features ?? IDENTITY_FEATURES)
  }

  static scopeNeededFor(options: IdentityScopeMatch): string {
    return new IdentityScope([options.feature]).toString()
  }
}
