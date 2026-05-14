import { LexiconPermissionSet, LexiconSpace } from '@atproto/lex-document'
import { LexResolver, LexResolverError } from '@atproto/lex-resolver'
import { IncludeScope, Nsid, SpacePermission } from '@atproto/oauth-scopes'
import { LexiconGetter } from './lexicon-getter.js'
import { LexiconStore } from './lexicon-store.js'

export * from './lexicon-store.js'

export class LexiconManager {
  protected readonly lexiconGetter: LexiconGetter

  constructor(store: LexiconStore, lexResolver: LexResolver) {
    this.lexiconGetter = new LexiconGetter(store, lexResolver)
  }

  public async getPermissionSetsFromScope(scope?: string) {
    const { includeScopes } = parseScope(scope)
    return this.extractPermissionSets(includeScopes)
  }

  /**
   * Extracts space-type NSIDs referenced by `space:` scopes in the request and
   * resolves their lexicon documents. Used by the consent screen to render
   * human-readable space names.
   *
   * Wildcard `type=*` scopes are skipped — there's no NSID to resolve.
   */
  public async getSpacesFromScope(
    scope?: string,
  ): Promise<Map<string, LexiconSpace>> {
    const nsids = extractSpaceTypeNsids(scope)
    return this.getSpaces(nsids)
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
    return new Map<string, LexiconPermissionSet>(
      await Promise.all(Array.from(nsids, this.getPermissionSetEntry, this)),
    )
  }

  protected async getPermissionSetEntry(
    nsid: Nsid,
  ): Promise<[nsid: Nsid, permissionSet: LexiconPermissionSet]> {
    const permissionSet = await this.getPermissionSet(nsid)
    return [nsid, permissionSet]
  }

  protected async getPermissionSet(nsid: Nsid): Promise<LexiconPermissionSet> {
    const { lexicon } = await this.lexiconGetter.get(nsid)

    if (!lexicon) {
      throw LexResolverError.from(nsid)
    }

    if (lexicon.defs.main?.type !== 'permission-set') {
      const description = 'Lexicon document is not a permission set'
      throw LexResolverError.from(nsid, description)
    }

    return lexicon.defs.main
  }

  /**
   * Resolve a set of space-type NSIDs to their lexicon documents. Failures
   * are tolerated — a space whose lexicon doesn't resolve, or doesn't have
   * `type: space` at `defs.main`, is silently dropped from the result so the
   * consent screen falls back to rendering the bare NSID.
   */
  protected async getSpaces(
    nsids: Set<Nsid>,
  ): Promise<Map<string, LexiconSpace>> {
    const entries = await Promise.all(
      Array.from(nsids, async (nsid) => {
        try {
          const space = await this.getSpace(nsid)
          return [nsid, space] as const
        } catch {
          return null
        }
      }),
    )
    return new Map(
      entries.filter((e): e is readonly [Nsid, LexiconSpace] => e !== null),
    )
  }

  protected async getSpace(nsid: Nsid): Promise<LexiconSpace> {
    const { lexicon } = await this.lexiconGetter.get(nsid)

    if (!lexicon) {
      throw LexResolverError.from(nsid)
    }

    if (lexicon.defs.main?.type !== 'space') {
      const description = 'Lexicon document is not a space'
      throw LexResolverError.from(nsid, description)
    }

    return lexicon.defs.main
  }
}

function extractSpaceTypeNsids(scope?: string): Set<Nsid> {
  const nsids = new Set<Nsid>()
  if (!scope) return nsids
  for (const value of scope.split(' ')) {
    const parsed = SpacePermission.fromString(value)
    if (!parsed) continue
    if (parsed.type === '*') continue
    nsids.add(parsed.type)
  }
  return nsids
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
  this: Map<string, LexiconPermissionSet>,
  includeScope: IncludeScope,
): string[] {
  const permissionSet = this.get(includeScope.nsid)
  if (permissionSet) return includeScope.toScopes(permissionSet)

  // Should never happen (mostly there for type safety & future proofing)
  throw new Error(`Missing permission set for NSID: ${includeScope.nsid}`)
}
