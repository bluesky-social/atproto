import { ScopeStringFor, isScopeStringFor } from './lib/syntax.js'
import { AccountPermission } from './scopes/account-permission.js'
import { BlobPermission } from './scopes/blob-permission.js'
import { IdentityPermission } from './scopes/identity-permission.js'
import { IncludeScope } from './scopes/include-scope.js'
import { RepoPermission } from './scopes/repo-permission.js'
import { RpcPermission } from './scopes/rpc-permission.js'

export { type ScopeStringFor, isScopeStringFor }

export type AtprotoOauthScope =
  | 'atproto'
  | 'transition:email'
  | 'transition:generic'
  | 'transition:chat.bsky'
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
    value === 'atproto' ||
    value === 'transition:email' ||
    value === 'transition:generic' ||
    value === 'transition:chat.bsky' ||
    AccountPermission.fromString(value) != null ||
    BlobPermission.fromString(value) != null ||
    IdentityPermission.fromString(value) != null ||
    IncludeScope.fromString(value) != null ||
    RepoPermission.fromString(value) != null ||
    RpcPermission.fromString(value) != null
  )
}
