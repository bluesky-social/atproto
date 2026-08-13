import { describe, expect, it } from 'vitest'
import { LexResolverError } from '@atproto/lex-resolver'
import { LexiconManager } from './lexicon-manager.js'

const USER_DID = 'did:plc:user123'
const OWNER_DID = 'did:plc:owner456'

type SpaceDef = {
  type: 'space'
  key: string
  name: string
  collections: string[]
}

type PermissionSetDef = {
  type: 'permission-set'
  title: string
  detail: string
  permissions: Array<Record<string, unknown>>
}

type Doc = SpaceDef | PermissionSetDef

/**
 * A manager over fixed lexicon documents.
 *
 * `lexiconGetter` is protected, so subclassing is the seam: it avoids standing up
 * a store and a resolver, and keeps the real `buildTokenScope` /
 * `expandSpaceCollections` logic under test.
 */
class TestLexiconManager extends LexiconManager {
  constructor(private docs: Record<string, Doc | undefined>) {
    super(null as never, null as never)
    // @ts-expect-error replacing the protected getter with a fixed lookup
    this.lexiconGetter = {
      get: async (nsid: string) => {
        const main = this.docs[nsid]
        if (!main) return { lexicon: null }
        return { lexicon: { defs: { main } } }
      },
    }
  }
}

const space = (collections: string[]): SpaceDef => ({
  type: 'space',
  key: 'any',
  name: 'Test Space',
  collections,
})

const FORUM = 'com.atmoboards.forum'
const THREAD = 'com.atmoboards.thread'
const REPLY = 'com.atmoboards.reply'
const BUNDLE = 'com.atmoboards.bundle'

