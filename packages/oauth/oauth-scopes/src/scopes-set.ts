import { ScopeMissingError } from './scope-missing-error.js'
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

export { ScopeMissingError }

export type ScopeMatchingOptionsByResource = {
  account: AccountPermissionMatch
  identity: IdentityPermissionMatch
  repo: RepoPermissionMatch
  rpc: RpcPermissionMatch
  blob: BlobPermissionMatch
}

/**
 * Utility class to manage a set of scopes and check if they match specific
 * options for a given resource.
 */
export class ScopesSet extends Set<string> {
  /**
   * Check if the container has a scope that matches the given options for a
   * specific resource.
   */
  public matches<R extends keyof ScopeMatchingOptionsByResource>(
    resource: R,
    options: ScopeMatchingOptionsByResource[R],
  ): boolean {
    for (const scope of this) {
      if (permissionScopeMatches(scope, resource, options)) return true
    }
    return false
  }

  public assert<R extends keyof ScopeMatchingOptionsByResource>(
    resource: R,
    options: ScopeMatchingOptionsByResource[R],
  ) {
    if (!this.matches(resource, options)) {
      const scope = scopeNeededFor(resource, options)
      throw new ScopeMissingError(scope)
    }
  }

  public some(fn: (scope: string) => boolean): boolean {
    for (const scope of this) if (fn(scope)) return true
    return false
  }

  public every(fn: (scope: string) => boolean): boolean {
    for (const scope of this) if (!fn(scope)) return false
    return true
  }

  public *filter(fn: (scope: string) => boolean) {
    for (const scope of this) if (fn(scope)) yield scope
  }

  public *map<O>(fn: (scope: string) => O) {
    for (const scope of this) yield fn(scope)
  }

  static fromString(string?: string): ScopesSet {
    return new ScopesSet(string?.split(' '))
  }
}

function scopeNeededFor<R extends keyof ScopeMatchingOptionsByResource>(
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

function permissionScopeMatches<R extends keyof ScopeMatchingOptionsByResource>(
  scope: string,
  resource: R,
  options: ScopeMatchingOptionsByResource[R],
): boolean {
  // @NOTE we might want to cache the parsed scopes though, in practice, a
  // single scope is unlikely to be parsed multiple times during a single
  // request.
  const permission = parsePermissionScope(resource, scope)
  if (!permission) return false

  // @ts-expect-error
  return permission.matches(options)
}

function parsePermissionScope(resource: string, scope: string) {
  switch (resource) {
    case 'account':
      return AccountPermission.fromString(scope)
    case 'identity':
      return IdentityPermission.fromString(scope)
    case 'repo':
      return RepoPermission.fromString(scope)
    case 'rpc':
      return RpcPermission.fromString(scope)
    case 'blob':
      return BlobPermission.fromString(scope)
    default:
      return null
  }
}
