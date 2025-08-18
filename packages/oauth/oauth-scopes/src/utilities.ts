import { AccountScope, AccountScopeMatch } from './resources/account-scope.js'
import { BlobScope, BlobScopeMatch } from './resources/blob-scope.js'
import {
  IdentityScope,
  IdentityScopeMatch,
} from './resources/identity-scope.js'
import { RepoScope, RepoScopeMatch } from './resources/repo-scope.js'
import { RpcScope, RpcScopeMatch } from './resources/rpc-scope.js'
import { ResourceSyntax, isScopeForResource } from './syntax.js'

export type ScopeMatchingOptionsByResource = {
  account: AccountScopeMatch
  identity: IdentityScopeMatch
  repo: RepoScopeMatch
  rpc: RpcScopeMatch
  blob: BlobScopeMatch
}

type AtprotoOauthScope =
  | 'atproto'
  | 'transition:email'
  | 'transition:generic'
  | 'transition:chat.bsky'
  | `repo:${string}`
  | `rpc:${string}`
  | `account:${string}`
  | `identity:${string}`
  | `blob:${string}`
export function isValidAtprotoOauthScope(
  value: string,
): value is AtprotoOauthScope {
  if (value === 'atproto') return true
  if (value === 'transition:email') return true
  if (value === 'transition:generic') return true
  if (value === 'transition:chat.bsky') return true

  if (isScopeForResource(value, 'repo')) {
    return RepoScope.fromString(value) != null
  }
  if (isScopeForResource(value, 'rpc')) {
    return RpcScope.fromString(value) != null
  }
  if (isScopeForResource(value, 'account')) {
    return AccountScope.fromString(value) != null
  }
  if (isScopeForResource(value, 'identity')) {
    return IdentityScope.fromString(value) != null
  }
  if (isScopeForResource(value, 'blob')) {
    return BlobScope.fromString(value) != null
  }

  return false
}

export function parseScope(string: string) {
  const syntax = ResourceSyntax.fromString(string)
  if (syntax.is('account')) return AccountScope.fromSyntax(syntax)
  if (syntax.is('identity')) return IdentityScope.fromSyntax(syntax)
  if (syntax.is('repo')) return RepoScope.fromSyntax(syntax)
  if (syntax.is('rpc')) return RpcScope.fromSyntax(syntax)
  if (syntax.is('blob')) return BlobScope.fromSyntax(syntax)
  return null
}

export function scopeNeededFor<R extends keyof ScopeMatchingOptionsByResource>(
  resource: R,
  options: ScopeMatchingOptionsByResource[R],
): string {
  switch (resource) {
    case 'account':
      return AccountScope.scopeNeededFor(options as AccountScopeMatch)
    case 'identity':
      return IdentityScope.scopeNeededFor(options as IdentityScopeMatch)
    case 'repo':
      return RepoScope.scopeNeededFor(options as RepoScopeMatch)
    case 'rpc':
      return RpcScope.scopeNeededFor(options as RpcScopeMatch)
    case 'blob':
      return BlobScope.scopeNeededFor(options as BlobScopeMatch)
  }
}

export function scopeMatches<R extends keyof ScopeMatchingOptionsByResource>(
  scope: string,
  resource: R,
  options: ScopeMatchingOptionsByResource[R],
): boolean {
  // Optimization: Do not try parsing the scope if it does not match the
  // resource prefix.
  if (!isScopeForResource(scope, resource)) return false

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

  return false
}
