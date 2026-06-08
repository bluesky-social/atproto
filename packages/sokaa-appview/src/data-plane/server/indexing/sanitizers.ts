import { normalizeDatetimeAlways } from '@atproto/syntax'

/** Strip null bytes from user-provided strings before DB insert. */
export const stripNullBytes = (
  str: string | undefined | null,
): string | null => {
  if (str == null) return null
  return str.replace(/\0/g, '')
}

export const normalizeCreatedAt = (createdAt: string): string => {
  return normalizeDatetimeAlways(createdAt)
}
