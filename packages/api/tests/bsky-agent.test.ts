import { TestNetworkNoAppView } from '@atproto/dev-env'
import {
  BskyAgent,
  ComAtprotoRepoPutRecord,
  AppBskyActorProfile,
  BSKY_MODSERVICE_DID,
  DEFAULT_LABELGROUP_PREFERENCES,
} from '..'

describe('agent', () => {
  let network: TestNetworkNoAppView

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'bsky_agent',
    })
  })

  afterAll(async () => {
    await network.close()
  })

  const getProfileDisplayName = async (
    agent: BskyAgent,
  ): Promise<string | undefined> => {
    try {
      const res = await agent.api.app.bsky.actor.profile.get({
        repo: agent.session?.did || '',
        rkey: 'self',
      })
      return res.value.displayName ?? ''
    } catch (err) {
      return undefined
    }
  }

  it('upsertProfile correctly creates and updates profiles.', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user1.test',
      email: 'user1@test.com',
      password: 'password',
    })
    const displayName1 = await getProfileDisplayName(agent)
    expect(displayName1).toBeFalsy()

    await agent.upsertProfile((existing) => {
      expect(existing).toBeFalsy()
      return {
        displayName: 'Bob',
      }
    })

    const displayName2 = await getProfileDisplayName(agent)
    expect(displayName2).toBe('Bob')

    await agent.upsertProfile((existing) => {
      expect(existing).toBeTruthy()
      return {
        displayName: existing?.displayName?.toUpperCase(),
      }
    })

    const displayName3 = await getProfileDisplayName(agent)
    expect(displayName3).toBe('BOB')
  })

  it('upsertProfile correctly handles CAS failures.', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user2.test',
      email: 'user2@test.com',
      password: 'password',
    })

    const displayName1 = await getProfileDisplayName(agent)
    expect(displayName1).toBeFalsy()

    let hasConflicted = false
    let ranTwice = false
    await agent.upsertProfile(async (_existing) => {
      if (!hasConflicted) {
        await agent.com.atproto.repo.putRecord({
          repo: agent.session?.did || '',
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
          record: {
            $type: 'app.bsky.actor.profile',
            displayName: String(Math.random()),
          },
        })
        hasConflicted = true
      } else {
        ranTwice = true
      }
      return {
        displayName: 'Bob',
      }
    })
    expect(ranTwice).toBe(true)

    const displayName2 = await getProfileDisplayName(agent)
    expect(displayName2).toBe('Bob')
  })

  it('upsertProfile wont endlessly retry CAS failures.', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user3.test',
      email: 'user3@test.com',
      password: 'password',
    })

    const displayName1 = await getProfileDisplayName(agent)
    expect(displayName1).toBeFalsy()

    const p = agent.upsertProfile(async (_existing) => {
      await agent.com.atproto.repo.putRecord({
        repo: agent.session?.did || '',
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: {
          $type: 'app.bsky.actor.profile',
          displayName: String(Math.random()),
        },
      })
      return {
        displayName: 'Bob',
      }
    })
    await expect(p).rejects.toThrow(ComAtprotoRepoPutRecord.InvalidSwapError)
  })

  it('upsertProfile validates the record.', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user4.test',
      email: 'user4@test.com',
      password: 'password',
    })

    const p = agent.upsertProfile((_existing) => {
      return {
        displayName: { string: 'Bob' },
      } as unknown as AppBskyActorProfile.Record
    })
    await expect(p).rejects.toThrow('Record/displayName must be a string')
  })

  describe('app', () => {
    it('should retrieve the api app', () => {
      const agent = new BskyAgent({ service: network.pds.url })
      expect(agent.app).toBe(agent.api.app)
    })
  })

  describe('post', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: network.pds.url })
      await expect(agent.post({ text: 'foo' })).rejects.toThrow('Not logged in')
    })
  })

  describe('deletePost', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: network.pds.url })
      await expect(agent.deletePost('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('like', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: network.pds.url })
      await expect(agent.like('foo', 'bar')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteLike', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: network.pds.url })
      await expect(agent.deleteLike('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('repost', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: network.pds.url })
      await expect(agent.repost('foo', 'bar')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteRepost', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: network.pds.url })
      await expect(agent.deleteRepost('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('follow', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: network.pds.url })
      await expect(agent.follow('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteFollow', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: network.pds.url })
      await expect(agent.deleteFollow('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('preferences methods', () => {
    it('gets and sets preferences correctly', async () => {
      const agent = new BskyAgent({ service: network.pds.url })

      const res = await agent.createAccount({
        handle: 'user5.test',
        email: 'user5@test.com',
        password: 'password',
      })

      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setAdultContentEnabled(true)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: true,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setAdultContentEnabled(false)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setModServiceLabelGroupPref(
        BSKY_MODSERVICE_DID,
        'misinfo',
        'hide',
      )
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setModServiceLabelGroupPref(
        BSKY_MODSERVICE_DID,
        'spam',
        'ignore',
      )
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.addSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.removePinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.removeSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake2')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [
            'at://bob.com/app.bsky.feed.generator/fake',
            'at://bob.com/app.bsky.feed.generator/fake2',
          ],
          saved: [
            'at://bob.com/app.bsky.feed.generator/fake',
            'at://bob.com/app.bsky.feed.generator/fake2',
          ],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.removeSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setPersonalDetails({ birthDate: '2023-09-11T18:05:42.556Z' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setFeedViewPrefs('home', { hideReplies: true })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setFeedViewPrefs('home', { hideReplies: false })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setFeedViewPrefs('other', { hideReplies: true })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          other: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setThreadViewPrefs({ sort: 'random' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          other: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'random',
          prioritizeFollowedUsers: true,
        },
      })

      await agent.setThreadViewPrefs({ sort: 'oldest' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          userDid: res.data.did,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ misinfo: 'hide', spam: 'ignore' },
              },
            },
          ],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          other: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })
    })

    it('resolves duplicates correctly', async () => {
      const agent = new BskyAgent({ service: network.pds.url })

      const userRes = await agent.createAccount({
        handle: 'user6.test',
        email: 'user6@test.com',
        password: 'password',
      })
      const userDid = userRes.data.did

      await agent.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#modsPref',
            mods: [
              {
                did: BSKY_MODSERVICE_DID,
                enabled: true,
                labelGroupSettings: [
                  { labelGroup: 'porn', setting: 'ignore' },
                  { labelGroup: 'nudity', setting: 'ignore' },
                  { labelGroup: 'suggestive', setting: 'ignore' },
                  { labelGroup: 'violence', setting: 'ignore' },
                  { labelGroup: 'intolerance', setting: 'ignore' },
                  { labelGroup: 'spam', setting: 'ignore' },
                  { labelGroup: 'misinfo', setting: 'ignore' },
                ],
              },
            ],
          },
          {
            $type: 'app.bsky.actor.defs#modsPref',
            mods: [
              {
                did: BSKY_MODSERVICE_DID,
                enabled: true,
                labelGroupSettings: [
                  { labelGroup: 'porn', setting: 'hide' },
                  { labelGroup: 'nudity', setting: 'warn' },
                  { labelGroup: 'suggestive', setting: 'warn' },
                  { labelGroup: 'violence', setting: 'warn' },
                  { labelGroup: 'intolerance', setting: 'hide' },
                  { labelGroup: 'spam', setting: 'hide' },
                  { labelGroup: 'misinfo', setting: 'warn' },
                ],
              },
              {
                did: 'did:plc:othermod',
                enabled: true,
                labelGroupSettings: [
                  { labelGroup: 'porn', setting: 'hide' },
                  { labelGroup: 'nudity', setting: 'warn' },
                  { labelGroup: 'suggestive', setting: 'warn' },
                  { labelGroup: 'violence', setting: 'warn' },
                  { labelGroup: 'intolerance', setting: 'hide' },
                  { labelGroup: 'spam', setting: 'hide' },
                  { labelGroup: 'misinfo', setting: 'warn' },
                ],
              },
            ],
          },
          {
            $type: 'app.bsky.actor.defs#adultContentPref',
            enabled: true,
          },
          {
            $type: 'app.bsky.actor.defs#adultContentPref',
            enabled: false,
          },
          {
            $type: 'app.bsky.actor.defs#adultContentPref',
            enabled: true,
          },
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: [
              'at://bob.com/app.bsky.feed.generator/fake',
              'at://bob.com/app.bsky.feed.generator/fake2',
            ],
            saved: [
              'at://bob.com/app.bsky.feed.generator/fake',
              'at://bob.com/app.bsky.feed.generator/fake2',
            ],
          },
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: [],
            saved: [],
          },
          {
            $type: 'app.bsky.actor.defs#personalDetailsPref',
            birthDate: '2023-09-11T18:05:42.556Z',
          },
          {
            $type: 'app.bsky.actor.defs#personalDetailsPref',
            birthDate: '2021-09-11T18:05:42.556Z',
          },
          {
            $type: 'app.bsky.actor.defs#feedViewPref',
            feed: 'home',
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          {
            $type: 'app.bsky.actor.defs#feedViewPref',
            feed: 'home',
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
          {
            $type: 'app.bsky.actor.defs#threadViewPref',
            sort: 'oldest',
            prioritizeFollowedUsers: true,
          },
          {
            $type: 'app.bsky.actor.defs#threadViewPref',
            sort: 'newest',
            prioritizeFollowedUsers: false,
          },
        ],
      })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          userDid,
          adultContentEnabled: true,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
            {
              labeler: { did: 'did:plc:othermod' },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      })

      await agent.setAdultContentEnabled(false)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          userDid,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
            {
              labeler: { did: 'did:plc:othermod' },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      })

      await agent.setModServiceLabelGroupPref(
        BSKY_MODSERVICE_DID,
        'porn',
        'ignore',
      )
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          userDid,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ porn: 'ignore' },
              },
            },
            {
              labeler: { did: 'did:plc:othermod' },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      })

      await agent.removeModService('did:plc:othermod')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          userDid,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: {
                ...DEFAULT_LABELGROUP_PREFERENCES,
                ...{ porn: 'ignore' },
              },
            },
          ],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      })

      await agent.setModServiceLabelGroupPref(
        BSKY_MODSERVICE_DID,
        'porn',
        'hide',
      )
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          userDid,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          userDid,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      })

      await agent.setPersonalDetails({ birthDate: '2023-09-11T18:05:42.556Z' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          userDid,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      })

      await agent.setFeedViewPrefs('home', {
        hideReplies: false,
        hideRepliesByUnfollowed: false,
        hideRepliesByLikeCount: 0,
        hideReposts: false,
        hideQuotePosts: false,
      })
      await agent.setThreadViewPrefs({
        sort: 'oldest',
        prioritizeFollowedUsers: true,
      })
      await agent.setPersonalDetails({ birthDate: '2023-09-11T18:05:42.556Z' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          userDid,
          adultContentEnabled: false,
          labelGroups: {},
          labelers: [
            {
              labeler: { did: BSKY_MODSERVICE_DID },
              labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
            },
          ],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      })

      const res = await agent.app.bsky.actor.getPreferences()
      await expect(res.data.preferences.sort(byType)).toStrictEqual(
        [
          {
            $type: 'app.bsky.actor.defs#adultContentPref',
            enabled: false,
          },
          {
            $type: 'app.bsky.actor.defs#modsPref',
            mods: [
              {
                did: BSKY_MODSERVICE_DID,
                enabled: true,
                labelGroupSettings: [
                  { labelGroup: 'porn', setting: 'hide' },
                  { labelGroup: 'nudity', setting: 'warn' },
                  { labelGroup: 'suggestive', setting: 'warn' },
                  { labelGroup: 'violence', setting: 'warn' },
                  { labelGroup: 'intolerance', setting: 'hide' },
                  { labelGroup: 'spam', setting: 'hide' },
                  { labelGroup: 'misinfo', setting: 'warn' },
                ],
              },
            ],
          },
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
            saved: ['at://bob.com/app.bsky.feed.generator/fake'],
          },
          {
            $type: 'app.bsky.actor.defs#personalDetailsPref',
            birthDate: '2023-09-11T18:05:42.556Z',
          },

          {
            $type: 'app.bsky.actor.defs#feedViewPref',
            feed: 'home',
            hideReplies: false,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          {
            $type: 'app.bsky.actor.defs#threadViewPref',
            sort: 'oldest',
            prioritizeFollowedUsers: true,
          },
        ].sort(byType),
      )
    })
  })
})

const byType = (a, b) => a.$type.localeCompare(b.$type)
