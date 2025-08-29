import { AtprotoAudience, isAtprotoAudience } from '@atproto/did'
import { LexPermission, LexPermissionSet } from '../lib/lexicon.js'
import { Nsid, isNsid } from '../lib/nsid.js'
import { Parser } from '../lib/parser.js'
import { LexPermissionSyntax } from '../lib/syntax-lexicon.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import { ScopeSyntax, isScopeStringFor } from '../lib/syntax.js'
import { BlobPermission } from './blob-permission.js'
import { RepoPermission } from './repo-permission.js'
import { RpcPermission } from './rpc-permission.js'

export { type LexPermission, type LexPermissionSet, type Nsid, isNsid }

/**
 * This is used to handle "include:" oauth scope values, used to include
 * permissions from a lexicon defined permission set. Not being a resource
 * permission, it does not implement `Matchable`.
 */
export class IncludeScope {
  constructor(
    public readonly nsid: Nsid,
    public readonly aud: undefined | AtprotoAudience = undefined,
  ) {}

  toString() {
    return IncludeScope.parser.format(this)
  }

  /**
   * Converts an "include:" to the list of permissions it includes, based on the
   * lexicon defined permission set.
   */
  toPermissions(permissionSet: LexPermissionSet) {
    return permissionSet.permissions
      .map(this.parsePermission, this)
      .filter(this.isAllowedPermission, this)
  }

  protected parsePermission(permission: LexPermission) {
    if (
      permission.resource === 'rpc' &&
      permission.inheritAud === true &&
      permission.aud === undefined &&
      this.aud !== undefined
    ) {
      // "rpc" permissions can "inherit" their audience from "aud" param defined
      // in the "include:<nsid>?aud=<audience>" scope the permission set was
      // loaded from.
      return parsePermission({
        ...permission,
        inheritAud: undefined,
        aud: this.aud,
      })
    }

    return parsePermission(permission)
  }

  /**
   * Verifies that a permission included through a lexicon permission set is
   * allowed in the context of the `include:` scope. This basically checks that
   * the permission is "under" the namespace authority of the `include:` scope,
   * and that it only contains "repo:", "rpc:", or "blob:" permissions.
   */
  protected isAllowedPermission(
    permission: unknown,
  ): permission is RpcPermission | RepoPermission | BlobPermission {
    if (permission instanceof RpcPermission) {
      return permission.lxm.every(this.isParentAuthorityOf, this)
    }

    if (permission instanceof RepoPermission) {
      return permission.collection.every(this.isParentAuthorityOf, this)
    }

    if (permission instanceof BlobPermission) {
      return true
    }

    return false
  }

  /**
   * Verifies that a permission item's nsid is under the same authority as the
   * nsid of the lexicon itself (which is the same as the nsid of the `include:`
   * scope).
   */
  public isParentAuthorityOf(otherNsid: '*' | Nsid) {
    if (otherNsid === '*') {
      return false
    }

    const lexiconNsid = this.nsid

    const groupPrefixEnd = lexiconNsid.lastIndexOf('.')

    // There should always be a dot, but since this is a security feature, let's
    // be strict about it.
    if (groupPrefixEnd === -1) {
      throw new TypeError('Dot character (".") missing from lexicon NSID')
    }

    // Make sure that otherNsid is at least as long as the "group prefix"
    if (groupPrefixEnd >= otherNsid.length - 1) {
      return false
    }

    // Make sure that the "otherNsid" starts with the group of the lexiconNsid,
    // up to the dot itself. We check in reverse order as nsids tend to have
    // long common prefixes.
    for (let i = groupPrefixEnd; i >= 0; i--) {
      if (lexiconNsid.charCodeAt(i) !== otherNsid.charCodeAt(i)) {
        return false
      }
    }

    return true
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
        validate: isAtprotoAudience,
      },
    },
    'nsid',
  )

  static fromString(scope: string) {
    if (!isScopeStringFor(scope, 'include')) return null
    const syntax = ScopeStringSyntax.fromString(scope)
    return IncludeScope.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax<'include'>) {
    const result = IncludeScope.parser.parse(syntax)
    if (!result) return null
    return new IncludeScope(result.nsid, result.aud)
  }
}

function parsePermission(permission: LexPermission) {
  if (isPermissionForResource(permission, 'repo')) {
    return RepoPermission.fromSyntax(new LexPermissionSyntax(permission))
  }
  if (isPermissionForResource(permission, 'rpc')) {
    return RpcPermission.fromSyntax(new LexPermissionSyntax(permission))
  }
  if (isPermissionForResource(permission, 'blob')) {
    return BlobPermission.fromSyntax(new LexPermissionSyntax(permission))
  }
  return null
}

function isPermissionForResource<P extends LexPermission, T extends string>(
  permission: P,
  type: T,
): permission is P & { resource: T } {
  return permission.resource === type
}
