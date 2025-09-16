import { OAuthScope } from './oauth-scope.js'

export const ATPROTO_SCOPE_VALUE = 'atproto'
export type AtprotoScopeValue = typeof ATPROTO_SCOPE_VALUE

export type AtprotoOAuthScope = OAuthScope &
  `${'' | `${string} `}${AtprotoScopeValue}${'' | ` ${string}`}`

export function isAtprotoOAuthScope(input: string): input is AtprotoOAuthScope {
  // Optimization for small strings
  if (input.length <= ATPROTO_SCOPE_VALUE.length) {
    return input === ATPROTO_SCOPE_VALUE
  }

  // Optimization the input must include a space
  if (!input.includes(' ')) {
    return false
  }

  return input.split(' ').includes(ATPROTO_SCOPE_VALUE)
}

export function asAtprotoOAuthScope(input: string): AtprotoOAuthScope {
  if (isAtprotoOAuthScope(input)) return input
  throw new TypeError(`Value must contain "${ATPROTO_SCOPE_VALUE}" scope value`)
}

// Default scope is for reading identity (did) only
export const DEFAULT_ATPROTO_OAUTH_SCOPE =
  ATPROTO_SCOPE_VALUE satisfies AtprotoOAuthScope
