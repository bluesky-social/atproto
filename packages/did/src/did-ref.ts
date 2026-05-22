import { AtprotoDid, isAtprotoDid } from './atproto.js'
import { isFragment } from './lib/uri.js'

/**
 * An atproto-constrained absolute DID reference: `${AtprotoDid}#${fragment}`.
 *
 * This is the same shape as the legacy `AtprotoAudience` type, kept under a
 * more accurate name now that the union is reused for non-audience contexts.
 */
export type AtprotoDidRefAbsolute = `${AtprotoDid}#${string}`

export const isAtprotoDidRefAbsolute = (
  value: unknown,
): value is AtprotoDidRefAbsolute => {
  if (typeof value !== 'string') return false
  const hashIndex = value.indexOf('#')
  if (hashIndex === -1) return false // no '#'
  if (hashIndex === value.length - 1) return false // empty fragment
  if (value.indexOf('#', hashIndex + 1) !== -1) return false // more than one '#'
  return (
    isFragment(value, hashIndex + 1) && isAtprotoDid(value.slice(0, hashIndex))
  )
}

/**
 * A relative DID reference, e.g. `#atproto`. The optional `id` parameter
 * narrows the fragment.
 */
export type DidRefRelative<I extends string = string> = `#${I}`

export function isDidRefRelative<I extends string = string>(
  value: unknown,
  id?: I,
): value is DidRefRelative<I> {
  if (typeof value !== 'string') return false
  if (value.charCodeAt(0) !== 35 /* '#' */) return false // doesn't start with '#'
  if (value.length < 2) return false // empty fragment
  if (value.indexOf('#', 1) !== -1) return false // more than one '#'
  if (!isFragment(value, 1)) return false
  if (id !== undefined && value !== `#${id}`) return false // id mismatch
  return true
}

/**
 * The shape of `aud=...` values appearing in OAuth scopes — always combined.
 */
export type AtprotoScopeAud = AtprotoDidRefAbsolute

/**
 * The shape of `aud` claims in atproto service-auth JWTs — bare DID or
 * combined absolute reference. Phase 1 accepts both.
 */
export type AtprotoTokenAud = AtprotoDid | AtprotoDidRefAbsolute

/** @deprecated use {@link AtprotoScopeAud} or {@link AtprotoDidRefAbsolute}. */
export type AtprotoAudience = AtprotoDidRefAbsolute

/** @deprecated use {@link isAtprotoDidRefAbsolute}. */
export const isAtprotoAudience: (value: unknown) => value is AtprotoAudience =
  isAtprotoDidRefAbsolute
