import { AccountPermission } from './scopes/account-permission.js'
import { BlobPermission } from './scopes/blob-permission.js'
import { IdentityPermission } from './scopes/identity-permission.js'
import { IncludeScope } from './scopes/include-scope.js'
import { RepoPermission } from './scopes/repo-permission.js'
import { RpcPermission } from './scopes/rpc-permission.js'
import { isScopeStringFor } from './syntax.js'

export type AtprotoOauthScope =
  | 'atproto'
  | 'transition:email'
  | 'transition:generic'
  | 'transition:chat.bsky'
  | `account:${string}`
  | `blob:${string}`
  | `identity:${string}`
  | `include:${string}`
  | `repo:${string}`
  | `rpc:${string}`

export function isAtprotoOauthScope(value: string): value is AtprotoOauthScope {
  if (value === 'atproto') return true
  if (value === 'transition:email') return true
  if (value === 'transition:generic') return true
  if (value === 'transition:chat.bsky') return true

  if (isScopeStringFor(value, 'account')) {
    return AccountPermission.fromString(value) != null
  }
  if (isScopeStringFor(value, 'blob')) {
    return BlobPermission.fromString(value) != null
  }
  if (isScopeStringFor(value, 'identity')) {
    return IdentityPermission.fromString(value) != null
  }
  if (isScopeStringFor(value, 'include')) {
    return IncludeScope.fromString(value) != null
  }
  if (isScopeStringFor(value, 'repo')) {
    return RepoPermission.fromString(value) != null
  }
  if (isScopeStringFor(value, 'rpc')) {
    return RpcPermission.fromString(value) != null
  }

  return false
}
