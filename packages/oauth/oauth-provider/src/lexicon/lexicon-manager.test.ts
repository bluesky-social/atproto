import { describe, expect, it, vi } from 'vitest'
import type {
  LexiconDocument,
  LexiconPermissionSet,
  LexiconSpace,
} from '@atproto/lex-document'
import {
  type LexResolver,
  LexResolverError,
  type LexResolverResult,
} from '@atproto/lex-resolver'
import { AtUri, NSID, type NsidString } from '@atproto/syntax'
import { LexiconManager } from './lexicon-manager.js'
import type { LexiconData, LexiconStore } from './lexicon-store.js'

const USER_DID = 'did:plc:user123'
const OWNER_DID = 'did:plc:owner456'

const FORUM = 'com.atmoboards.forum'
const GROUP = 'com.atmoboards.group'
const BUNDLE = 'com.atmoboards.bundle'
const THREAD = 'com.atmoboards.thread'
const REPLY = 'com.atmoboards.reply'

const space = (collections: NsidString[]): LexiconSpace => ({
  type: 'space',
  key: 'any',
  title: 'Forum',
  collections,
})

const permissionSet = (
  permissions: LexiconPermissionSet['permissions'],
): LexiconPermissionSet => ({ type: 'permission-set', permissions })

/** A manager whose resolver serves `mains` as the main def of each NSID. */
function setup(mains: Record<string, LexiconSpace | LexiconPermissionSet>) {
  const lexicons = new Map<string, LexiconData>()
  const store: LexiconStore = {
    findLexicon: (nsid) => lexicons.get(nsid) ?? null,
    storeLexicon: (nsid, data) => void lexicons.set(nsid, data),
    deleteLexicon: (nsid) => void lexicons.delete(nsid),
  }

  const lexResolver = {
    get: vi.fn(async (nsidStr: NSID | string) => {
      const nsid = NSID.from(nsidStr)
      const main = mains[nsid.toString()]
      if (!main) throw new LexResolverError(nsid)
      const lexicon: LexiconDocument = {
        lexicon: 1,
        id: nsid.toString(),
        defs: { main },
      }
      const uri = AtUri.make(OWNER_DID, 'com.atproto.lexicon.schema', nsid)
      return { uri, lexicon } as LexResolverResult
    }),
  }

  const manager = new LexiconManager(
    store,
    lexResolver as unknown as LexResolver,
  )

  return { manager, lexResolver }
}

