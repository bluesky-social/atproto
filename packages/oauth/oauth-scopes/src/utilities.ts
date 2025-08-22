import { Nsid } from './lib/nsid.js'
import { isNonNullable } from './lib/util.js'
import {
  AccountPermission,
  AccountPermissionMatch,
  LexPermission,
} from './resources/account-permission.js'
import {
  BlobPermission,
  BlobPermissionMatch,
} from './resources/blob-permission.js'
import {
  IdentityPermission,
  IdentityPermissionMatch,
} from './resources/identity-permission.js'
import { IncludeScope } from './resources/include-permission.js'
import {
  RepoPermission,
  RepoPermissionMatch,
} from './resources/repo-permission.js'
import {
  RpcPermission,
  RpcPermissionMatch,
} from './resources/rpc-permission.js'
import { ResourceSyntax, isResourceSyntaxFor } from './syntax.js'
import { LexPermissionSet } from './types.js'

export type ScopeMatchingOptionsByResource = {
  account: AccountPermissionMatch
  identity: IdentityPermissionMatch
  repo: RepoPermissionMatch
  rpc: RpcPermissionMatch
  blob: BlobPermissionMatch
}

type AtprotoOauthScope =
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
export function isValidAtprotoOauthScope(
  value: string,
): value is AtprotoOauthScope {
  if (value === 'atproto') return true
  if (value === 'transition:email') return true
  if (value === 'transition:generic') return true
  if (value === 'transition:chat.bsky') return true

  if (isResourceSyntaxFor(value, 'account')) {
    return AccountPermission.fromString(value) != null
  }
  if (isResourceSyntaxFor(value, 'blob')) {
    return BlobPermission.fromString(value) != null
  }
  if (isResourceSyntaxFor(value, 'identity')) {
    return IdentityPermission.fromString(value) != null
  }
  if (isResourceSyntaxFor(value, 'include')) {
    return IncludeScope.fromString(value) != null
  }
  if (isResourceSyntaxFor(value, 'repo')) {
    return RepoPermission.fromString(value) != null
  }
  if (isResourceSyntaxFor(value, 'rpc')) {
    return RpcPermission.fromString(value) != null
  }

  return false
}

export function parsePermissionScope(string: string) {
  return parsePermissionSyntax(ResourceSyntax.fromString(string))
}

export function parsePermissionLexicon(lexPermission: LexPermission) {
  return parsePermissionSyntax(ResourceSyntax.fromLex(lexPermission))
}

export function parsePermissionSyntax(syntax: ResourceSyntax) {
  if (syntax.is('account')) return AccountPermission.fromSyntax(syntax)
  if (syntax.is('identity')) return IdentityPermission.fromSyntax(syntax)
  if (syntax.is('repo')) return RepoPermission.fromSyntax(syntax)
  if (syntax.is('rpc')) return RpcPermission.fromSyntax(syntax)
  if (syntax.is('blob')) return BlobPermission.fromSyntax(syntax)
  return null
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
  if (!isResourceSyntaxFor(scope, resource)) return false

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

/**
 * Allows building, from a (parsed) `include:` scope, and the matching
 * permission set definition, the list of valid and allowed bundled permissions.
 */
export function includeScopeToPermissions(
  includeScope: IncludeScope,
  permissionSet: LexPermissionSet,
) {
  return permissionSet.permissions
    .map(parsePermissionLexiconWithDefault, includeScope)
    .filter(isNonNullable)
    .filter(isAllowedPermissionSetPermission, includeScope)
}

function parsePermissionLexiconWithDefault(
  this: IncludeScope,
  permission: LexPermission,
) {
  if (
    permission.resource === 'rpc' &&
    permission.aud === 'inherit' &&
    this.aud
  ) {
    // "rpc:" permissions can "inherit" their audience from the
    // "include:<nsid>?aud=<audience>" scope
    return parsePermissionLexicon({ ...permission, aud: this.aud })
  }

  return parsePermissionLexicon(permission)
}

function isAllowedPermissionSetPermission(
  this: IncludeScope,
  permission:
    | AccountPermission
    | BlobPermission
    | IdentityPermission
    | RepoPermission
    | RpcPermission,
): permission is RpcPermission | RepoPermission | BlobPermission {
  if (permission instanceof RpcPermission) {
    return permission.lxm.every(isUnderAuthority, this)
  }

  if (permission instanceof RepoPermission) {
    return permission.collection.every(isUnderAuthority, this)
  }

  if (permission instanceof BlobPermission) {
    return true
  }

  return false
}

function isUnderAuthority(this: IncludeScope, itemNsid: '*' | Nsid) {
  if (itemNsid === '*') return false

  const authorityNamespace = extractNsidNamespace(this.nsid)
  const itemNamespace = extractNsidNamespace(itemNsid)
  return (
    itemNamespace === authorityNamespace ||
    itemNamespace.startsWith(`${authorityNamespace}.`)
  )
}

function extractNsidNamespace(nsid: Nsid) {
  const lastDot = nsid.lastIndexOf('.')
  return nsid.slice(0, lastDot) as `${string}.${string}`
}
