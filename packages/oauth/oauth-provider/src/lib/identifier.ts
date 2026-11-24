import type { IdentifierString } from '@atproto/oauth-provider-api'

export function normalizeIdentifierString(
  identifier: IdentifierString,
): IdentifierString {
  return identifier.trim().toLowerCase().replace(/^@/g, '') as IdentifierString
}
