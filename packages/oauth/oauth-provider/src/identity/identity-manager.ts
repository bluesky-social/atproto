import type { DidString } from '@atproto/oauth-provider-api'
import { SpacePermission } from '@atproto/oauth-scopes'
import { type HandleString, isValidHandle } from '@atproto/syntax'
import type { DidResolver } from '@atproto-labs/did-resolver'
import { extractAtprotoData } from '@atproto-labs/did-resolver'
import type { HandleResolver } from '@atproto-labs/handle-resolver'

/**
 * Resolves the space-authority DIDs named in `space:` scopes to handles, so the
 * consent screen can say "spaces on protocol-nerds.atmoboards.com" rather than
 * "spaces on did:plc:abc...". A DID that fails verification is omitted and the
 * screen renders the raw DID instead.
 */
export class IdentityManager {
  constructor(
    protected readonly didResolver: DidResolver<'plc' | 'web'>,
    protected readonly handleResolver: HandleResolver,
  ) {}

  public async getSpaceHandlesFromScope(
    scope?: string,
    {
      onError = (did, error) => {
        throw error
      },
    }: {
      onError?: (did: DidString, error: unknown) => void
    } = {},
  ): Promise<Map<DidString, HandleString>> {
    const map = new Map<DidString, HandleString>()

    const dids = extractSpaceDids(scope)
    if (dids.size === 0) return map

    // @TODO we don't want to resolve more than a handful of DIDs at once, so we
    // resolve them sequentially. We should replace this with a
    // concurrency-limited queue.
    for (const did of dids) {
      try {
        const handle = await this.resolveVerifiedHandle(did)
        map.set(did, handle)
      } catch (error) {
        onError(did, error)
      }
    }

    return map
  }

  /**
   * A handle is only trustworthy if it round-trips: the DID doc claims it, and
   * resolving it independently returns the same DID.
   */
  protected async resolveVerifiedHandle(did: DidString): Promise<HandleString> {
    const doc = await this.didResolver.resolve(did)
    if (!doc) {
      throw new Error(`DID not found: ${did}`)
    }

    const { aka } = extractAtprotoData(doc)
    if (!aka || !isValidHandle(aka)) {
      throw new Error(`DID document does not claim a valid handle: ${did}`)
    }

    const resolvedDid = await this.handleResolver.resolve(aka)
    if (resolvedDid !== did) {
      throw new Error('Handle does not resolve to the same DID')
    }

    return aka
  }
}

function extractSpaceDids(scope?: string): Set<DidString> {
  const dids = new Set<DidString>()
  if (!scope) return dids

  for (const value of scope.split(' ')) {
    const parsed = SpacePermission.fromString(value)

    // Invalid scope
    if (!parsed) continue

    // Only include DID authorities
    if (parsed.authority === '*' || parsed.authority === 'self') continue

    dids.add(parsed.authority)
  }

  return dids
}
