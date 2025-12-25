import { AtprotoAudience, isAtprotoAudience } from '@atproto/did'
import { LexiconPermission, LexiconPermissionSet } from '../lib/lexicon.js'
import { Nsid, isNsid } from '../lib/nsid.js'
import { Parser } from '../lib/parser.js'
import { LexPermissionSyntax } from '../lib/syntax-lexicon.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import {
  ScopeStringFor,
  ScopeSyntax,
  isScopeStringFor,
  isScopeSyntaxFor,
} from '../lib/syntax.js'
import { RepoPermission } from './repo-permission.js'
import { RpcPermission } from './rpc-permission.js'

export { type LexiconPermission, type LexiconPermissionSet, type Nsid, isNsid }

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

  toPermissions(
    permissionSet: LexiconPermissionSet,
  ): Array<RepoPermission | RpcPermission> {
    return Array.from(this.buildPermissions(permissionSet))
  }

  toScopes(
    permissionSet: LexiconPermissionSet,
  ): Array<ScopeStringFor<'repo' | 'rpc'>> {
    return Array.from(this.buildPermissions(permissionSet), (p) => p.toString())
  }

  /**
   * Converts an "include:" to the list of permissions it includes, based on the
   * lexicon defined permission set.
   */
  *buildPermissions(
    permissionSet: LexiconPermissionSet,
  ): Generator<RepoPermission | RpcPermission, void, unknown> {
    for (const lexPermission of permissionSet.permissions) {
      const syntax = this.parseLexPermission(lexPermission)
      if (!syntax) continue

      const resourcePermission = toResourcePermission(syntax)
      if (!resourcePermission) continue

      if (this.isAllowedPermission(resourcePermission)) {
        yield resourcePermission
      }
    }
  }

  protected parseLexPermission(
    permission: LexiconPermission,
  ): ScopeSyntax<'repo' | 'rpc'> | null {
    // This function converts permissions listed in the permission set into
    // their respective ScopeSyntax representations, handling special cases as
    // needed.

    if (isLexPermissionForResource(permission, 'repo')) {
      return new LexPermissionSyntax(permission)
    }

    if (isLexPermissionForResource(permission, 'rpc')) {
      // "rpc" permissions with a defined audience are not allowed in permission
      // sets
      if (permission.aud !== undefined && permission.aud !== '*') {
        return null
      }

      // "rpc" permissions can "inherit" their audience from "aud" param defined
      // in the "include:<nsid>?aud=<audience>" scope the permission set was
      // loaded from.
      if (
        permission.inheritAud === true &&
        permission.aud === undefined &&
        this.aud !== undefined
      ) {
        const { inheritAud, ...rest } = permission
        return new LexPermissionSyntax({ aud: this.aud, ...rest })
      }

      return new LexPermissionSyntax(permission)
    }

    return null
  }

  /**
   * Verifies that a permission included through a lexicon permission set is
   * allowed in the context of the `include:` scope. This basically checks that
   * the permission is "under" the namespace authority of the `include:` scope,
   * and that it only contains "repo:", "rpc:", or "blob:" permissions.
   */
  protected isAllowedPermission(
    permission: RpcPermission | RepoPermission,
  ): boolean {
    if (permission instanceof RpcPermission) {
      return permission.lxm.every(this.isParentAuthorityOf, this)
    }

    if (permission instanceof RepoPermission) {
      return permission.collection.every(this.isParentAuthorityOf, this)
    }

    throw new TypeError(`Unexpected permission ${permission}`)
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

function toResourcePermission(
  syntax: ScopeSyntax<'repo' | 'rpc'>,
): RepoPermission | RpcPermission | null {
  if (isScopeSyntaxFor(syntax, 'repo')) {
    return RepoPermission.fromSyntax(syntax)
  }
  if (isScopeSyntaxFor(syntax, 'rpc')) {
    return RpcPermission.fromSyntax(syntax)
  }
  return null
}

function isLexPermissionForResource<
  P extends { resource: unknown },
  T extends string,
>(permission: P, type: T): permission is P & { resource: T } {
  return permission.resource === type
}
