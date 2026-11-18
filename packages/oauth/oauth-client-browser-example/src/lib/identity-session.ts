import { type AtprotoDid, isAtprotoDid } from '@atproto/did'

export type IdentitySession = {
  did: AtprotoDid
  /** Absent when the handle did not verify bidirectionally. */
  handle?: string
  /** Seconds since epoch of the account's last password sign-in. */
  authTime?: number
  /** Milliseconds since epoch. */
  verifiedAt: number
}

export const IDENTITY_SESSION_KEY = 'fedcm-identity-session'
// Matches the public-client OAuth session lifetime.
export const IDENTITY_SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000

/** Whether the requested scope asks for authentication only. */
export function isAuthnOnlyScope(scope: string): boolean {
  const tokens = scope.split(/\s+/).filter(Boolean)
  return tokens.length === 1 && tokens[0] === 'atproto'
}

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function parseSession(raw: unknown): IdentitySession | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { did, handle, authTime, verifiedAt } = raw as Record<string, unknown>
  if (!isAtprotoDid(did)) return null
  if (typeof verifiedAt !== 'number' || !Number.isFinite(verifiedAt)) {
    return null
  }
  if (handle !== undefined && typeof handle !== 'string') return null
  if (authTime !== undefined && typeof authTime !== 'number') return null
  return {
    did,
    ...(handle !== undefined && { handle }),
    ...(authTime !== undefined && { authTime }),
    verifiedAt,
  }
}

export function readIdentitySession(
  storage: Storage | undefined = defaultStorage(),
  now: number = Date.now(),
): IdentitySession | null {
  try {
    const raw = storage?.getItem(IDENTITY_SESSION_KEY)
    if (!raw) return null
    const session = parseSession(JSON.parse(raw))
    if (!session) return null
    if (now > session.verifiedAt + IDENTITY_SESSION_LIFETIME_MS) return null
    return session
  } catch {
    return null
  }
}

export function writeIdentitySession(
  session: IdentitySession,
  storage: Storage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(IDENTITY_SESSION_KEY, JSON.stringify(session))
  } catch (err) {
    console.warn('Failed to persist identity session:', err)
  }
}

export function clearIdentitySession(
  storage: Storage | undefined = defaultStorage(),
): void {
  try {
    storage?.removeItem(IDENTITY_SESSION_KEY)
  } catch (err) {
    console.warn('Failed to clear identity session:', err)
  }
}
