import { isAtIdentifierString, isValidHandle } from '@atproto/syntax'
import { MIN_PASSWORD_LENGTH } from './password.ts'

export { MIN_PASSWORD_LENGTH }

/** An email address whose domain carries a TLD (a dot with a label after it). */
export const EMAIL_PATTERN = '[^@\\s]+@[^@\\s]+\\.[^@\\s]+'

// @NOTE Browsers compile `pattern` attributes with the `v` flag, under which a
// literal `-` inside a character class must be escaped. A pattern that fails to
// compile is silently ignored, which disables the constraint altogether.

/**
 * A handle's leftmost label: lowercase alphanumerics and hyphens, neither
 * leading nor trailing with a hyphen.
 */
export const HANDLE_SEGMENT_PATTERN =
  '[a-zA-Z0-9](?:[a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?'
const HANDLE_TLD_PATTERN = '[a-zA-Z](?:[a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?'

export const HANDLE_PATTERN = `@?(?:${HANDLE_SEGMENT_PATTERN}\\.)+${HANDLE_TLD_PATTERN}`

export const DID_PATTERN = `(?:did:plc:[a-z2-7]{24})|(?:did:web:[a-z0-9._\\-]+)`

export const IDENTIFIER_PATTERN = `(?:${EMAIL_PATTERN})|(?:${HANDLE_PATTERN})|(?:${DID_PATTERN})`

const EMAIL_IDENTIFIER_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function isIdentifier(value: string): boolean {
  if (value.startsWith('@')) return isValidHandle(value.slice(1))
  return isAtIdentifierString(value) || EMAIL_IDENTIFIER_REGEX.test(value)
}

/**
 * The OTP shape the provider issues: two groups of five RFC-4648 base32
 * characters (A–Z and 2–7, so no 0/1/8/9) separated by a hyphen.
 *
 * Stated as a `pattern` attribute source — the attribute is implicitly anchored
 * to the whole value, so it carries no `^`/`$`.
 */
export const OTP_CODE_PATTERN = '[A-Z2-7]{5}-[A-Z2-7]{5}'
export const OTP_CODE_REGEX = new RegExp(`^(?:${OTP_CODE_PATTERN})$`)

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
 * Trims, lowercases, strips a leading `@`, and appends the first available
 * domain to a bare name. Applied on blur (so the field shows the result) and
 * on submit (so a value filled by a password manager is normalised too).
 */
export function normalizeIdentifier(
  value: string,
  domains?: readonly string[],
): string {
  let normalized = value.trim().toLowerCase()
  if (normalized.startsWith('@')) normalized = normalized.slice(1)
  if (
    normalized.length > 0 &&
    domains?.length &&
    !normalized.startsWith('did:') &&
    !normalized.includes('@') &&
    !normalized.includes('.')
  ) {
    return `${normalized}${domains[0]}`
  }
  return normalized
}
