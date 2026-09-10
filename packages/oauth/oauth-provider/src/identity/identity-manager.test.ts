import { describe, expect, it } from 'vitest'
import { IdentityManager } from './identity-manager.js'

const DID = 'did:plc:abc123'
const OTHER_DID = 'did:plc:other456'
const HANDLE = 'protocol-nerds.atmoboards.com'

/**
 * A resolver over fixed data. `didDocs` maps a DID to the handle its document
 * claims; `handles` maps a handle back to a DID, which is what makes the
 * round-trip check meaningful.
 */
const withFakeResolver = (opts: {
  didDocs?: Record<string, string | null>
  handles?: Record<string, string>
  onDidResolve?: (did: string) => void
}) =>
  new IdentityManager(
    {
      async resolve(did: string) {
        opts.onDidResolve?.(did)
        const handle = opts.didDocs?.[did]
        if (handle === undefined) {
          throw new Error('not found')
        }
        return {
          id: did,
          alsoKnownAs: handle ? [`at://${handle}`] : [],
        } as any
      },
    },
    {
      async resolve(handle: string) {
        const did = opts.handles?.[handle]
        if (did === undefined) return null
        return did as any
      },
    },
  )

describe(IdentityManager, () => {
  describe('getSpaceHandlesFromScope', () => {
    it('resolves a space authority DID to its handle', async () => {
      // What the consent screen needs: "spaces on protocol-nerds.atmoboards.com"
      // reads to a person; "spaces on did:plc:abc123" does not.
      const manager = withFakeResolver({
        didDocs: { [DID]: HANDLE },
        handles: { [HANDLE]: DID },
      })
      const handles = await manager.getSpaceHandlesFromScope(
        `space:com.atmoboards.forum?authority=${DID}`,
      )
      expect(handles.get(DID)).toBe(HANDLE)
    })

    it('omits a handle that does not resolve back to the same DID', async () => {
      // A DID document can claim any handle it likes. Only a handle that resolves
      // independently back to that DID is trustworthy — otherwise the screen would
      // name an account the authority does not control.
      const manager = withFakeResolver({
        didDocs: { [DID]: HANDLE },
        handles: { [HANDLE]: OTHER_DID },
      })
      await expect(
        manager.getSpaceHandlesFromScope(
          `space:com.atmoboards.forum?authority=${DID}`,
        ),
      ).rejects.toThrow('Handle does not resolve to the same DID')
    })

    it('omits a handle that resolves to nothing', async () => {
      const manager = withFakeResolver({
        didDocs: { [DID]: HANDLE },
        handles: {},
      })
      await expect(
        manager.getSpaceHandlesFromScope(
          `space:com.atmoboards.forum?authority=${DID}`,
        ),
      ).rejects.toThrow('Handle does not resolve to the same DID')
    })

    it('omits a DID whose document has no handle', async () => {
      const manager = withFakeResolver({ didDocs: { [DID]: null } })
      await expect(
        manager.getSpaceHandlesFromScope(
          `space:com.atmoboards.forum?authority=${DID}`,
        ),
      ).rejects.toThrow(`DID document does not claim a valid handle: ${DID}`)
    })

    it('omits a DID that cannot be resolved', async () => {
      const manager = withFakeResolver({})
      await expect(
        manager.getSpaceHandlesFromScope(
          `space:com.atmoboards.forum?authority=${DID}`,
        ),
      ).rejects.toThrow(`not found`)
    })

    it('survives a resolver that throws', async () => {
      // A failed lookup degrades the screen's wording; it must not fail the
      // authorization request.
      const manager = new IdentityManager(
        {
          resolve: async () => {
            throw new Error('network down')
          },
        },
        { resolve: async () => null },
      )

      await expect(
        manager.getSpaceHandlesFromScope(
          `space:com.atmoboards.forum?authority=${DID}`,
        ),
      ).rejects.toThrow(`network down`)
    })

    it('resolves several authorities at once, keeping only the good ones', async () => {
      const manager = withFakeResolver({
        didDocs: { [DID]: HANDLE, [OTHER_DID]: 'liar.example.com' },
        // Only the first round-trips.
        handles: { [HANDLE]: DID, 'liar.example.com': DID },
      })
      const handles = await manager.getSpaceHandlesFromScope(
        [
          `space:com.atmoboards.forum?authority=${DID}`,
          `space:com.example.group?authority=${OTHER_DID}`,
        ].join(' '),
        {
          onError: () => {
            // noop
          },
        },
      )
      expect(Object.fromEntries(handles)).toEqual({ [DID]: HANDLE })
    })

    it('does not resolve wildcard or self authorities', async () => {
      // Neither names a concrete DID, so there is nothing to look up. Attempting
      // it would mean a pointless resolution on every consent screen.
      const resolved: string[] = []
      const manager = withFakeResolver({
        onDidResolve: (did) => resolved.push(did),
      })
      const handles = await manager.getSpaceHandlesFromScope(
        'space:com.atmoboards.forum?authority=* space:com.example.group',
      )
      expect(handles.size).toBe(0)
      expect(resolved).toEqual([])
    })

    it('ignores non-space scopes', async () => {
      const manager = withFakeResolver({})
      const handles = await manager.getSpaceHandlesFromScope(
        'atproto repo:app.bsky.feed.post rpc:com.example.method?aud=*',
      )
      expect(handles.size).toBe(0)
    })

    it('returns nothing for an absent scope', async () => {
      const manager = withFakeResolver({})
      expect((await manager.getSpaceHandlesFromScope()).size).toBe(0)
      expect((await manager.getSpaceHandlesFromScope('')).size).toBe(0)
    })

    it('deduplicates repeated authorities', async () => {
      const resolved: string[] = []
      const manager = withFakeResolver({
        didDocs: { [DID]: HANDLE },
        handles: { [HANDLE]: DID },
        onDidResolve: (did) => resolved.push(did),
      })
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
