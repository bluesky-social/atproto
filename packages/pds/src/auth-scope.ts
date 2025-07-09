// @TODO sync-up with current method names, consider backwards compat.
export enum AuthScope {
  Access = 'com.atproto.access',
  Refresh = 'com.atproto.refresh',
  AppPass = 'com.atproto.appPass',
  AppPassPrivileged = 'com.atproto.appPassPrivileged',
  SignupQueued = 'com.atproto.signupQueued',
  Takendown = 'com.atproto.takendown',
}

export const ACCESS_FULL = [AuthScope.Access] as const
export const ACCESS_PRIVILEGED = [
  ...ACCESS_FULL,
  AuthScope.AppPassPrivileged,
] as const
export const ACCESS_STANDARD = [
  ...ACCESS_PRIVILEGED,
  AuthScope.AppPass,
] as const

const authScopesValues = new Set(Object.values(AuthScope))
export function isAuthScope(val: unknown): val is AuthScope {
  return (authScopesValues as Set<unknown>).has(val)
}

export function isAccessFull(
  scope: AuthScope,
): scope is (typeof ACCESS_FULL)[number] {
  return (ACCESS_FULL as readonly string[]).includes(scope)
}

export function isAccessPrivileged(
  scope: AuthScope,
): scope is (typeof ACCESS_PRIVILEGED)[number] {
  return (ACCESS_PRIVILEGED as readonly string[]).includes(scope)
}

export function isTakendown(scope: unknown): scope is AuthScope.Takendown {
  return scope === AuthScope.Takendown
}
