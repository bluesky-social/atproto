import {
  CONFIDENTIAL_CLIENT_REFRESH_LIFETIME,
  CONFIDENTIAL_CLIENT_SESSION_LIFETIME,
  PUBLIC_CLIENT_REFRESH_LIFETIME,
  PUBLIC_CLIENT_SESSION_LIFETIME,
} from '../oauth-constants.js'
import type { TokenInfo } from './token-store.js'

export type OAuthSessionClientClassification = {
  isConfidential: boolean
  isFirstParty: boolean
}

/**
 * Uses current client information when available. The stored authentication
 * method is a best-effort fallback because first-party status is not persisted.
 */
export function usesExtendedOAuthSessionLifetime(
  tokenInfo: TokenInfo,
  client?: OAuthSessionClientClassification,
): boolean {
  return client
    ? client.isConfidential || client.isFirstParty
    : tokenInfo.data.clientAuth.method !== 'none'
}

export function getOAuthSessionLifetimes(usesExtendedSessionLifetime: boolean) {
  return usesExtendedSessionLifetime
    ? ([
        CONFIDENTIAL_CLIENT_SESSION_LIFETIME,
        CONFIDENTIAL_CLIENT_REFRESH_LIFETIME,
      ] as const)
    : ([
        PUBLIC_CLIENT_SESSION_LIFETIME,
        PUBLIC_CLIENT_REFRESH_LIFETIME,
      ] as const)
}

/**
 * Evaluates time-based activity. Refresh authentication can still fail because
 * of client credentials, DPoP binding, or metadata changes.
 */
export function isOAuthSessionActive(
  tokenInfo: TokenInfo,
  usesExtendedSessionLifetime: boolean,
  now = Date.now(),
): boolean {
  const { currentRefreshToken, data } = tokenInfo

  if (data.expiresAt.getTime() > now) return true
  if (currentRefreshToken === null) return false

  const [sessionLifetime, refreshLifetime] = getOAuthSessionLifetimes(
    usesExtendedSessionLifetime,
  )

  return (
    now - data.createdAt.getTime() <= sessionLifetime &&
    now - data.updatedAt.getTime() <= refreshLifetime
  )
}
