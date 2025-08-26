import {
  AccountPermission,
  AccountPermissionMatch,
} from './scopes/account-permission.js'
import {
  BlobPermission,
  BlobPermissionMatch,
} from './scopes/blob-permission.js'
import {
  IdentityPermission,
  IdentityPermissionMatch,
} from './scopes/identity-permission.js'
import {
  RepoPermission,
  RepoPermissionMatch,
} from './scopes/repo-permission.js'
import { RpcPermission, RpcPermissionMatch } from './scopes/rpc-permission.js'
import { isScopeStringFor } from './syntax.js'

export type ScopeMatchingOptionsByResource = {
  account: AccountPermissionMatch
  identity: IdentityPermissionMatch
  repo: RepoPermissionMatch
  rpc: RpcPermissionMatch
  blob: BlobPermissionMatch
}

export function scopeNeededFor<R extends keyof ScopeMatchingOptionsByResource>(
  resource: R,
  options: ScopeMatchingOptionsByResource[R],
): string {
  switch (resource) {
    case 'account':
      return AccountPermission.scopeNeededFor(options as AccountPermissionMatch)
    case 'identity':
      return IdentityPermission.scopeNeededFor(
        options as IdentityPermissionMatch,
      )
    case 'repo':
      return RepoPermission.scopeNeededFor(options as RepoPermissionMatch)
    case 'rpc':
      return RpcPermission.scopeNeededFor(options as RpcPermissionMatch)
    case 'blob':
      return BlobPermission.scopeNeededFor(options as BlobPermissionMatch)
  }
  // @ts-expect-error
  throw new TypeError(`Unknown resource: ${resource}`)
}

export function scopeMatches<R extends keyof ScopeMatchingOptionsByResource>(
  scope: string,
  resource: R,
  options: ScopeMatchingOptionsByResource[R],
): boolean {
  // Optimization: Do not try parsing the scope if it does not match the
  // resource prefix.
  if (!isScopeStringFor(scope, resource)) return false

  // @NOTE we might want to cache the parsed scopes though, in practice, a
  // single scope is unlikely to be parsed multiple times during a single
  // request.
  if (resource === 'rpc') {
    const rpcScope = RpcPermission.fromString(scope)
    if (rpcScope?.matches(options as RpcPermissionMatch)) {
      return true
    }
  } else if (resource === 'account') {
    const accountScope = AccountPermission.fromString(scope)
    if (accountScope?.matches(options as AccountPermissionMatch)) {
      return true
    }
  } else if (resource === 'identity') {
    const identityScope = IdentityPermission.fromString(scope)
    if (identityScope?.matches(options as IdentityPermissionMatch)) {
      return true
    }
  } else if (resource === 'repo') {
    const repoScope = RepoPermission.fromString(scope)
    if (repoScope?.matches(options as RepoPermissionMatch)) {
      return true
    }
  } else if (resource === 'blob') {
    const blobScope = BlobPermission.fromString(scope)
    if (blobScope?.matches(options as BlobPermissionMatch)) {
      return true
    }
  }

  return false
}
