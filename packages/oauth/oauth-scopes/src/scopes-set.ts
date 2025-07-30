import { AccountScope, AccountScopeMatch } from './resources/account-scope.js'
import { BlobScope, BlobScopeMatch } from './resources/blob-scope.js'
import {
  IdentityScope,
  IdentityScopeMatch,
} from './resources/identity-scope.js'
import { RepoScope, RepoScopeMatch } from './resources/repo-scope.js'
import { RpcScope, RpcScopeMatch } from './resources/rpc-scope.js'
import { isScopeForResource } from './syntax.js'

type ScopeMatchingOptionsByResource = {
  account: AccountScopeMatch
  identity: IdentityScopeMatch
  repo: RepoScopeMatch
  rpc: RpcScopeMatch
  blob: BlobScopeMatch
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
      // Optimization: Do not try parsing the scope if it does not match the
      // resource prefix.
      if (!isScopeForResource(scope, resource)) continue

      // @NOTE we might want to cache the parsed scopes though, in practice, a
      // single scope is unlikely to be parsed multiple times during a single
      // request.
      if (resource === 'rpc') {
        const rpcScope = RpcScope.fromString(scope)
        if (rpcScope?.matches(options as RpcScopeMatch)) {
          return true
        }
      } else if (resource === 'account') {
        const accountScope = AccountScope.fromString(scope)
        if (accountScope?.matches(options as AccountScopeMatch)) {
          return true
        }
      } else if (resource === 'identity') {
        const identityScope = IdentityScope.fromString(scope)
        if (identityScope?.matches(options as IdentityScopeMatch)) {
          return true
        }
      } else if (resource === 'repo') {
        const repoScope = RepoScope.fromString(scope)
        if (repoScope?.matches(options as RepoScopeMatch)) {
          return true
        }
      } else if (resource === 'blob') {
        const blobScope = BlobScope.fromString(scope)
        if (blobScope?.matches(options as BlobScopeMatch)) {
          return true
        }
      }
    }

    return false
  }
}