describe('LexiconManager', () => {
  describe('getSpacesFromScope', () => {
    it('returns the declaration for each space type named', async () => {
      const { manager } = setup({
        [FORUM]: space([THREAD, REPLY]),
        [GROUP]: space([]),
      })
      const spaces = await manager.getSpacesFromScope(
        `space:${FORUM}?authority=${OWNER_DID} space:${GROUP}`,
      )
      expect(spaces).toEqual(
        new Map([
          [FORUM, space([THREAD, REPLY])],
          [GROUP, space([])],
        ]),
      )
    })

    it('returns declarations for space types reached through a permission set', async () => {
      const { manager } = setup({
        [FORUM]: space([THREAD, REPLY]),
        [BUNDLE]: permissionSet([
          { type: 'permission', resource: 'space', spaceType: FORUM },
        ]),
      })
      const spaces = await manager.getSpacesFromScope(`include:${BUNDLE}`)
      expect(spaces).toEqual(new Map([[FORUM, space([THREAD, REPLY])]]))
    })

    it('skips a wildcard space type', async () => {
      const { manager, lexResolver } = setup({})
      const spaces = await manager.getSpacesFromScope('space:*?authority=*')
      expect(spaces.size).toBe(0)
      expect(lexResolver.get).not.toHaveBeenCalled()
    })

    it('returns nothing for a scope with no space grants', async () => {
      const { manager } = setup({})
      expect((await manager.getSpacesFromScope()).size).toBe(0)
      expect((await manager.getSpacesFromScope('atproto')).size).toBe(0)
    })
  })

  describe('buildTokenScope', () => {
    it('materializes declared collections into a bare grant', async () => {
      const { manager } = setup({ [FORUM]: space([THREAD, REPLY]) })
      await expect(
        manager.buildTokenScope(
          `space:${FORUM}?authority=${OWNER_DID}`,
          USER_DID,
        ),
      ).resolves.toBe(
        `space:${FORUM}?authority=${OWNER_DID}&collection=${REPLY}&collection=${THREAD}`,
      )
    })

    it('materializes collections for a space permission reached through a permission set', async () => {
      const { manager } = setup({
        [FORUM]: space([THREAD]),
        [BUNDLE]: permissionSet([
          { type: 'permission', resource: 'space', spaceType: FORUM },
        ]),
      })
      await expect(
        manager.buildTokenScope(`include:${BUNDLE}`, USER_DID),
      ).resolves.toBe(
        `space:${FORUM}?authority=${USER_DID}&collection=${THREAD}`,
      )
    })

    it('does not look up a grant that already names collections', async () => {
      // Expanding it would widen the grant beyond what the user consented to.
      const { manager, lexResolver } = setup({})
      const scope = `space:${FORUM}?authority=${OWNER_DID}&collection=${THREAD}`
      await expect(manager.buildTokenScope(scope, USER_DID)).resolves.toBe(
        scope,
      )
      expect(lexResolver.get).not.toHaveBeenCalled()
    })

    it('does not look up a wildcard space type', async () => {
      const { manager, lexResolver } = setup({})
      const scope = `space:*?authority=${OWNER_DID}`
      await expect(manager.buildTokenScope(scope, USER_DID)).resolves.toBe(
        scope,
      )
      expect(lexResolver.get).not.toHaveBeenCalled()
    })

    it('leaves a bare grant alone when the space declares no collections', async () => {
      const { manager } = setup({ [FORUM]: space([]) })
      const scope = `space:${FORUM}?authority=${OWNER_DID}`
      await expect(manager.buildTokenScope(scope, USER_DID)).resolves.toBe(
        scope,
      )
    })

    it('throws when a space type cannot be resolved', async () => {
      // Passing the grant through bare would issue a token with no write
      // targets, narrower than the grant the user consented to.
      const { manager } = setup({})
      await expect(
        manager.buildTokenScope(
          `space:${FORUM}?authority=${OWNER_DID}`,
          USER_DID,
        ),
      ).rejects.toThrow(new LexResolverError(FORUM))
    })

    it('throws when the resolved document is not a space', async () => {
      const { manager } = setup({ [BUNDLE]: permissionSet([]) })
      await expect(
        manager.buildTokenScope(
          `space:${BUNDLE}?authority=${OWNER_DID}`,
          USER_DID,
        ),
      ).rejects.toThrow(
        new LexResolverError(BUNDLE, 'Lexicon document is not a space'),
      )
    })

    it('resolves a self authority to the granting user', async () => {
      const { manager } = setup({ [FORUM]: space([THREAD]) })
      await expect(
        manager.buildTokenScope(`space:${FORUM}`, USER_DID),
      ).resolves.toBe(
        `space:${FORUM}?authority=${USER_DID}&collection=${THREAD}`,
      )
    })

    it('expands each space grant in place, leaving other scopes untouched', async () => {
      const { manager } = setup({
        [FORUM]: space([THREAD]),
        [GROUP]: space([REPLY]),
      })
      const scope = await manager.buildTokenScope(
        [
          'atproto',
          `space:${FORUM}?authority=${OWNER_DID}`,
          'repo:app.bsky.feed.post',
          `space:${GROUP}?authority=${OWNER_DID}`,
        ].join(' '),
        USER_DID,
      )
      expect(scope.split(' ')).toEqual([
        'atproto',
        `space:${FORUM}?authority=${OWNER_DID}&collection=${THREAD}`,
        'repo:app.bsky.feed.post',
        `space:${GROUP}?authority=${OWNER_DID}&collection=${REPLY}`,
      ])
    })
  })
})
