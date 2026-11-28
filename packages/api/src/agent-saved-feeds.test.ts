import { beforeEach, describe, expect, it } from 'vitest'
import { TID } from '@atproto/common-web'
import { preferencesStore } from './_xrpc-fetch.test.js'
import type { Agent } from './agent.js'
import { AppBskyActorDefs } from './client/index.js'

describe('Agent saved feeds', () => {
  describe(`saved feeds v2`, () => {
    let agent: Agent
    let i = 0
    const feedUri = () => `at://bob.com/app.bsky.feed.generator/${i++}`
    const listUri = () => `at://bob.com/app.bsky.graph.list/${i++}`

    beforeEach(() => {
      agent = preferencesStore().agent
    })

    describe(`addSavedFeeds`, () => {
      it('works', async () => {
        const feed = {
          type: 'feed',
          value: feedUri(),
          pinned: false,
        }
        await agent.addSavedFeeds([feed])
        const prefs = await agent.getPreferences()
        expect(prefs.savedFeeds).toStrictEqual([
          {
            ...feed,
            id: expect.any(String),
          },
        ])
      })

      it('throws if feed is specified and list provided', async () => {
        const list = listUri()
        await expect(() =>
          agent.addSavedFeeds([
            {
              type: 'feed',
              value: list,
              pinned: true,
            },
          ]),
        ).rejects.toThrow()
      })

      it('throws if list is specified and feed provided', async () => {
        const feed = feedUri()
        await expect(() =>
          agent.addSavedFeeds([
            {
              type: 'list',
              value: feed,
              pinned: true,
            },
          ]),
        ).rejects.toThrow()
      })

      it(`timeline`, async () => {
        const feeds = await agent.addSavedFeeds([
          {
            type: 'timeline',
            value: 'following',
            pinned: true,
          },
        ])
        const prefs = await agent.getPreferences()
        expect(
          prefs.savedFeeds.filter((f) => f.type === 'timeline'),
        ).toStrictEqual(feeds)
      })

      it(`allows duplicates`, async () => {
        const feed = {
          type: 'feed',
          value: feedUri(),
          pinned: false,
        }
        await agent.addSavedFeeds([feed])
        await agent.addSavedFeeds([feed])
        const prefs = await agent.getPreferences()
        expect(prefs.savedFeeds).toStrictEqual([
          {
            ...feed,
            id: expect.any(String),
          },
          {
            ...feed,
            id: expect.any(String),
          },
        ])
      })

      it(`adds multiple`, async () => {
        const a = {
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        const b = {
          type: 'feed',
          value: feedUri(),
          pinned: false,
        }
        await agent.addSavedFeeds([a, b])
        const prefs = await agent.getPreferences()
        expect(prefs.savedFeeds).toStrictEqual([
          {
            ...a,
            id: expect.any(String),
          },
          {
            ...b,
            id: expect.any(String),
          },
        ])
      })

      it(`appends multiple`, async () => {
        const a = {
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        const b = {
          type: 'feed',
          value: feedUri(),
          pinned: false,
        }
        const c = {
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        const d = {
          type: 'feed',
          value: feedUri(),
          pinned: false,
        }
        await agent.addSavedFeeds([a, b])
        await agent.addSavedFeeds([c, d])
        const prefs = await agent.getPreferences()
        expect(prefs.savedFeeds).toStrictEqual([
          {
            ...a,
            id: expect.any(String),
          },
          {
            ...c,
            id: expect.any(String),
          },
          {
            ...b,
            id: expect.any(String),
          },
          {
            ...d,
            id: expect.any(String),
          },
        ])
      })
    })

    describe(`removeSavedFeeds`, () => {
      it('works', async () => {
        const feed = {
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        const savedFeeds = await agent.addSavedFeeds([feed])
        await agent.removeSavedFeeds([savedFeeds[0].id])
        const prefs = await agent.getPreferences()
        expect(prefs.savedFeeds).toStrictEqual([])
      })
    })

    describe(`overwriteSavedFeeds`, () => {
      it(`dedupes by id, takes last, preserves order based on last found`, async () => {
        const a = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        const b = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        await agent.overwriteSavedFeeds([a, b, a])
        const prefs = await agent.getPreferences()
        expect(prefs.savedFeeds).toStrictEqual([b, a])
      })

      it(`preserves order`, async () => {
        const a = feedUri()
        const b = feedUri()
        const c = feedUri()
        const d = feedUri()

        await agent.overwriteSavedFeeds([
          {
            id: TID.nextStr(),
            type: 'timeline',
            value: a,
            pinned: true,
          },
          {
            id: TID.nextStr(),
            type: 'feed',
            value: b,
            pinned: false,
          },
          {
            id: TID.nextStr(),
            type: 'feed',
            value: c,
            pinned: true,
          },
          {
            id: TID.nextStr(),
            type: 'feed',
            value: d,
            pinned: false,
          },
        ])

        const { savedFeeds } = await agent.getPreferences()
        expect(savedFeeds.filter((f) => f.pinned)).toStrictEqual([
          {
            id: expect.any(String),
            type: 'timeline',
            value: a,
            pinned: true,
          },
          {
            id: expect.any(String),
            type: 'feed',
            value: c,
            pinned: true,
          },
        ])
        expect(savedFeeds.filter((f) => !f.pinned)).toEqual([
          {
            id: expect.any(String),
            type: 'feed',
            value: b,
            pinned: false,
          },
          {
            id: expect.any(String),
            type: 'feed',
            value: d,
            pinned: false,
          },
        ])
      })
    })

    describe(`updateSavedFeeds`, () => {
      it(`updates affect order, saved last, new pins last`, async () => {
        const a = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        const b = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        const c = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }

        await agent.overwriteSavedFeeds([a, b, c])
        await agent.updateSavedFeeds([
          {
            ...b,
            pinned: false,
          },
        ])

        const prefs1 = await agent.getPreferences()
        expect(prefs1.savedFeeds).toStrictEqual([
          a,
          c,
          {
            ...b,
            pinned: false,
          },
        ])

        await agent.updateSavedFeeds([
          {
            ...b,
            pinned: true,
          },
        ])

        const prefs2 = await agent.getPreferences()
        expect(prefs2.savedFeeds).toStrictEqual([a, c, b])
      })

      it(`cannot override original id`, async () => {
        const a = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: true,
        }
        await agent.overwriteSavedFeeds([a])
        await agent.updateSavedFeeds([
          {
            ...a,
            pinned: false,
            id: TID.nextStr(),
          },
        ])
        const prefs = await agent.getPreferences()
        expect(prefs.savedFeeds).toStrictEqual([a])
      })

      it(`updates multiple`, async () => {
        const a = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: false,
        }
        const b = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: false,
        }
        const c = {
          id: TID.nextStr(),
          type: 'feed',
          value: feedUri(),
          pinned: false,
        }

        await agent.overwriteSavedFeeds([a, b, c])
        await agent.updateSavedFeeds([
          {
            ...b,
            pinned: true,
          },
          {
            ...c,
            pinned: true,
          },
        ])

        const prefs1 = await agent.getPreferences()
        expect(prefs1.savedFeeds).toStrictEqual([
          {
            ...b,
            pinned: true,
          },
          {
            ...c,
            pinned: true,
          },
          a,
        ])
      })
    })
  })

  describe(`saved feeds v2: migration scenarios`, () => {
    let agent: Agent
    let i = 0
    const feedUri = () => `at://bob.com/app.bsky.feed.generator/${i++}`

    beforeEach(() => {
      agent = preferencesStore().agent
    })

    it('CRUD action before migration, no timeline inserted', async () => {
      const feed = {
        type: 'feed',
        value: feedUri(),
        pinned: false,
      }
      await agent.addSavedFeeds([feed])
      const prefs = await agent.getPreferences()
      expect(prefs.savedFeeds).toStrictEqual([
        {
          ...feed,
          id: expect.any(String),
        },
      ])
    })

    it('CRUD action AFTER migration, timeline was inserted', async () => {
      await agent.getPreferences()
      const feed = {
        type: 'feed',
        value: feedUri(),
        pinned: false,
      }
      await agent.addSavedFeeds([feed])
      const prefs = await agent.getPreferences()
      expect(prefs.savedFeeds).toStrictEqual([
        {
          id: expect.any(String),
          type: 'timeline',
          value: 'following',
          pinned: true,
        },
        {
          ...feed,
          id: expect.any(String),
        },
      ])
    })

    // fresh account OR an old account with no v1 prefs to migrate from
    it(`brand new user, v1 remains undefined`, async () => {
      const prefs = await agent.getPreferences()
      expect(prefs.savedFeeds).toStrictEqual([
        {
          id: expect.any(String),
          type: 'timeline',
          value: 'following',
          pinned: true,
        },
      ])
      // no v1 prefs to populate from
      expect(prefs.feeds).toStrictEqual({
        saved: undefined,
        pinned: undefined,
      })
    })

    it(`brand new user, v2 does not write to v1`, async () => {
      const a = feedUri()
      // migration happens
      await agent.getPreferences()
      await agent.addSavedFeeds([
        {
          type: 'feed',
          value: a,
          pinned: false,
        },
      ])
      const prefs = await agent.getPreferences()
      expect(prefs.savedFeeds).toStrictEqual([
        {
          id: expect.any(String),
          type: 'timeline',
          value: 'following',
          pinned: true,
        },
        {
          id: expect.any(String),
          type: 'feed',
          value: a,
          pinned: false,
        },
      ])
      // no v1 prefs to populate from
      expect(prefs.feeds).toStrictEqual({
        saved: undefined,
        pinned: undefined,
      })
    })

    it(`existing user with v1 prefs, migrates`, async () => {
      const one = feedUri()
      const two = feedUri()
      await agent.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: [one],
            saved: [one, two],
          },
        ],
      })
      const prefs = await agent.getPreferences()

      // deprecated interface receives what it normally would
      expect(prefs.feeds).toStrictEqual({
        pinned: [one],
        saved: [one, two],
      })
      // new interface gets new timeline + old pinned feed
      expect(prefs.savedFeeds).toStrictEqual([
        {
          id: expect.any(String),
          type: 'timeline',
          value: 'following',
          pinned: true,
        },
        {
          id: expect.any(String),
          type: 'feed',
          value: one,
          pinned: true,
        },
        {
          id: expect.any(String),
          type: 'feed',
          value: two,
          pinned: false,
        },
      ])
    })

    it('squashes duplicates during migration', async () => {
      const one = feedUri()
      const two = feedUri()
      await agent.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: [one, two],
            saved: [one, two],
          },
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: [],
            saved: [],
          },
        ],
      })

      // performs migration
      const prefs = await agent.getPreferences()
      expect(prefs.feeds).toStrictEqual({
        pinned: [],
        saved: [],
      })
      expect(prefs.savedFeeds).toStrictEqual([
        {
          id: expect.any(String),
          type: 'timeline',
          value: 'following',
          pinned: true,
        },
      ])

      const res = await agent.app.bsky.actor.getPreferences()
      expect(res.data.preferences).toStrictEqual([
        {
          $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
          items: [
            {
              id: expect.any(String),
              type: 'timeline',
              value: 'following',
              pinned: true,
            },
          ],
        },
        {
          $type: 'app.bsky.actor.defs#savedFeedsPref',
          pinned: [],
          saved: [],
        },
      ])
    })

    it('v2 writes persist to v1, not the inverse', async () => {
      const a = feedUri()
      const b = feedUri()
      const c = feedUri()
      const d = feedUri()
      const e = feedUri()

      await agent.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: [a, b],
            saved: [a, b],
          },
        ],
      })

      // client updates, migrates to v2
      // a and b are both pinned
      await agent.getPreferences()

      // new write to v2, c is saved
      await agent.addSavedFeeds([
        {
          type: 'feed',
          value: c,
          pinned: false,
        },
      ])

      // v2 write wrote to v1 also
      const res1 = await agent.app.bsky.actor.getPreferences()
      const v1Pref = res1.data.preferences.find((p) =>
        AppBskyActorDefs.isSavedFeedsPref(p),
      )
      expect(v1Pref).toStrictEqual({
        $type: 'app.bsky.actor.defs#savedFeedsPref',
        pinned: [a, b],
        saved: [a, b, c],
      })

      // v1 write occurs, d is added but not to v2
      await agent.addSavedFeed(d)

      const res3 = await agent.app.bsky.actor.getPreferences()
      const v1Pref3 = res3.data.preferences.find((p) =>
        AppBskyActorDefs.isSavedFeedsPref(p),
      )
      expect(v1Pref3).toStrictEqual({
        $type: 'app.bsky.actor.defs#savedFeedsPref',
        pinned: [a, b],
        saved: [a, b, c, d],
      })

      // another new write to v2, pins e
      await agent.addSavedFeeds([
        {
          type: 'feed',
          value: e,
          pinned: true,
        },
      ])

      const res4 = await agent.app.bsky.actor.getPreferences()
      const v1Pref4 = res4.data.preferences.find((p) =>
        AppBskyActorDefs.isSavedFeedsPref(p),
      )
      // v1 pref got v2 write
      expect(v1Pref4).toStrictEqual({
        $type: 'app.bsky.actor.defs#savedFeedsPref',
        pinned: [a, b, e],
        saved: [a, b, c, d, e],
      })

      const final = await agent.getPreferences()
      // d not here bc it was written with v1
      expect(final.savedFeeds).toStrictEqual([
        {
          id: expect.any(String),
          type: 'timeline',
          value: 'following',
          pinned: true,
        },
        { id: expect.any(String), type: 'feed', value: a, pinned: true },
        { id: expect.any(String), type: 'feed', value: b, pinned: true },
        { id: expect.any(String), type: 'feed', value: e, pinned: true },
        { id: expect.any(String), type: 'feed', value: c, pinned: false },
      ])
    })

    it(`filters out invalid values in v1 prefs`, async () => {
      // v1 prefs must be valid AtUris, but they could be any type in theory
      await agent.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: ['at://did:plc:fake/app.bsky.graph.follow/fake'],
            saved: ['at://did:plc:fake/app.bsky.graph.follow/fake'],
          },
        ],
      })
      const prefs = await agent.getPreferences()
      expect(prefs.savedFeeds).toStrictEqual([
        {
          id: expect.any(String),
          type: 'timeline',
          value: 'following',
          pinned: true,
        },
      ])
    })
  })
})
