import { LexPermissionSet } from '@atproto/lexicon'
import { LexiconResolver } from '@atproto/lexicon-resolver'
import {
  AccountPermission,
  BlobPermission,
  IdentityPermission,
  Nsid,
  RepoPermission,
  RpcPermission,
  parsePermissionLexicon,
} from '@atproto/oauth-scopes'
import { NSID, parseNSID } from '../lib/nsid.js'
import { isNonNullable, stringify } from '../lib/util/function.js'
import { LexiconGetter } from './lexicon-getter.js'
import { LexiconStore } from './lexicon-store.js'

export * from './lexicon-store.js'
export { NSID }

export class LexiconManager {
  protected readonly lexiconGetter: LexiconGetter

  constructor(store: LexiconStore, resolveLexicon?: LexiconResolver) {
    this.lexiconGetter = new LexiconGetter(store, resolveLexicon)
  }

  public async getPermissionSetsFromScope(scope?: string) {
    const scopeValues = new Set(scope?.split(' '))
    return this.extractPermissionSets(scopeValues)
  }

  /**
   * Transforms a scope string from an authorization request into a scope
   * composed solely of granular permission scopes, transforming any NSID
   * into its corresponding permission scopes.
   */
  public async buildTokenScope(scope?: string): Promise<string> {
    const scopeValues = new Set(scope?.split(' '))
    const permissionSets = await this.extractPermissionSets(scopeValues)

    return Array.from(scopeValues)
      .flatMap(nsidToPermissionScopes, permissionSets)
      .join(' ')
  }

  /**
   * Given a list of scope values, extract those that are NSIDs and return their
   * corresponding permission sets.
   */
  protected async extractPermissionSets(scopeValues: Set<string>) {
    const nsids = extractNsids(scopeValues)
    return this.getPermissionSets(nsids)
  }

  protected async getPermissionSets(nsids: Iterable<NSID>) {
    return new Map<string, LexPermissionSet>(
      await Promise.all(Array.from(nsids, this.getPermissionSetEntry, this)),
    )
  }

  protected async getPermissionSetEntry(
    nsid: NSID,
  ): Promise<[nsid: string, permissionSet: LexPermissionSet]> {
    const permissionSet = await this.getPermissionSet(nsid)
    return [nsid.toString(), permissionSet]
  }

  protected async getPermissionSet(nsid: NSID): Promise<LexPermissionSet> {
    const { lexicon } = await this.lexiconGetter.get(nsid)
    return lexicon.defs.main
  }
}

function extractNsids(scopeValues: Set<string>): NSID[] {
  return Array.from(scopeValues, parseNSID).filter(isNonNullable)
}

function nsidToPermissionScopes(
  this: Map<string, LexPermissionSet>,
  scopeValue: string,
): string | string[] {
  const permissionSet = this.get(scopeValue)
  if (permissionSet) {
    // The "scopeValue" is an nsid, replace it with all the granular permission
    // scopes it implies, ignoring invalid values.
    return permissionSet.permissions
      .map(parsePermissionLexicon)
      .filter(isNonNullable)
      .filter(isAllowedPermissionSetPermission, NSID.parse(scopeValue))
      .map(stringify)
  }
  return scopeValue
}

function isAllowedPermissionSetPermission(
  this: NSID,
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

  // @TODO should we allow BlobPermission as part of a permission set?

  return false
}

function isUnderAuthority(this: NSID, nsidStr: '*' | Nsid) {
  if (nsidStr === '*') return false
  const nsid = parseNSID(nsidStr)
  if (!nsid) return false // invalid NSID (should never happen)
  return nsid.authority === this.authority
}
