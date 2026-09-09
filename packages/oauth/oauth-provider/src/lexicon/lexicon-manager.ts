import type { LexiconPermissionSet, LexiconSpace } from '@atproto/lex-document'
import { type LexResolver, LexResolverError } from '@atproto/lex-resolver'
import { IncludeScope, SpacePermission } from '@atproto/oauth-scopes'
import type { DidString, NsidString } from '@atproto/syntax'
import { LexiconGetter } from './lexicon-getter.js'
import type { LexiconStore } from './lexicon-store.js'

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

  public async getSpacesFromScope(
    scope?: string,
  ): Promise<Map<NsidString, LexiconSpace>> {
    const { includeScopes, otherScopes } = parseScope(scope)

    const concreteScopes = includeScopes.length
      ? Array.from(includeScopes)
          .flatMap(
            nsidToPermissionScopes,
            await this.extractPermissionSets(includeScopes),
          )
          .concat(otherScopes)
      : otherScopes

    return this.getSpaces(extractSpaceTypeNsids(concreteScopes))
  }

  /**
   * Transforms a scope string from an authorization request into a scope
   * composed solely of granular permission scopes, transforming any NSID
   * into its corresponding permission scopes.
   */
  public async buildTokenScope(
    scope: string,
    userDid: DidString,
  ): Promise<string> {
    const { includeScopes, otherScopes } = parseScope(scope)

    const concreteScopes = includeScopes.length
      ? Array.from(includeScopes)
          .flatMap(
            nsidToPermissionScopes,
            await this.extractPermissionSets(includeScopes),
          )
          .concat(otherScopes)
      : otherScopes

    // The runtime matcher is context-free, so anything needing a lexicon lookup
    // or the granting user's identity has to be resolved here, at issuance.
    const expanded = await this.expandSpaceCollections(concreteScopes)
    const resolved = expanded.map((value) =>
      resolveSpaceSelfAuthority(value, userDid),
    )

    return resolved.join(' ')
  }

  /**
   * Rewrites bare `space:<type>` scopes to carry the type's declared
   * collections. Throws when a declaration cannot be resolved: passing the
   * scope through unchanged would mint a token with no write targets at all,
   * which is a narrower grant than the user consented to.
   */
  protected async expandSpaceCollections(
    scopes: readonly string[],
  ): Promise<string[]> {
    const nsids = new Set<NsidString>()
    for (const value of scopes) {
      const parsed = SpacePermission.fromString(value)
      if (parsed && parsed.type !== '*' && !parsed.hasCollections) {
        nsids.add(parsed.type)
      }
    }
    if (nsids.size === 0) return scopes.slice()

    const spaces = await this.getSpaces(nsids)

    return scopes.map((value) => {
      const parsed = SpacePermission.fromString(value)
      if (!parsed || parsed.type === '*' || parsed.hasCollections) return value
      const space = spaces.get(parsed.type)
      if (!space?.collections?.length) return value
      return parsed.withDefaultCollections(space.collections).toString()
    })
  }

  /**
   * Given a list of scope values, extract those that are NSIDs and return their
   * corresponding permission sets.
   */
  protected async extractPermissionSets(includeScopes: IncludeScope[]) {
    const nsids = extractNsids(includeScopes)
    return this.getPermissionSets(nsids)
  }

  protected async getPermissionSets(nsids: Set<NsidString>) {
    return new Map<string, LexiconPermissionSet>(
      await Promise.all(Array.from(nsids, this.getPermissionSetEntry, this)),
    )
  }

  protected async getPermissionSetEntry(
    nsid: NsidString,
  ): Promise<[nsid: NsidString, permissionSet: LexiconPermissionSet]> {
    const permissionSet = await this.getPermissionSet(nsid)
    return [nsid, permissionSet]
  }

  protected async getPermissionSet(
    nsid: NsidString,
  ): Promise<LexiconPermissionSet> {
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

  protected async getSpaces(
    nsids: Iterable<NsidString>,
  ): Promise<Map<NsidString, LexiconSpace>> {
    return new Map<NsidString, LexiconSpace>(
      await Promise.all(Array.from(nsids, this.getSpaceEntry, this)),
    )
  }

  protected async getSpaceEntry(
    nsid: NsidString,
  ): Promise<[nsid: NsidString, space: LexiconSpace]> {
    const space = await this.getSpace(nsid)
    return [nsid, space]
  }

  protected async getSpace(nsid: NsidString): Promise<LexiconSpace> {
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

function resolveSpaceSelfAuthority(value: string, userDid: DidString): string {
  const parsed = SpacePermission.fromString(value)
  if (!parsed?.isSelfAuthority) return value
  return parsed.withResolvedAuthority(userDid).toString()
}

function extractSpaceTypeNsids(scopes: readonly string[]): Set<NsidString> {
  const nsids = new Set<NsidString>()
  for (const value of scopes) {
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

function extractNsids(includeScopes: IncludeScope[]): Set<NsidString> {
  return new Set(Array.from(includeScopes, extractNsid))
}

function extractNsid(nsidScope: IncludeScope): NsidString {
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
