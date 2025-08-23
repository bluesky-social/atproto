import { AtprotoDid, isAtprotoDid } from '@atproto/did'
import { Nsid, isNsid } from '../lib/nsid.js'
import { isNonNullable } from '../lib/util.js'
import { Parser } from '../parser.js'
import { parseResourcePermissionLexicon } from '../resources.js'
import { ScopeSyntax, isScopeSyntaxFor } from '../syntax.js'
import { LexPermission, LexPermissionSet } from '../types.js'
import { AccountPermission } from './account-permission.js'
import { BlobPermission } from './blob-permission.js'
import { IdentityPermission } from './identity-permission.js'
import { RepoPermission } from './repo-permission.js'
import { RpcPermission } from './rpc-permission.js'

/**
 * This is used to handle "include:" oauth scope values, used to include
 * permissions from a lexicon defined permission set. Not being a resource
 * permission, it does not implement `Matchable`.
 */
export class IncludeScope {
  constructor(
    public readonly nsid: Nsid,
    public readonly aud: undefined | AtprotoDid,
  ) {}

  toString() {
    return IncludeScope.parser.format(this)
  }

  /**
   * Converts an "include:" to the list of permissions it includes, based on the
   * lexicon defined permission set.
   */
  toPermissions(
    permissionSet: LexPermissionSet,
  ): Array<RpcPermission | RepoPermission | BlobPermission> {
    return permissionSet.permissions
      .map(parseIncludedPermission, this)
      .filter(isNonNullable)
      .filter(isIncludedPermissionAllowed, this)
  }

  protected static readonly parser = new Parser(
    'include',
    {
      nsid: {
        multiple: false,
        required: true,
        validate: isNsid,
      },
      aud: {
        multiple: false,
        required: false,
        validate: isAtprotoDid,
      },
    },
    'nsid',
  )

  static fromString(scope: string) {
    if (!isScopeSyntaxFor(scope, 'include')) return null
    const syntax = ScopeSyntax.fromString(scope)
    return IncludeScope.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax) {
    const result = IncludeScope.parser.parse(syntax)
    if (!result) return null
    return new IncludeScope(result.nsid, result.aud)
  }
}

/**
 * Parses a permission included thought a lexicon permission set, in the
 * context of an `include:` scope.
 */
function parseIncludedPermission(
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
    return parseResourcePermissionLexicon({ ...permission, aud: this.aud })
  }

  return parseResourcePermissionLexicon(permission)
}

/**
 * Verifies that a permission included through a lexicon permission set is
 * allowed in the context of the `include:` scope. This basically checks that
 * the permission is "under" the namespace authority of the `include:` scope,
 * and that it only contains "repo:", "rpc:", or "blob:" permissions.
 */
function isIncludedPermissionAllowed(
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

/**
 * Verifies that an nsid is under the namespace has the right authority in the
 * context of an `include:` scope.
 */
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
