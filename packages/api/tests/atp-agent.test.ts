import { TestNetworkNoAppView } from '@atproto/dev-env'
import { TID } from '@atproto/common-web'
import {
  AppBskyActorDefs,
  AppBskyActorProfile,
  AtpAgent,
  ComAtprotoRepoPutRecord,
  DEFAULT_LABEL_SETTINGS,
} from '../src'
import {
  getSavedFeedType,
  savedFeedsToUriArrays,
  validateSavedFeed,
} from '../src/util'

describe('agent', () => {
  let network: TestNetworkNoAppView

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'api_atp_agent',
    })
  })

  afterAll(async () => {
    await network.close()
  })

  const getProfileDisplayName = async (
    agent: AtpAgent,
  ): Promise<string | undefined> => {
    try {
      const res = await agent.app.bsky.actor.profile.get({
        repo: agent.accountDid,
        rkey: 'self',
      })
      return res.value.displayName ?? ''
    } catch (err) {
      return undefined
    }
  }

  it('clones correctly', () => {
    const agent = new AtpAgent({ service: network.pds.url })
    const agent2 = agent.clone()
    expect(agent2 instanceof AtpAgent).toBeTruthy()
    expect(agent.service).toEqual(agent2.service)
  })

  it('upsertProfile correctly creates and updates profiles.', async () => {
    const agent = new AtpAgent({ service: network.pds.url })

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
    const agent = new AtpAgent({ service: network.pds.url })
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
          repo: agent.accountDid,
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
    const agent = new AtpAgent({ service: network.pds.url })
    await agent.createAccount({
      handle: 'user3.test',
      email: 'user3@test.com',
      password: 'password',
    })

    const displayName1 = await getProfileDisplayName(agent)
    expect(displayName1).toBeFalsy()

    const p = agent.upsertProfile(async (_existing) => {
      await agent.com.atproto.repo.putRecord({
        repo: agent.accountDid,
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
    const agent = new AtpAgent({ service: network.pds.url })
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
      const agent = new AtpAgent({ service: network.pds.url })
      expect(agent.api).toBe(agent)
      expect(agent.app).toBeDefined()
    })
  })

  describe('post', () => {
    it('should throw if no session', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await expect(agent.post({ text: 'foo' })).rejects.toThrow('Not logged in')
    })
  })

  describe('deletePost', () => {
    it('should throw if no session', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await expect(agent.deletePost('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('like', () => {
    it('should throw if no session', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await expect(agent.like('foo', 'bar')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteLike', () => {
    it('should throw if no session', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await expect(agent.deleteLike('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('repost', () => {
    it('should throw if no session', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await expect(agent.repost('foo', 'bar')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteRepost', () => {
    it('should throw if no session', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await expect(agent.deleteRepost('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('follow', () => {
    it('should throw if no session', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await expect(agent.follow('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteFollow', () => {
    it('should throw if no session', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await expect(agent.deleteFollow('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('preferences methods', () => {
    it('gets and sets preferences correctly', async () => {
      const agent = new AtpAgent({ service: network.pds.url })
      await agent.createAccount({
        handle: 'user5.test',
        email: 'user5@test.com',
        password: 'password',
      })

      const DEFAULT_LABELERS = AtpAgent.appLabelers.map((did) => ({
        did,
        labels: {},
      }))

      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        moderationPrefs: {
          adultContentEnabled: false,
          labels: DEFAULT_LABEL_SETTINGS,
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setAdultContentEnabled(true)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        moderationPrefs: {
          adultContentEnabled: true,
          labels: DEFAULT_LABEL_SETTINGS,
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setAdultContentEnabled(false)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        moderationPrefs: {
          adultContentEnabled: false,
          labels: DEFAULT_LABEL_SETTINGS,
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setContentLabelPref('misinfo', 'hide')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        moderationPrefs: {
          adultContentEnabled: false,
          labels: { ...DEFAULT_LABEL_SETTINGS, misinfo: 'hide' },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setContentLabelPref('spam', 'ignore')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.addSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: [],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.removePinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: [],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.removeSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake2')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
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
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.removeSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: undefined,
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setPersonalDetails({ birthDate: '2023-09-11T18:05:42.556Z' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setFeedViewPrefs('home', { hideReplies: true })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setFeedViewPrefs('home', { hideReplies: false })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setFeedViewPrefs('other', { hideReplies: true })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          other: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setThreadViewPrefs({ sort: 'random' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          other: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'random',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setThreadViewPrefs({ sort: 'oldest' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          other: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })

      await agent.setInterestsPref({ tags: ['foo', 'bar'] })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            misinfo: 'hide',
            spam: 'ignore',
          },
          labelers: DEFAULT_LABELERS,
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          other: {
            hideReplies: true,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: ['foo', 'bar'],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: [],
          nuxs: [],
        },
      })
    })

    it('resolves duplicates correctly', async () => {
      const agent = new AtpAgent({ service: network.pds.url })

      await agent.createAccount({
        handle: 'user6.test',
        email: 'user6@test.com',
        password: 'password',
      })

      await agent.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'porn',
            visibility: 'show',
          },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'porn',
            visibility: 'hide',
          },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'porn',
            visibility: 'show',
          },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'porn',
            visibility: 'warn',
          },
          {
            $type: 'app.bsky.actor.defs#labelersPref',
            labelers: [
              {
                did: 'did:plc:first-labeler',
              },
            ],
          },
          {
            $type: 'app.bsky.actor.defs#labelersPref',
            labelers: [
              {
                did: 'did:plc:first-labeler',
              },
              {
                did: 'did:plc:other',
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
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
          {
            $type: 'app.bsky.actor.defs#feedViewPref',
            feed: 'home',
            hideReplies: true,
            hideRepliesByUnfollowed: false,
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
          {
            $type: 'app.bsky.actor.defs#bskyAppStatePref',
            queuedNudges: ['one'],
          },
          {
            $type: 'app.bsky.actor.defs#bskyAppStatePref',
            activeProgressGuide: undefined,
            queuedNudges: ['two'],
          },
        ],
      })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            type: 'timeline',
            value: 'following',
            pinned: true,
          },
        ],
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          adultContentEnabled: true,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            porn: 'warn',
          },
          labelers: [
            ...AtpAgent.appLabelers.map((did) => ({ did, labels: {} })),
            {
              did: 'did:plc:first-labeler',
              labels: {},
            },
            {
              did: 'did:plc:other',
              labels: {},
            },
          ],
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: ['two'],
          nuxs: [],
        },
      })

      await agent.setAdultContentEnabled(false)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            type: 'timeline',
            value: 'following',
            pinned: true,
          },
        ],
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            porn: 'warn',
          },
          labelers: [
            ...AtpAgent.appLabelers.map((did) => ({ did, labels: {} })),
            {
              did: 'did:plc:first-labeler',
              labels: {},
            },
            {
              did: 'did:plc:other',
              labels: {},
            },
          ],
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: ['two'],
          nuxs: [],
        },
      })

      await agent.setContentLabelPref('porn', 'ignore')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            type: 'timeline',
            value: 'following',
            pinned: true,
          },
        ],
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            nsfw: 'ignore',
            porn: 'ignore',
          },
          labelers: [
            ...AtpAgent.appLabelers.map((did) => ({ did, labels: {} })),
            {
              did: 'did:plc:first-labeler',
              labels: {},
            },
            {
              did: 'did:plc:other',
              labels: {},
            },
          ],
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: ['two'],
          nuxs: [],
        },
      })

      await agent.removeLabeler('did:plc:other')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        savedFeeds: [
          {
            id: expect.any(String),
            type: 'timeline',
            value: 'following',
            pinned: true,
          },
        ],
        feeds: {
          pinned: [],
          saved: [],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            nsfw: 'ignore',
            porn: 'ignore',
          },
          labelers: [
            ...AtpAgent.appLabelers.map((did) => ({ did, labels: {} })),
            {
              did: 'did:plc:first-labeler',
              labels: {},
            },
          ],
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: ['two'],
          nuxs: [],
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            nsfw: 'ignore',
            porn: 'ignore',
          },
          labelers: [
            ...AtpAgent.appLabelers.map((did) => ({ did, labels: {} })),
            {
              did: 'did:plc:first-labeler',
              labels: {},
            },
          ],
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2021-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: ['two'],
          nuxs: [],
        },
      })

      await agent.setPersonalDetails({ birthDate: '2023-09-11T18:05:42.556Z' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            nsfw: 'ignore',
            porn: 'ignore',
          },
          labelers: [
            ...AtpAgent.appLabelers.map((did) => ({ did, labels: {} })),
            {
              did: 'did:plc:first-labeler',
              labels: {},
            },
          ],
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: true,
            hideRepliesByUnfollowed: false,
            hideRepliesByLikeCount: 10,
            hideReposts: true,
            hideQuotePosts: true,
          },
        },
        threadViewPrefs: {
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: ['two'],
          nuxs: [],
        },
      })

      await agent.setFeedViewPrefs('home', {
        hideReplies: false,
        hideRepliesByUnfollowed: true,
        hideRepliesByLikeCount: 0,
        hideReposts: false,
        hideQuotePosts: false,
      })
      await agent.setThreadViewPrefs({
        sort: 'oldest',
        prioritizeFollowedUsers: true,
      })
      await agent.setPersonalDetails({ birthDate: '2023-09-11T18:05:42.556Z' })
      await agent.bskyAppQueueNudges('three')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        savedFeeds: [
          {
            id: expect.any(String),
            pinned: true,
            type: 'timeline',
            value: 'following',
          },
        ],
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            nsfw: 'ignore',
            porn: 'ignore',
          },
          labelers: [
            ...AtpAgent.appLabelers.map((did) => ({ did, labels: {} })),
            {
              did: 'did:plc:first-labeler',
              labels: {},
            },
          ],
          mutedWords: [],
          hiddenPosts: [],
        },
        birthDate: new Date('2023-09-11T18:05:42.556Z'),
        feedViewPrefs: {
          home: {
            hideReplies: false,
            hideRepliesByUnfollowed: true,
            hideRepliesByLikeCount: 0,
            hideReposts: false,
            hideQuotePosts: false,
          },
        },
        threadViewPrefs: {
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
        bskyAppState: {
          activeProgressGuide: undefined,
          queuedNudges: ['two', 'three'],
          nuxs: [],
        },
      })

      const res = await agent.app.bsky.actor.getPreferences()
      expect(res.data.preferences.sort(byType)).toStrictEqual(
        [
          {
            $type: 'app.bsky.actor.defs#bskyAppStatePref',
            queuedNudges: ['two', 'three'],
          },
          {
            $type: 'app.bsky.actor.defs#adultContentPref',
            enabled: false,
          },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'porn',
            visibility: 'ignore',
          },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'nsfw',
            visibility: 'ignore',
          },
          {
            $type: 'app.bsky.actor.defs#labelersPref',
            labelers: [
              {
                did: 'did:plc:first-labeler',
              },
            ],
          },
          {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
            saved: ['at://bob.com/app.bsky.feed.generator/fake'],
          },
          {
            $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
            items: [
              {
                id: expect.any(String),
                pinned: true,
                type: 'timeline',
                value: 'following',
              },
            ],
          },
          {
            $type: 'app.bsky.actor.defs#personalDetailsPref',
            birthDate: '2023-09-11T18:05:42.556Z',
          },

          {
            $type: 'app.bsky.actor.defs#feedViewPref',
            feed: 'home',
            hideReplies: false,
            hideRepliesByUnfollowed: true,
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

    describe('muted words', () => {
      let agent: AtpAgent

      beforeAll(async () => {
        agent = new AtpAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user7.test',
          email: 'user7@test.com',
          password: 'password',
        })
      })

      afterEach(async () => {
        const { moderationPrefs } = await agent.getPreferences()
        await agent.removeMutedWords(moderationPrefs.mutedWords)
      })

      describe('addMutedWord', () => {
        it('inserts', async () => {
          const expiresAt = new Date(Date.now() + 6e3).toISOString()
          await agent.addMutedWord({
            value: 'word',
            targets: ['content'],
            actorTarget: 'all',
            expiresAt,
          })

          const { moderationPrefs } = await agent.getPreferences()
          const word = moderationPrefs.mutedWords.find(
            (m) => m.value === 'word',
          )

          expect(word!.id).toBeTruthy()
          expect(word!.targets).toEqual(['content'])
          expect(word!.actorTarget).toEqual('all')
          expect(word!.expiresAt).toEqual(expiresAt)
        })

        it('single-hash #, no insert', async () => {
          await agent.addMutedWord({
            value: '#',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()

          // sanitized to empty string, not inserted
          expect(moderationPrefs.mutedWords.length).toEqual(0)
        })

        it('multi-hash ##, inserts #', async () => {
          await agent.addMutedWord({
            value: '##',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(
            moderationPrefs.mutedWords.find((m) => m.value === '#'),
          ).toBeTruthy()
        })

        it('multi-hash ##hashtag, inserts #hashtag', async () => {
          await agent.addMutedWord({
            value: '##hashtag',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(
            moderationPrefs.mutedWords.find((w) => w.value === '#hashtag'),
          ).toBeTruthy()
        })

        it('hash emoji #️⃣, inserts #️⃣', async () => {
          await agent.addMutedWord({
            value: '#️⃣',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(
            moderationPrefs.mutedWords.find((m) => m.value === '#️⃣'),
          ).toBeTruthy()
        })

        it('hash emoji w/leading hash ##️⃣, inserts #️⃣', async () => {
          await agent.addMutedWord({
            value: '##️⃣',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(
            moderationPrefs.mutedWords.find((m) => m.value === '#️⃣'),
          ).toBeTruthy()
        })

        it('hash emoji with double leading hash ###️⃣, inserts ##️⃣', async () => {
          await agent.addMutedWord({
            value: '###️⃣',
            targets: [],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(
            moderationPrefs.mutedWords.find((m) => m.value === '##️⃣'),
          ).toBeTruthy()
        })

        it(`includes apostrophes e.g. Bluesky's`, async () => {
          await agent.addMutedWord({
            value: `Bluesky's`,
            targets: [],
            actorTarget: 'all',
          })
          const { mutedWords } = (await agent.getPreferences()).moderationPrefs

          expect(mutedWords.find((m) => m.value === `Bluesky's`)).toBeTruthy()
        })

        describe(`invalid characters`, () => {
          it('#<zws>, no insert', async () => {
            await agent.addMutedWord({
              value: '#​',
              targets: [],
              actorTarget: 'all',
            })
            const { moderationPrefs } = await agent.getPreferences()
            expect(moderationPrefs.mutedWords.length).toEqual(0)
          })

          it('#<zws>ab, inserts ab', async () => {
            await agent.addMutedWord({
              value: '#​ab',
              targets: [],
              actorTarget: 'all',
            })
            const { moderationPrefs } = await agent.getPreferences()
            expect(moderationPrefs.mutedWords.length).toEqual(1)
          })

          it('phrase with newline, inserts phrase without newline', async () => {
            await agent.addMutedWord({
              value: 'test value\n with newline',
              targets: [],
              actorTarget: 'all',
            })
            const { moderationPrefs } = await agent.getPreferences()
            expect(
              moderationPrefs.mutedWords.find(
                (m) => m.value === 'test value with newline',
              ),
            ).toBeTruthy()
          })

          it('phrase with newlines, inserts phrase without newlines', async () => {
            await agent.addMutedWord({
              value: 'test value\n\r with newline',
              targets: [],
              actorTarget: 'all',
            })
            const { moderationPrefs } = await agent.getPreferences()
            expect(
              moderationPrefs.mutedWords.find(
                (m) => m.value === 'test value with newline',
              ),
            ).toBeTruthy()
          })

          it('empty space, no insert', async () => {
            await agent.addMutedWord({
              value: ' ',
              targets: [],
              actorTarget: 'all',
            })
            const { moderationPrefs } = await agent.getPreferences()
            expect(moderationPrefs.mutedWords.length).toEqual(0)
          })

          it(`' trim ', inserts 'trim'`, async () => {
            await agent.addMutedWord({
              value: ' trim ',
              targets: [],
              actorTarget: 'all',
            })
            const { moderationPrefs } = await agent.getPreferences()
            expect(
              moderationPrefs.mutedWords.find((m) => m.value === 'trim'),
            ).toBeTruthy()
          })
        })
      })

      describe('addMutedWords', () => {
        it('inserts happen sequentially, no clobbering', async () => {
          await agent.addMutedWords([
            { value: 'a', targets: ['content'], actorTarget: 'all' },
            { value: 'b', targets: ['content'], actorTarget: 'all' },
            { value: 'c', targets: ['content'], actorTarget: 'all' },
          ])

          const { moderationPrefs } = await agent.getPreferences()

          expect(moderationPrefs.mutedWords.length).toEqual(3)
        })
      })

      describe('upsertMutedWords (deprecated)', () => {
        it('no longer upserts, calls addMutedWords', async () => {
          await agent.upsertMutedWords([
            { value: 'both', targets: ['content'], actorTarget: 'all' },
          ])
          await agent.upsertMutedWords([
            { value: 'both', targets: ['tag'], actorTarget: 'all' },
          ])

          const { moderationPrefs } = await agent.getPreferences()

          expect(moderationPrefs.mutedWords.length).toEqual(2)
        })
      })

      describe('updateMutedWord', () => {
        it(`word doesn't exist, no update or insert`, async () => {
          await agent.updateMutedWord({
            value: 'word',
            targets: ['tag', 'content'],
            actorTarget: 'all',
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.length).toEqual(0)
        })

        it('updates and sanitizes new value', async () => {
          await agent.addMutedWord({
            value: 'value',
            targets: ['content'],
            actorTarget: 'all',
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find(
            (m) => m.value === 'value',
          )

          await agent.updateMutedWord({
            ...word!,
            value: '#new value',
          })

          const b = await agent.getPreferences()
          const updatedWord = b.moderationPrefs.mutedWords.find(
            (m) => m.id === word!.id,
          )

          expect(updatedWord!.value).toEqual('new value')
          expect(updatedWord).toHaveProperty('targets', ['content'])
        })

        it('updates targets', async () => {
          await agent.addMutedWord({
            value: 'word',
            targets: ['tag'],
            actorTarget: 'all',
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find(
            (m) => m.value === 'word',
          )

          await agent.updateMutedWord({
            ...word!,
            targets: ['content'],
          })

          const b = await agent.getPreferences()

          expect(
            b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
          ).toHaveProperty('targets', ['content'])
        })

        it('updates actorTarget', async () => {
          await agent.addMutedWord({
            value: 'value',
            targets: ['content'],
            actorTarget: 'all',
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find(
            (m) => m.value === 'value',
          )

          await agent.updateMutedWord({
            ...word!,
            actorTarget: 'exclude-following',
          })

          const b = await agent.getPreferences()

          expect(
            b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
          ).toHaveProperty('actorTarget', 'exclude-following')
        })

        it('updates expiresAt', async () => {
          const expiresAt = new Date(Date.now() + 6e3).toISOString()
          const expiresAt2 = new Date(Date.now() + 10e3).toISOString()
          await agent.addMutedWord({
            value: 'value',
            targets: ['content'],
            expiresAt,
            actorTarget: 'all',
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find(
            (m) => m.value === 'value',
          )

          await agent.updateMutedWord({
            ...word!,
            expiresAt: expiresAt2,
          })

          const b = await agent.getPreferences()

          expect(
            b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
          ).toHaveProperty('expiresAt', expiresAt2)
        })

        it(`doesn't update if value is sanitized to be falsy`, async () => {
          await agent.addMutedWord({
            value: 'rug',
            targets: ['content'],
            actorTarget: 'all',
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find(
            (m) => m.value === 'rug',
          )

          await agent.updateMutedWord({
            ...word!,
            value: '',
          })

          const b = await agent.getPreferences()

          expect(
            b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
          ).toHaveProperty('value', 'rug')
        })
      })

      describe('removeMutedWord', () => {
        it('removes word', async () => {
          await agent.addMutedWord({
            value: 'word',
            targets: ['tag'],
            actorTarget: 'all',
          })
          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find(
            (m) => m.value === 'word',
          )

          await agent.removeMutedWord(word!)

          const b = await agent.getPreferences()

          expect(
            b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
          ).toBeFalsy()
        })

        it(`word doesn't exist, no action`, async () => {
          await agent.addMutedWord({
            value: 'word',
            targets: ['tag'],
            actorTarget: 'all',
          })
          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find(
            (m) => m.value === 'word',
          )

          await agent.removeMutedWord({
            value: 'another',
            targets: [],
            actorTarget: 'all',
          })

          const b = await agent.getPreferences()

          expect(
            b.moderationPrefs.mutedWords.find((m) => m.id === word!.id),
          ).toBeTruthy()
        })
      })

      describe('removeMutedWords', () => {
        it(`removes sequentially, no clobbering`, async () => {
          await agent.addMutedWords([
            { value: 'a', targets: ['content'], actorTarget: 'all ' },
            { value: 'b', targets: ['content'], actorTarget: 'all ' },
            { value: 'c', targets: ['content'], actorTarget: 'all ' },
          ])

          const a = await agent.getPreferences()
          await agent.removeMutedWords(a.moderationPrefs.mutedWords)
          const b = await agent.getPreferences()

          expect(b.moderationPrefs.mutedWords.length).toEqual(0)
        })
      })
    })

    describe('legacy muted words', () => {
      let agent: AtpAgent

      async function updatePreferences(
        agent: AtpAgent,
        cb: (
          prefs: AppBskyActorDefs.Preferences,
        ) => AppBskyActorDefs.Preferences | false,
      ) {
        const res = await agent.app.bsky.actor.getPreferences({})
        const newPrefs = cb(res.data.preferences)
        if (newPrefs === false) {
          return
        }
        await agent.app.bsky.actor.putPreferences({
          preferences: newPrefs,
        })
      }

      async function addLegacyMutedWord(mutedWord: AppBskyActorDefs.MutedWord) {
        await updatePreferences(agent, (prefs) => {
          let mutedWordsPref = prefs.findLast(
            (pref) =>
              AppBskyActorDefs.isMutedWordsPref(pref) &&
              AppBskyActorDefs.validateMutedWordsPref(pref).success,
          )

          const newMutedWord: AppBskyActorDefs.MutedWord = {
            value: mutedWord.value,
            targets: mutedWord.targets,
            actorTarget: 'all',
          }

          if (
            mutedWordsPref &&
            AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)
          ) {
            mutedWordsPref.items.push(newMutedWord)
          } else {
            // if the pref doesn't exist, create it
            mutedWordsPref = {
              items: [newMutedWord],
            }
          }

          return prefs
            .filter((p) => !AppBskyActorDefs.isMutedWordsPref(p))
            .concat([
              {
                ...mutedWordsPref,
                $type: 'app.bsky.actor.defs#mutedWordsPref',
              },
            ])
        })
      }

      beforeAll(async () => {
        agent = new AtpAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user7-1.test',
          email: 'user7-1@test.com',
          password: 'password',
        })
      })

      afterEach(async () => {
        const { moderationPrefs } = await agent.getPreferences()
        await agent.removeMutedWords(moderationPrefs.mutedWords)
      })

      describe(`upsertMutedWords (and addMutedWord)`, () => {
        it(`adds new word, migrates old words`, async () => {
          await addLegacyMutedWord({
            value: 'word',
            targets: ['content'],
            actorTarget: 'all',
          })

          {
            const { moderationPrefs } = await agent.getPreferences()
            const word = moderationPrefs.mutedWords.find(
              (w) => w.value === 'word',
            )
            expect(word).toBeTruthy()
            expect(word!.id).toBeFalsy()
          }

          await agent.upsertMutedWords([
            { value: 'word2', targets: ['tag'], actorTarget: 'all' },
          ])

          {
            const { moderationPrefs } = await agent.getPreferences()
            const word = moderationPrefs.mutedWords.find(
              (w) => w.value === 'word',
            )
            const word2 = moderationPrefs.mutedWords.find(
              (w) => w.value === 'word2',
            )

            expect(word!.id).toBeTruthy()
            expect(word2!.id).toBeTruthy()
          }
        })
      })

      describe(`updateMutedWord`, () => {
        it(`updates legacy word, migrates old words`, async () => {
          await addLegacyMutedWord({
            value: 'word',
            targets: ['content'],
            actorTarget: 'all',
          })
          await addLegacyMutedWord({
            value: 'word2',
            targets: ['tag'],
            actorTarget: 'all',
          })

          await agent.updateMutedWord({
            value: 'word',
            targets: ['tag'],
            actorTarget: 'all',
          })

          {
            const { moderationPrefs } = await agent.getPreferences()
            const word = moderationPrefs.mutedWords.find(
              (w) => w.value === 'word',
            )
            const word2 = moderationPrefs.mutedWords.find(
              (w) => w.value === 'word2',
            )

            expect(moderationPrefs.mutedWords.length).toEqual(2)
            expect(word!.id).toBeTruthy()
            expect(word!.targets).toEqual(['tag'])
            expect(word2!.id).toBeTruthy()
          }
        })
      })

      describe(`removeMutedWord`, () => {
        it(`removes legacy word, migrates old words`, async () => {
          await addLegacyMutedWord({
            value: 'word',
            targets: ['content'],
            actorTarget: 'all',
          })
          await addLegacyMutedWord({
            value: 'word2',
            targets: ['tag'],
            actorTarget: 'all',
          })

          await agent.removeMutedWord({
            value: 'word',
            targets: ['tag'],
            actorTarget: 'all',
          })

          {
            const { moderationPrefs } = await agent.getPreferences()
            const word = moderationPrefs.mutedWords.find(
              (w) => w.value === 'word',
            )
            const word2 = moderationPrefs.mutedWords.find(
              (w) => w.value === 'word2',
            )

            expect(moderationPrefs.mutedWords.length).toEqual(1)
            expect(word).toBeFalsy()
            expect(word2!.id).toBeTruthy()
          }
        })
      })
    })

    describe('hidden posts', () => {
      let agent: AtpAgent
      const postUri = 'at://did:plc:fake/app.bsky.feed.post/fake'

      beforeAll(async () => {
        agent = new AtpAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user8.test',
          email: 'user8@test.com',
          password: 'password',
        })
      })

      it('hidePost', async () => {
        await agent.hidePost(postUri)
        await agent.hidePost(postUri) // double, should dedupe
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'moderationPrefs.hiddenPosts',
          [postUri],
        )
      })

      it('unhidePost', async () => {
        await agent.unhidePost(postUri)
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'moderationPrefs.hiddenPosts',
          [],
        )
        // no issues calling a second time
        await agent.unhidePost(postUri)
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'moderationPrefs.hiddenPosts',
          [],
        )
      })
    })

    describe(`saved feeds v2`, () => {
      let agent: AtpAgent
      let i = 0
      const feedUri = () => `at://bob.com/app.bsky.feed.generator/${i++}`
      const listUri = () => `at://bob.com/app.bsky.graph.list/${i++}`

      beforeAll(async () => {
        agent = new AtpAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user9.test',
          email: 'user9@test.com',
          password: 'password',
        })
      })

      beforeEach(async () => {
        await agent.app.bsky.actor.putPreferences({
          preferences: [],
        })
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

      describe(`utils`, () => {
        describe(`savedFeedsToUriArrays`, () => {
          const { saved, pinned } = savedFeedsToUriArrays([
            {
              id: '',
              type: 'feed',
              value: 'a',
              pinned: true,
            },
            {
              id: '',
              type: 'feed',
              value: 'b',
              pinned: false,
            },
            {
              id: '',
              type: 'feed',
              value: 'c',
              pinned: true,
            },
          ])
          expect(saved).toStrictEqual(['a', 'b', 'c'])
          expect(pinned).toStrictEqual(['a', 'c'])
        })

        describe(`getSavedFeedType`, () => {
          it(`works`, () => {
            expect(getSavedFeedType('foo')).toBe('unknown')
            expect(getSavedFeedType(feedUri())).toBe('feed')
            expect(getSavedFeedType(listUri())).toBe('list')
            expect(
              getSavedFeedType('at://did:plc:fake/app.bsky.graph.follow/fake'),
            ).toBe('unknown')
          })
        })

        describe(`validateSavedFeed`, () => {
          it(`throws if invalid TID`, () => {
            // really only checks length at time of writing
            expect(() =>
              validateSavedFeed({
                id: 'a',
                type: 'feed',
                value: feedUri(),
                pinned: false,
              }),
            ).toThrow()
          })

          it(`throws if mismatched types`, () => {
            expect(() =>
              validateSavedFeed({
                id: TID.nextStr(),
                type: 'list',
                value: feedUri(),
                pinned: false,
              }),
            ).toThrow()
            expect(() =>
              validateSavedFeed({
                id: TID.nextStr(),
                type: 'feed',
                value: listUri(),
                pinned: false,
              }),
            ).toThrow()
          })

          it(`ignores values it can't validate`, () => {
            expect(() =>
              validateSavedFeed({
                id: TID.nextStr(),
                type: 'timeline',
                value: 'following',
                pinned: false,
              }),
            ).not.toThrow()
            expect(() =>
              validateSavedFeed({
                id: TID.nextStr(),
                type: 'unknown',
                value: 'could be @nyt4!ng',
                pinned: false,
              }),
            ).not.toThrow()
          })
        })
      })
    })

    describe(`saved feeds v2: migration scenarios`, () => {
      let agent: AtpAgent
      let i = 0
      const feedUri = () => `at://bob.com/app.bsky.feed.generator/${i++}`

      beforeAll(async () => {
        agent = new AtpAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user10.test',
          email: 'user10@test.com',
          password: 'password',
        })
      })

      beforeEach(async () => {
        await agent.app.bsky.actor.putPreferences({
          preferences: [],
        })
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

    describe('queued nudges', () => {
      it('queueNudges & dismissNudges', async () => {
        const agent = new AtpAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user11.test',
          email: 'user11@test.com',
          password: 'password',
        })
        await agent.bskyAppQueueNudges('first')
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'bskyAppState.queuedNudges',
          ['first'],
        )
        await agent.bskyAppQueueNudges(['second', 'third'])
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'bskyAppState.queuedNudges',
          ['first', 'second', 'third'],
        )
        await agent.bskyAppDismissNudges('second')
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'bskyAppState.queuedNudges',
          ['first', 'third'],
        )
        await agent.bskyAppDismissNudges(['first', 'third'])
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'bskyAppState.queuedNudges',
          [],
        )
      })
    })

    describe('guided tours', () => {
      it('setActiveProgressGuide', async () => {
        const agent = new AtpAgent({ service: network.pds.url })

        await agent.createAccount({
          handle: 'user12.test',
          email: 'user12@test.com',
          password: 'password',
        })

        await agent.bskyAppSetActiveProgressGuide({
          guide: 'test-guide',
          numThings: 0,
        })
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'bskyAppState.activeProgressGuide.guide',
          'test-guide',
        )
        await agent.bskyAppSetActiveProgressGuide({
          guide: 'test-guide',
          numThings: 1,
        })
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'bskyAppState.activeProgressGuide.guide',
          'test-guide',
        )
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'bskyAppState.activeProgressGuide.numThings',
          1,
        )
        await agent.bskyAppSetActiveProgressGuide(undefined)
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'bskyAppState.activeProgressGuide',
          undefined,
        )
      })
    })

    describe('nuxs', () => {
      let agent: AtpAgent

      const nux = {
        id: 'a',
        completed: false,
        data: '{}',
        expiresAt: new Date(Date.now() + 6e3).toISOString(),
      }

      beforeAll(async () => {
        agent = new AtpAgent({ service: network.pds.url })

        await agent.createAccount({
          handle: 'nuxs.test',
          email: 'nuxs@test.com',
          password: 'password',
        })
      })

      it('bskyAppUpsertNux', async () => {
        // never duplicates
        await agent.bskyAppUpsertNux(nux)
        await agent.bskyAppUpsertNux(nux)
        await agent.bskyAppUpsertNux(nux)

        const prefs = await agent.getPreferences()
        const nuxs = prefs.bskyAppState.nuxs

        expect(nuxs.length).toEqual(1)
        expect(nuxs.find((n) => n.id === nux.id)).toEqual(nux)
      })

      it('bskyAppUpsertNux completed', async () => {
        // never duplicates
        await agent.bskyAppUpsertNux({
          ...nux,
          completed: true,
        })

        const prefs = await agent.getPreferences()
        const nuxs = prefs.bskyAppState.nuxs

        expect(nuxs.length).toEqual(1)
        expect(nuxs.find((n) => n.id === nux.id)?.completed).toEqual(true)
      })

      it('bskyAppRemoveNuxs', async () => {
        await agent.bskyAppRemoveNuxs([nux.id])

        const prefs = await agent.getPreferences()
        const nuxs = prefs.bskyAppState.nuxs

        expect(nuxs.length).toEqual(0)
      })

      it('bskyAppUpsertNux validates nux', async () => {
        // @ts-expect-error
        expect(() => agent.bskyAppUpsertNux({ name: 'a' })).rejects.toThrow()
        expect(() =>
          agent.bskyAppUpsertNux({ id: 'a', completed: false, foo: 'bar' }),
        ).rejects.toThrow()
      })
    })

    // end
  })
})

const byType = (a, b) => a.$type.localeCompare(b.$type)
