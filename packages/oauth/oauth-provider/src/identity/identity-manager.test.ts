import { describe, expect, it, vi } from 'vitest'
import type { Did, DidDocument, DidResolver } from '@atproto-labs/did-resolver'
import type {
  HandleResolver,
  ResolvedHandle,
} from '@atproto-labs/handle-resolver-node'
import { IdentityManager } from './identity-manager.js'

const DID = 'did:plc:abc123'
const OTHER_DID = 'did:plc:other456'
const HANDLE = 'protocol-nerds.atmoboards.com'

const scopeFor = (authority: string) =>
  `space:com.atmoboards.forum?authority=${authority}`

function setup({
  didDocs = {},
  handles = {},
}: {
  /** The handle each DID's document claims, or null for none. */
  didDocs?: Record<string, string | null>
  /** The DID each handle resolves to. */
  handles?: Record<string, ResolvedHandle>
} = {}) {
  const didResolver = {
    resolve: vi.fn(async (did: Did): Promise<DidDocument> => {
      const handle = didDocs[did]
      if (handle === undefined) throw new Error(`Unknown DID: ${did}`)
      return { id: did, alsoKnownAs: handle ? [`at://${handle}`] : [] }
    }),
  }

  const handleResolver = {
    resolve: vi.fn(async (handle: string) => handles[handle] ?? null),
  } satisfies HandleResolver

  const manager = new IdentityManager(
    didResolver as unknown as DidResolver<'plc' | 'web'>,
    handleResolver,
  )

  return { manager, didResolver }
}

describe(IdentityManager, () => {
  describe('getSpaceHandlesFromScope', () => {
    it('resolves a space authority DID to its verified handle', async () => {
      const { manager } = setup({
        didDocs: { [DID]: HANDLE },
        handles: { [HANDLE]: DID },
      })
      await expect(
        manager.getSpaceHandlesFromScope(scopeFor(DID)),
      ).resolves.toEqual(new Map([[DID, HANDLE]]))
    })

    it('omits a handle that does not resolve back to its DID, reporting it to onError', async () => {
      const { manager } = setup({
        didDocs: { [DID]: HANDLE, [OTHER_DID]: HANDLE },
        handles: { [HANDLE]: DID },
      })
      const onError = vi.fn()

      const handles = await manager.getSpaceHandlesFromScope(
        `${scopeFor(DID)} ${scopeFor(OTHER_DID)}`,
        { onError },
      )

      expect(handles).toEqual(new Map([[DID, HANDLE]]))
      expect(onError).toHaveBeenCalledExactlyOnceWith(
        OTHER_DID,
        new Error('Handle does not resolve to the same DID'),
      )
    })

    it('omits a DID whose document claims no handle, reporting it to onError', async () => {
      const { manager } = setup({ didDocs: { [DID]: null } })
      const onError = vi.fn()

      const handles = await manager.getSpaceHandlesFromScope(scopeFor(DID), {
        onError,
      })

      expect(handles.size).toBe(0)
      expect(onError).toHaveBeenCalledExactlyOnceWith(
        DID,
        new Error(`DID document does not claim a valid handle: ${DID}`),
      )
    })

    it('rethrows resolution errors by default', async () => {
      const { manager, didResolver } = setup()
      const error = new Error('network down')
      didResolver.resolve.mockRejectedValueOnce(error)

      await expect(
        manager.getSpaceHandlesFromScope(scopeFor(DID)),
      ).rejects.toBe(error)
    })

    it('does not resolve wildcard or self authorities', async () => {
      const { manager, didResolver } = setup()

      const handles = await manager.getSpaceHandlesFromScope(
        `${scopeFor('*')} space:com.example.group`,
      )

      expect(handles.size).toBe(0)
      expect(didResolver.resolve).not.toHaveBeenCalled()
    })

    it('returns nothing when the scope names no space authority', async () => {
      const { manager } = setup()
      expect((await manager.getSpaceHandlesFromScope()).size).toBe(0)
      expect(
        (
          await manager.getSpaceHandlesFromScope(
            'atproto repo:app.bsky.feed.post',
          )
        ).size,
      ).toBe(0)
    })

    it('resolves authorities named by included permission sets', async () => {
      const { manager } = setup({
        didDocs: { [DID]: HANDLE },
        handles: { [HANDLE]: DID },
      })
      const permissionSets = new Map([
        [
          'com.atmoboards.basePermissions',
          {
            type: 'permission-set' as const,
            permissions: [
              {
                type: 'permission' as const,
                resource: 'space',
                spaceType: 'com.atmoboards.forum',
                authority: DID,
              },
            ],
          },
        ],
      ])

      await expect(
        manager.getSpaceHandlesFromScope(
          'atproto include:com.atmoboards.basePermissions',
          { permissionSets },
        ),
      ).resolves.toEqual(new Map([[DID, HANDLE]]))
    })

    it('resolves each authority once', async () => {
      const { manager, didResolver } = setup({
        didDocs: { [DID]: HANDLE },
        handles: { [HANDLE]: DID },
      })

      await manager.getSpaceHandlesFromScope(
        `${scopeFor(DID)} space:com.example.group?authority=${DID}`,
      )

      expect(didResolver.resolve).toHaveBeenCalledTimes(1)
    })
  })
})
