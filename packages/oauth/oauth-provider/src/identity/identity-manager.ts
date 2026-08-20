import { type IdResolver, getHandle } from '@atproto/identity'
import { SpacePermission } from '@atproto/oauth-scopes'

/**
 * Resolves the space-authority DIDs named in `space:` scopes to handles, so the
 * consent screen can say "spaces on protocol-nerds.atmoboards.com" rather than
 * "spaces on did:plc:abc...". A DID that fails verification is omitted and the
 * screen renders the raw DID instead.
 */
export class IdentityManager {
  constructor(public readonly idResolver: IdResolver) {}

  public async getSpaceHandlesFromScope(
    scope?: string,
  ): Promise<Map<string, string>> {
    const dids = extractSpaceDids(scope)
    if (dids.size === 0) return new Map()

    const entries = await Promise.all(
      Array.from(dids, async (did) => {
        const handle = await this.resolveVerifiedHandle(did)
        return handle ? ([did, handle] as const) : null
      }),
    )

    return new Map(
      entries.filter((e): e is readonly [string, string] => e !== null),
    )
  }

  /**
   * A handle is only trustworthy if it round-trips: the DID doc claims it, and
   * resolving it independently returns the same DID.
   */
  protected async resolveVerifiedHandle(
    did: string,
  ): Promise<string | undefined> {
    try {
      const doc = await this.idResolver.did.resolve(did)
      if (!doc) return undefined
      const handle = getHandle(doc)
      if (!handle) return undefined

      const resolvedDid = await this.idResolver.handle.resolve(handle)
      if (resolvedDid !== did) return undefined

      return handle
    } catch {
      return undefined
    }
  }
}

function extractSpaceDids(scope?: string): Set<string> {
  const dids = new Set<string>()
  if (!scope) return dids
  for (const value of scope.split(' ')) {
    const parsed = SpacePermission.fromString(value)
    if (!parsed) continue
    // `*` and `self` name no concrete authority to resolve to a handle.
    if (parsed.authority === '*' || parsed.authority === 'self') continue
    dids.add(parsed.authority)
  }
  return dids
}
