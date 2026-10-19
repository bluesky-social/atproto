import { MIN_PASSWORD_LENGTH } from './password.ts'

export { MIN_PASSWORD_LENGTH }

/** An email address whose domain carries a TLD (a dot with a label after it). */
export const EMAIL_PATTERN = '[^@]+@[^@]+\\.[^@]+'

/**
 * A handle's leftmost label: lowercase alphanumerics and hyphens, neither
 * leading nor trailing with a hyphen.
 */
export const HANDLE_SEGMENT_PATTERN = '[a-z0-9][a-z0-9\\-]+[a-z0-9]'

/**
 * The OTP shape the provider issues: two groups of five RFC-4648 base32
 * characters (A–Z and 2–7, so no 0/1/8/9) separated by a hyphen.
 *
 * Stated as a `pattern` attribute source — the attribute is implicitly anchored
 * to the whole value, so it carries no `^`/`$`.
 */
export const OTP_CODE_PATTERN = '[A-Z2-7]{5}-[A-Z2-7]{5}'

/**
 * Normalises free-typed input into the {@link OTP_CODE_PATTERN} shape:
 * uppercases, drops every character outside the base32 alphabet (spaces,
 * stray punctuation, a pasted hyphen), inserts the hyphen after the fifth
 * character, and truncates to ten characters.
 */
export function formatOtpCode(value: string): string {
  const normalized = value.toUpperCase().replaceAll(/[^A-Z2-7]/g, '')
  if (normalized.length <= 5) return normalized
  return `${normalized.slice(0, 5)}-${normalized.slice(5, 10)}`
}

/**
 * Email, handle, or DID, optionally preceded by `@`. A bare name without a
 * dot is allowed: {@link normalizeSignInIdentifier} completes it on submit,
 * because password managers fill saved values without blurring the field.
 *
 * @NOTE All three alternatives sit inside one group. The regex this replaced
 * read `^(email|handle)|did:…$`, which by alternation precedence anchored only
 * the first two — so anything merely *containing* `did:x:y` passed. As a
 * `pattern` attribute every branch is anchored, which is what was meant.
 */
export const SIGN_IN_IDENTIFIER_PATTERN =
  '@?([^@]+@[^@]+|[^.@]+(\\.[^.@]+)*|did:[a-z0-9]+:.+)'

/**
 * Trims, lowercases, strips a leading `@`, and appends the first available
 * domain to a bare name. Applied on blur (so the field shows the result) and
 * on submit (so a value filled by a password manager is normalised too).
 */
export function normalizeSignInIdentifier(
  value: string,
  domains: readonly string[],
): string {
  let normalized = value.trim().toLowerCase()
  if (normalized.startsWith('@')) normalized = normalized.slice(1)
  if (
    normalized.length > 0 &&
    domains.length > 0 &&
    !normalized.startsWith('did:') &&
    !normalized.includes('@') &&
    !normalized.includes('.')
  ) {
    return `${normalized}${domains[0]}`
  }
  return normalized
}