describe('LexiconManager', () => {
  describe('getSpacesFromScope', () => {
    // What the consent screen renders from. It has to cover every space
    // permission the token will end up carrying, or the screen describes a
    // narrower grant than the one being authorized.
    it('resolves a space type named directly', async () => {
      const manager = new TestLexiconManager({ [FORUM]: space([THREAD]) })
      const spaces = await manager.getSpacesFromScope(`space:${FORUM}`)
      expect(spaces.get(FORUM)).toMatchObject({ collections: [THREAD] })
    })

    it('resolves a space type reached through a permission set', async () => {
      // `buildTokenScope` expands this include into a space permission and fills
      // in the declared collections. Without the same expansion here the screen
      // shows neither the space's name nor the writes it is about to grant.
      const manager = new TestLexiconManager({
        [FORUM]: space([THREAD, REPLY]),
        [BUNDLE]: {
          type: 'permission-set',
          title: 'AtmoBoards',
          detail: 'Read and post in your AtmoBoards forums',
          permissions: [
            {
              type: 'permission',
              resource: 'space',
              spaceType: FORUM,
              authority: '*',
            },
          ],
        },
      })

      const spaces = await manager.getSpacesFromScope(`include:${BUNDLE}`)
      expect(spaces.get(FORUM)).toMatchObject({ collections: [THREAD, REPLY] })
    })

    it('does not resolve a wildcard space type', async () => {
      const manager = new TestLexiconManager({})
      const spaces = await manager.getSpacesFromScope('space:*?authority=*')
      expect(spaces.size).toBe(0)
    })
  })

  describe('buildTokenScope — space collections', () => {
    it('materializes the declared collections into a bare grant', async () => {
      // A bare `space:<type>` names no collections, so on its own it would confer
      // no write targets at all. The type's own declaration is what the user is
      // consenting to, so it's resolved here, at issuance.
      const manager = new TestLexiconManager({
        [FORUM]: space([THREAD, REPLY]),
      })
      const scope = await manager.buildTokenScope(
        `space:${FORUM}?authority=${OWNER_DID}`,
        USER_DID,
      )
      // Collections come back in the scope's own canonical (sorted) order rather
      // than the order the lexicon declared them, so compare as a set.
      const params = new URLSearchParams(scope.split('?')[1])
      expect(params.getAll('collection').sort()).toEqual([REPLY, THREAD].sort())
      expect(params.get('authority')).toBe(OWNER_DID)
    })

    it('leaves a grant that already names collections alone', async () => {
      // The app asked for something narrower than the declaration. Widening it
      // would grant more than the user saw on the consent screen.
      const manager = new TestLexiconManager({
        [FORUM]: space([THREAD, REPLY]),
      })
      const scope = await manager.buildTokenScope(
        `space:${FORUM}?authority=${OWNER_DID}&collection=${THREAD}`,
        USER_DID,
      )
      expect(scope).toBe(
        `space:${FORUM}?authority=${OWNER_DID}&collection=${THREAD}`,
      )
    })

    it('leaves a collection=* grant alone', async () => {
      const manager = new TestLexiconManager({ [FORUM]: space([THREAD]) })
      const scope = await manager.buildTokenScope(
        `space:${FORUM}?authority=${OWNER_DID}&collection=*`,
        USER_DID,
      )
      expect(scope).toBe(`space:${FORUM}?authority=${OWNER_DID}&collection=*`)
    })

    it('does not resolve a wildcard space type', async () => {
      // `space:*` names no one type, so there is no declaration to expand from.
      const manager = new TestLexiconManager({})
      const scope = await manager.buildTokenScope(
        `space:*?authority=${OWNER_DID}`,
        USER_DID,
      )
      expect(scope).toBe(`space:*?authority=${OWNER_DID}`)
    })

    it('throws when a space type cannot be resolved', async () => {
      // Deliberately not a pass-through: a scope left bare would mint a token with
      // no write targets, which is a *narrower* grant than the user consented to.
      // Failing the request is the honest outcome.
      const manager = new TestLexiconManager({})
      await expect(
        manager.buildTokenScope(
          `space:${FORUM}?authority=${OWNER_DID}`,
          USER_DID,
        ),
      ).rejects.toThrow(LexResolverError)
    })

    it('throws when the resolved document is not a space', async () => {
      const manager = new TestLexiconManager({
        [FORUM]: { type: 'record' } as unknown as SpaceDef,
      })
      await expect(
        manager.buildTokenScope(
          `space:${FORUM}?authority=${OWNER_DID}`,
          USER_DID,
        ),
      ).rejects.toThrow(/not a space/)
    })

    it('leaves a bare grant alone when the space declares no collections', async () => {
      // Resolvable, but with nothing to expand to. A read-only space type is a
      // legitimate thing to declare, so this is not an error.
      const manager = new TestLexiconManager({ [FORUM]: space([]) })
      const scope = await manager.buildTokenScope(
        `space:${FORUM}?authority=${OWNER_DID}`,
        USER_DID,
      )
      expect(scope).toBe(`space:${FORUM}?authority=${OWNER_DID}`)
    })
  })

  describe('buildTokenScope — self authority', () => {
    it('resolves a bare grant authority to the granting user', async () => {
      // `authority` defaults to `self`, meaning "spaces I own". The runtime matcher
      // is context-free, so the user's identity has to be baked in at issuance;
      // an unresolved `self` matches nothing.
      const manager = new TestLexiconManager({ [FORUM]: space([THREAD]) })
      const scope = await manager.buildTokenScope(`space:${FORUM}`, USER_DID)
      expect(scope).toBe(
        `space:${FORUM}?authority=${USER_DID}&collection=${THREAD}`,
      )
    })

    it('leaves a concrete authority alone', async () => {
      const manager = new TestLexiconManager({ [FORUM]: space([THREAD]) })
      const scope = await manager.buildTokenScope(
        `space:${FORUM}?authority=${OWNER_DID}&collection=*`,
        USER_DID,
      )
      expect(scope).toContain(`authority=${OWNER_DID}`)
      expect(scope).not.toContain(USER_DID)
    })

    it('leaves a wildcard authority alone', async () => {
      const manager = new TestLexiconManager({ [FORUM]: space([THREAD]) })
      const scope = await manager.buildTokenScope(
        `space:${FORUM}?authority=*&collection=*`,
        USER_DID,
      )
      expect(scope).toBe(`space:${FORUM}?authority=*&collection=*`)
    })
  })

  describe('buildTokenScope — other scopes', () => {
    it('passes non-space scopes through untouched', async () => {
      const manager = new TestLexiconManager({})
      const scope = await manager.buildTokenScope(
        'atproto repo:app.bsky.feed.post account:email',
        USER_DID,
      )
      expect(scope).toBe('atproto repo:app.bsky.feed.post account:email')
    })

    it('expands a space grant alongside unrelated scopes', async () => {
      const manager = new TestLexiconManager({ [FORUM]: space([THREAD]) })
      const scope = await manager.buildTokenScope(
        `atproto space:${FORUM}?authority=${OWNER_DID}`,
        USER_DID,
      )
      expect(scope.split(' ')).toEqual([
        'atproto',
        `space:${FORUM}?authority=${OWNER_DID}&collection=${THREAD}`,
      ])
    })

    it('expands several space grants independently', async () => {
      const OTHER = 'com.example.group'
      const manager = new TestLexiconManager({
        [FORUM]: space([THREAD]),
        [OTHER]: space([REPLY]),
      })
      const scope = await manager.buildTokenScope(
        `space:${FORUM}?authority=${OWNER_DID} space:${OTHER}?authority=${OWNER_DID}`,
        USER_DID,
      )
      expect(scope).toBe(
        [
          `space:${FORUM}?authority=${OWNER_DID}&collection=${THREAD}`,
          `space:${OTHER}?authority=${OWNER_DID}&collection=${REPLY}`,
        ].join(' '),
      )
    })
  })

  describe('getSpacesFromScope', () => {
    it('returns the declaration for each space type named', async () => {
      // What the consent screen renders from: the human-readable name and the
      // collections an app is asking to write.
      const manager = new TestLexiconManager({
        [FORUM]: space([THREAD, REPLY]),
      })
      const spaces = await manager.getSpacesFromScope(
        `space:${FORUM}?authority=${OWNER_DID}`,
      )
      expect(spaces.get(FORUM)).toMatchObject({
        type: 'space',
        name: 'Test Space',
        collections: [THREAD, REPLY],
      })
    })

    it('skips a wildcard space type', async () => {
      const manager = new TestLexiconManager({})
      const spaces = await manager.getSpacesFromScope(
        `space:*?authority=${OWNER_DID}`,
      )
      expect(spaces.size).toBe(0)
    })

    it('returns nothing for a scope with no space grants', async () => {
      const manager = new TestLexiconManager({})
      expect((await manager.getSpacesFromScope('atproto')).size).toBe(0)
      expect((await manager.getSpacesFromScope()).size).toBe(0)
    })
  })
})
