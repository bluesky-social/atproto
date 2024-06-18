import { JwtPayload } from '@atproto/jwk'

/**
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims | OpenID Connect Core 1.0, 5.4. Requesting Claims using Scope Values}
 */
export const OIDC_SCOPE_CLAIMS = Object.freeze({
  email: Object.freeze(['email', 'email_verified'] as const),
  phone: Object.freeze(['phone_number', 'phone_number_verified'] as const),
  address: Object.freeze(['address'] as const),
  profile: Object.freeze([
    'name',
    'family_name',
    'given_name',
    'middle_name',
    'nickname',
    'preferred_username',
    'gender',
    'picture',
    'profile',
    'website',
    'birthdate',
    'zoneinfo',
    'locale',
    'updated_at',
  ] as const),
})

export const OIDC_STANDARD_CLAIMS = Object.freeze(
  Object.values(OIDC_SCOPE_CLAIMS).flat(),
)

export type OIDCStandardClaim = (typeof OIDC_STANDARD_CLAIMS)[number]
export type OIDCStandardPayload = Partial<{
  [K in OIDCStandardClaim]?: JwtPayload[K]
}>
