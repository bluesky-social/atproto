import { Did, isDid } from './did.js'
import { isFragment } from './lib/uri.js'

/**
 * An absolute DID reference: `${Did}#${fragment}`.
 *
 * @see {@link https://www.w3.org/TR/did-core/#did-url-syntax}
 */
export type DidRefAbsolute<M extends string = string> = `${Did<M>}#${string}`

export const isDidRefAbsolute = (value: unknown): value is DidRefAbsolute => {
  if (typeof value !== 'string') return false
  const hashIndex = value.indexOf('#')
  if (hashIndex === -1) return false // no '#'
  if (hashIndex === value.length - 1) return false // empty fragment
  if (value.includes('#', hashIndex + 1)) return false // more than one '#'
  return isFragment(value, hashIndex + 1) && isDid(value.slice(0, hashIndex))
}

/**
 * A relative DID reference (a `#fragment` resolved against the surrounding
 * DID document's `id`). The optional `id` parameter narrows the fragment.
 */
export type DidRefRelative<I extends string = string> = `#${I}`

export function isDidRefRelative<I extends string = string>(
  value: unknown,
  id?: I,
): value is DidRefRelative<I> {
  if (typeof value !== 'string') return false
  if (value.charCodeAt(0) !== 35 /* '#' */) return false // doesn't start with '#'
  if (value.length < 2) return false // empty fragment
  if (value.includes('#', 1)) return false // more than one '#'
  if (!isFragment(value, 1)) return false
  if (id !== undefined && value !== `#${id}`) return false // id mismatch
  return true
}
