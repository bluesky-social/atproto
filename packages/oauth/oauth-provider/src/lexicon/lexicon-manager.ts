import { LexPermissionSet } from '@atproto/lexicon'
import { LexiconResolver } from '@atproto/lexicon-resolver'
import {
  AccountPermission,
  BlobPermission,
  IdentityPermission,
  IncludeScope,
  LexPermission,
  Nsid,
  RepoPermission,
  RpcPermission,
  parsePermissionLexicon,
} from '@atproto/oauth-scopes'
import { isNonNullable, stringify } from '../lib/util/function.js'
import { LexiconGetter } from './lexicon-getter.js'
import { LexiconStore } from './lexicon-store.js'

export * from './lexicon-store.js'

export class LexiconManager {
  protected readonly lexiconGetter: LexiconGetter

  constructor(store: LexiconStore, resolveLexicon?: LexiconResolver) {
    this.lexiconGetter = new LexiconGetter(store, resolveLexicon)
  }

  public async getPermissionSetsFromScope(scope?: string) {
    const { includeScopes } = parseScope(scope)
    return this.extractPermissionSets(includeScopes)
  }

  /**
   * Transforms a scope string from an authorization request into a scope
   * composed solely of granular permission scopes, transforming any NSID
   * into its corresponding permission scopes.
   */
  public async buildTokenScope(scope: string): Promise<string> {
    const { includeScopes, otherScopes } = parseScope(scope)

    // If the scope does not contain any "include:<nsid>" scopes, return it as-is.
    if (!includeScopes.length) return scope

    const permissionSets = await this.extractPermissionSets(includeScopes)

    return Array.from(includeScopes)
      .flatMap(nsidToPermissionScopes, permissionSets)
      .concat(otherScopes)
      .join(' ')
  }

  /**
   * Given a list of scope values, extract those that are NSIDs and return their
   * corresponding permission sets.
   */
  protected async extractPermissionSets(includeScopes: IncludeScope[]) {
    const nsids = extractNsids(includeScopes)
    return this.getPermissionSets(nsids)
  }

  protected async getPermissionSets(nsids: Set<Nsid>) {
    return new Map<string, LexPermissionSet>(
      await Promise.all(Array.from(nsids, this.getPermissionSetEntry, this)),
    )
  }

  protected async getPermissionSetEntry(
    nsid: Nsid,
  ): Promise<[nsid: string, permissionSet: LexPermissionSet]> {
    const permissionSet = await this.getPermissionSet(nsid)
    return [nsid.toString(), permissionSet]
  }

  protected async getPermissionSet(nsid: Nsid): Promise<LexPermissionSet> {
    const { lexicon } = await this.lexiconGetter.get(nsid)
    return lexicon.defs.main
  }
}

function parseScope(scope?: string) {
  const otherScopes: string[] = []
  const includeScopes: IncludeScope[] = []

  if (scope) {
    for (const scopeValue of scope.split(' ')) {
      const parsed = IncludeScope.fromString(scopeValue)
      if (parsed) includeScopes.push(parsed)
      else otherScopes.push(scopeValue)
    }
  }

  return {
    otherScopes,
    includeScopes,
  }
}

function extractNsids(includeScopes: IncludeScope[]): Set<Nsid> {
  return new Set(Array.from(includeScopes, extractNsid))
}

function extractNsid(nsidScope: IncludeScope): Nsid {
  return nsidScope.nsid
}

function nsidToPermissionScopes(
  this: Map<string, LexPermissionSet>,
  nsidScope: IncludeScope,
): string[] {
  const permissionSet = this.get(nsidScope.nsid)!

  return permissionSet.permissions
    .map(parsePermissionLexiconWithDefault, nsidScope)
    .filter(isNonNullable)
    .filter(isAllowedPermissionSetPermission, nsidScope)
    .map(stringify)
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
) {
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
