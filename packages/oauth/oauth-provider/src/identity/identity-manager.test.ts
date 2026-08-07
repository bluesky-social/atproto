import { describe, expect, it } from 'vitest'
import { IdResolver } from '@atproto/identity'
import { IdentityManager } from './identity-manager.js'

const DID = 'did:plc:abc123'
const OTHER_DID = 'did:plc:other456'
const HANDLE = 'protocol-nerds.atmoboards.com'

/**
 * A resolver over fixed data. `didDocs` maps a DID to the handle its document
 * claims; `handles` maps a handle back to a DID, which is what makes the
 * round-trip check meaningful.
 */
const fakeResolver = (opts: {
  didDocs?: Record<string, string | null>
  handles?: Record<string, string>
  onDidResolve?: (did: string) => void
}): IdResolver =>
  ({
    did: {
      resolve: async (did: string) => {
        opts.onDidResolve?.(did)
        const handle = opts.didDocs?.[did]
        if (handle === undefined) return null
        return {
          id: did,
          alsoKnownAs: handle ? [`at://${handle}`] : [],
        }
      },
    },
    handle: {
      resolve: async (handle: string) => opts.handles?.[handle],
    },
  }) as unknown as IdResolver

describe('IdentityManager', () => {
  describe('getSpaceHandlesFromScope', () => {
    it('resolves a space authority DID to its handle', async () => {
      // What the consent screen needs: "spaces on protocol-nerds.atmoboards.com"
      // reads to a person; "spaces on did:plc:abc123" does not.
      const manager = new IdentityManager(
        fakeResolver({
          didDocs: { [DID]: HANDLE },
          handles: { [HANDLE]: DID },
        }),
      )
      const handles = await manager.getSpaceHandlesFromScope(
        `space:com.atmoboards.forum?authority=${DID}`,
      )
      expect(handles.get(DID)).toBe(HANDLE)
    })

    it('omits a handle that does not resolve back to the same DID', async () => {
      // A DID document can claim any handle it likes. Only a handle that resolves
      // independently back to that DID is trustworthy — otherwise the screen would
      // name an account the authority does not control.
      const manager = new IdentityManager(
        fakeResolver({
          didDocs: { [DID]: HANDLE },
          handles: { [HANDLE]: OTHER_DID },
        }),
      )
      const handles = await manager.getSpaceHandlesFromScope(
        `space:com.atmoboards.forum?authority=${DID}`,
      )
      // Absent rather than wrong: the caller renders the raw DID instead.
      expect(handles.has(DID)).toBe(false)
    })

    it('omits a handle that resolves to nothing', async () => {
      const manager = new IdentityManager(
        fakeResolver({ didDocs: { [DID]: HANDLE }, handles: {} }),
      )
      const handles = await manager.getSpaceHandlesFromScope(
        `space:com.atmoboards.forum?authority=${DID}`,
      )
      expect(handles.has(DID)).toBe(false)
    })

    it('omits a DID whose document has no handle', async () => {
      const manager = new IdentityManager(
        fakeResolver({ didDocs: { [DID]: null } }),
      )
      const handles = await manager.getSpaceHandlesFromScope(
        `space:com.atmoboards.forum?authority=${DID}`,
      )
      expect(handles.has(DID)).toBe(false)
    })

    it('omits a DID that cannot be resolved', async () => {
      const manager = new IdentityManager(fakeResolver({}))
      const handles = await manager.getSpaceHandlesFromScope(
        `space:com.atmoboards.forum?authority=${DID}`,
      )
      expect(handles.size).toBe(0)
    })

    it('survives a resolver that throws', async () => {
      // A failed lookup degrades the screen's wording; it must not fail the
      // authorization request.
      const manager = new IdentityManager({
        did: {
          resolve: async () => {
            throw new Error('network down')
          },
        },
        handle: { resolve: async () => undefined },
      } as unknown as IdResolver)

      const handles = await manager.getSpaceHandlesFromScope(
        `space:com.atmoboards.forum?authority=${DID}`,
      )
      expect(handles.size).toBe(0)
    })

    it('resolves several authorities at once, keeping only the good ones', async () => {
      const manager = new IdentityManager(
        fakeResolver({
          didDocs: { [DID]: HANDLE, [OTHER_DID]: 'liar.example.com' },
          // Only the first round-trips.
          handles: { [HANDLE]: DID, 'liar.example.com': DID },
        }),
      )
      const handles = await manager.getSpaceHandlesFromScope(
        [
          `space:com.atmoboards.forum?authority=${DID}`,
          `space:com.example.group?authority=${OTHER_DID}`,
        ].join(' '),
      )
      expect(Object.fromEntries(handles)).toEqual({ [DID]: HANDLE })
    })

    it('does not resolve wildcard or self authorities', async () => {
      // Neither names a concrete DID, so there is nothing to look up. Attempting
      // it would mean a pointless resolution on every consent screen.
      const resolved: string[] = []
      const manager = new IdentityManager(
        fakeResolver({ onDidResolve: (did) => resolved.push(did) }),
      )
      const handles = await manager.getSpaceHandlesFromScope(
        'space:com.atmoboards.forum?authority=* space:com.example.group',
      )
      expect(handles.size).toBe(0)
      expect(resolved).toEqual([])
    })

    it('ignores non-space scopes', async () => {
      const manager = new IdentityManager(fakeResolver({}))
      const handles = await manager.getSpaceHandlesFromScope(
        'atproto repo:app.bsky.feed.post rpc:com.example.method?aud=*',
      )
      expect(handles.size).toBe(0)
    })

    it('returns nothing for an absent scope', async () => {
      const manager = new IdentityManager(fakeResolver({}))
      expect((await manager.getSpaceHandlesFromScope()).size).toBe(0)
      expect((await manager.getSpaceHandlesFromScope('')).size).toBe(0)
    })

    it('deduplicates repeated authorities', async () => {
      const resolved: string[] = []
      const manager = new IdentityManager(
        fakeResolver({
          didDocs: { [DID]: HANDLE },
          handles: { [HANDLE]: DID },
          onDidResolve: (did) => resolved.push(did),
        }),
      )
      await manager.getSpaceHandlesFromScope(
        [
          `space:com.atmoboards.forum?authority=${DID}`,
          `space:com.example.group?authority=${DID}`,
        ].join(' '),
      )
      expect(resolved).toEqual([DID])
    })
  })
})
