import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Compares two strings in constant time with respect to their content.
 * Both sides are hashed first, so the comparison also does not depend on their
 * lengths. Behaves like `a === b`.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b))
}

// @NOTE `utf16le` (not the default utf8) keeps lone surrogates distinct: utf8
// encodes every one of them as U+FFFD, which would make two strings that `===`
// rejects compare as equal.
function digest(value: string): Buffer {
  return createHash('sha256').update(Buffer.from(value, 'utf16le')).digest()
}
