import { z } from 'zod'
import { OAuthScope, isOAuthScope } from './oauth-scope.js'
import { SpaceSeparatedValue, isSpaceSeparatedValue } from './util.js'

export const ATPROTO_SCOPE_VALUE = 'atproto'
export type AtprotoScopeValue = typeof ATPROTO_SCOPE_VALUE

export type AtprotoOAuthScope = OAuthScope &
  SpaceSeparatedValue<AtprotoScopeValue>

export function isAtprotoOAuthScope(input: string): input is AtprotoOAuthScope {
  return (
    isOAuthScope(input) && isSpaceSeparatedValue(ATPROTO_SCOPE_VALUE, input)
  )
}

export function asAtprotoOAuthScope<I extends string>(input: I) {
  if (isAtprotoOAuthScope(input)) return input
  throw new TypeError(`Value must contain "${ATPROTO_SCOPE_VALUE}" scope value`)
}

export function assertAtprotoOAuthScope(
  input: string,
): asserts input is AtprotoOAuthScope {
  void asAtprotoOAuthScope(input)
}

export const atprotoOAuthScopeSchema = z.string().refine(isAtprotoOAuthScope, {
  message: 'Invalid ATProto OAuth scope',
})

// Default scope is for reading identity (did) only
export const DEFAULT_ATPROTO_OAUTH_SCOPE =
  ATPROTO_SCOPE_VALUE satisfies AtprotoOAuthScope
