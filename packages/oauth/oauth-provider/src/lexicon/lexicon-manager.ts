import { LexPermissionSet } from '@atproto/lexicon'
import {
  LexiconResolutionError,
  LexiconResolver,
} from '@atproto/lexicon-resolver'
import { IncludeScope, Nsid } from '@atproto/oauth-scopes'
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
  ): Promise<[nsid: Nsid, permissionSet: LexPermissionSet]> {
    const permissionSet = await this.getPermissionSet(nsid)
    return [nsid, permissionSet]
  }

  protected async getPermissionSet(nsid: Nsid): Promise<LexPermissionSet> {
    const { lexicon } = await this.lexiconGetter.get(nsid)

    if (!lexicon) {
      throw LexiconResolutionError.from(nsid)
    }

    if (lexicon.defs.main?.type !== 'permission-set') {
      const description = 'Lexicon document is not a permission set'
      throw LexiconResolutionError.from(nsid, description)
    }

    return lexicon.defs.main
  }
}

function parseScope(scope?: string) {
  const includeScopes: IncludeScope[] = []
  const otherScopes: string[] = []

  if (scope) {
    for (const scopeValue of scope.split(' ')) {
      const parsed = IncludeScope.fromString(scopeValue)
      if (parsed) {
        includeScopes.push(parsed)
      } else {
        otherScopes.push(scopeValue)
      }
    }
  }

  return {
    includeScopes,
    otherScopes,
  }
}

function extractNsids(includeScopes: IncludeScope[]): Set<Nsid> {
  return new Set(Array.from(includeScopes, extractNsid))
}

function extractNsid(nsidScope: IncludeScope): Nsid {
  return nsidScope.nsid
}

export function nsidToPermissionScopes(
  this: Map<string, LexPermissionSet>,
  includeScope: IncludeScope,
): string[] {
  const permissionSet = this.get(includeScope.nsid)!
  return includeScope.toPermissions(permissionSet).map(String)
}
