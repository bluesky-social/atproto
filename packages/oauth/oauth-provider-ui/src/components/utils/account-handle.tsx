import type { Account } from '@atproto/oauth-provider-api'

export function accountHandle(account?: Account): string | undefined {
  return sanitizeHandle(account?.preferred_username)
}

export function isInvalidHandle(handle: string): boolean {
  return handle === 'handle.invalid'
}

export function sanitizeHandle(handle?: string): string | undefined {
  if (!handle) return undefined
  return isInvalidHandle(handle)
    ? '⚠Invalid Handle'
    : handle.startsWith('@')
      ? handle
      : `@${handle}`
}
