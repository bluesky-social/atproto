import { IdResolver, getHandle } from '@atproto/identity'
import { SpacePermission } from '@atproto/oauth-scopes'

/**
 * Resolves DIDs referenced from authorization-request scopes to handles, for
 * display on the consent screen.
 *
 * Currently the only use is rendering the community owner of `space:` scopes
 * — e.g. so the consent screen can say "spaces on protocol-nerds.atmoboards.com"
 * instead of "spaces on did:plc:abc...".
 *
 * Resolution is best-effort and bidirectionally verified: a DID's handle is
 * accepted only if it appears in the DID doc's `alsoKnownAs` *and* resolving
 * that handle returns the same DID. Failures (timeouts, mismatches, missing
 * handles) silently drop from the result map; the consent screen falls back
 * to the raw DID, mirroring how lexicon resolution failures are handled.
 */
export class IdentityManager {
  constructor(public readonly idResolver: IdResolver) {}

  /**
   * Extract distinct community-owner DIDs from the request's `space:` scopes
   * and resolve each to a verified handle. DIDs that fail verification are
   * omitted from the result.
   */
  public async getCommunityHandlesFromScope(
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
   * Resolve a DID to its handle, verifying the round-trip:
   *   1. Resolve the DID doc and read `alsoKnownAs`.
   *   2. Resolve that handle back to a DID.
   *   3. Compare — only return the handle if both directions agree.
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
    if (parsed.did === '*') continue
    dids.add(parsed.did)
  }
  return dids
}
