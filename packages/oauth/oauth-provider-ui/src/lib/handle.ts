/**
 * Spec limit is 63, but in practice, we've limited it to 18 in our implementations.
 *
 * @see {@link https://atproto.com/specs/handle | ATProto Handle Spec}
 */
export const MAX_LENGTH = 18

/**
 * Spec limit is 1, but in practice, we've targeted at least 3 characters in handles.
 *
 * @see {@link https://atproto.com/specs/handle | ATProto Handle Spec}
 */
export const MIN_LENGTH = 3

/**
 * Spec limit is 253, but in practice, we've targeted 30 characters in handles.
 *
 * @see {@link https://atproto.com/specs/handle | ATProto Handle Spec}
 */
export const MAX_FULL_LENGTH = 30

export type ValidDomain = `.${string}`
export const isValidDomain = (domain: string): domain is ValidDomain =>
  // Ignore domains that are so long that they would make the handle smaller
  // than MIN_LENGTH characters
  MIN_LENGTH + domain.length <= MAX_FULL_LENGTH &&
  // Basic validation here
  domain.startsWith('.') &&
  !domain.endsWith('.')
