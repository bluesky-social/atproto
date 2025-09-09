import { ScopeStringFor, isScopeStringFor } from './lib/syntax.js'
import { isNonNullable } from './lib/util.js'
import { AccountPermission } from './scopes/account-permission.js'
import { BlobPermission } from './scopes/blob-permission.js'
import { IdentityPermission } from './scopes/identity-permission.js'
import { IncludeScope } from './scopes/include-scope.js'
import { RepoPermission } from './scopes/repo-permission.js'
import { RpcPermission } from './scopes/rpc-permission.js'

export { type ScopeStringFor, isScopeStringFor }

export const STATIC_SCOPE_VALUES = Object.freeze([
  'atproto',
  'transition:email',
  'transition:generic',
  'transition:chat.bsky',
] as const)

export type StaticScopeValue = (typeof STATIC_SCOPE_VALUES)[number]
export function isStaticScopeValue(value: string): value is StaticScopeValue {
  return (STATIC_SCOPE_VALUES as readonly string[]).includes(value)
}

export type AtprotoOauthScope =
  | StaticScopeValue
  | ScopeStringFor<'account'>
  | ScopeStringFor<'blob'>
  | ScopeStringFor<'identity'>
  | ScopeStringFor<'include'>
  | ScopeStringFor<'repo'>
  | ScopeStringFor<'rpc'>

/**
 * @note This function does not only verify the scope string format (with
 * {@link isScopeStringFor}), but also checks if the provided parameters are
 * valid according to the respective scope syntax definition. This allows
 * excluding scopes that cannot be fully interpreted by the current version of
 * the code.
 */
export function isAtprotoOauthScope(value: string): value is AtprotoOauthScope {
  return (
    isStaticScopeValue(value) ||
    AccountPermission.fromString(value) != null ||
    BlobPermission.fromString(value) != null ||
    IdentityPermission.fromString(value) != null ||
    IncludeScope.fromString(value) != null ||
    RepoPermission.fromString(value) != null ||
    RpcPermission.fromString(value) != null
  )
}

export function normalizeAtprotoOauthScope(scope: string) {
  return scope
    .split(' ')
    .map(normalizeAtprotoOauthScopeValue)
    .filter(isNonNullable)
    .sort()
    .join(' ')
}

export function normalizeAtprotoOauthScopeValue(
  value: string,
): AtprotoOauthScope | null {
  if (isStaticScopeValue(value)) return value

  for (const Scope of [
    AccountPermission,
    BlobPermission,
    IdentityPermission,
    IncludeScope,
    RepoPermission,
    RpcPermission,
  ]) {
    const parsed = Scope.fromString(value)
    if (parsed) return parsed.toString()
  }

  return null
}
