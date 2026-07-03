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
  public async buildTokenScope(
    scope: string,
    userDid: string,
  ): Promise<string> {
    const { includeScopes, otherScopes } = parseScope(scope)

    // 1. Expand any "include:<nsid>" permission-set scopes into concrete scopes.
    const concreteScopes = includeScopes.length
      ? Array.from(includeScopes)
          .flatMap(
            nsidToPermissionScopes,
            await this.extractPermissionSets(includeScopes),
          )
          .concat(otherScopes)
      : otherScopes

    // 2. Default `collection` on bare `space:<type>` grants to the space type's
    //    declared collections. The runtime matcher is context-free, so this
    //    resolution-at-issuance step is where declared collections are
    //    materialized (mirrors how include: scopes are expanded above).
    const expanded = await this.expandSpaceCollections(concreteScopes)

    // 3. Resolve `authority=self` on `space:` grants to the granting user's DID
    //    — likewise at issuance, since the matcher can't resolve `self` itself.
    const resolved = expanded.map((value) =>
      resolveSpaceSelfAuthority(value, userDid),
    )

    return resolved.join(' ')
  }

  /**
   * Rewrites `space:<concreteType>` scopes that omit `collection` to carry the
   * space type's declared collections. Scopes that already name collections
   * (including `*`), wildcard-type scopes, and non-space scopes pass through
   * unchanged. Declaration-resolution failures leave the scope untouched.
   */
  protected async expandSpaceCollections(
    scopes: readonly string[],
  ): Promise<string[]> {
    // Collect the concrete space types that need a declaration lookup.
    const nsids = new Set<Nsid>()
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

/**
 * Resolve `authority=self` on a `space:` scope to the granting user's DID. Any
 * non-space scope, or a space scope naming a concrete authority or `*`, passes
 * through unchanged.
 */
function resolveSpaceSelfAuthority(value: string, userDid: string): string {
  const parsed = SpacePermission.fromString(value)
  if (!parsed?.isSelfAuthority) return value
  return parsed
    .withResolvedAuthority(userDid as `did:${string}:${string}`)
    .toString()
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
