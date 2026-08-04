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
 * Email, handle (with at least one dot), or DID.
 *
 * @NOTE All three alternatives sit inside one group. The regex this replaced
 * read `^(email|handle)|did:…$`, which by alternation precedence anchored only
 * the first two — so anything merely *containing* `did:x:y` passed. As a
 * `pattern` attribute every branch is anchored, which is what was meant.
 */
export const SIGN_IN_IDENTIFIER_PATTERN =
  '([^@]+@[^@]+|[^.@]+(\\.[^.@]+)+|did:[a-z0-9]+:.+)'
