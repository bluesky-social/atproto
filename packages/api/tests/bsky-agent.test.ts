import { TestNetworkNoAppView } from '@atproto/dev-env'
import {
  BskyAgent,
  ComAtprotoRepoPutRecord,
  AppBskyActorProfile,
  DEFAULT_LABEL_SETTINGS,
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

  it('clones correctly', () => {
    const agent = new BskyAgent({ service: network.pds.url })
    const agent2 = agent.clone()
    expect(agent2 instanceof BskyAgent).toBeTruthy()
    expect(agent.service).toEqual(agent2.service)
  })

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

      await agent.createAccount({
        handle: 'user5.test',
        email: 'user5@test.com',
        password: 'password',
      })

      const DEFAULT_LABELERS = BskyAgent.appLabelers.map((did) => ({
        did,
        labels: {},
      }))

      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.setAdultContentEnabled(true)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.setAdultContentEnabled(false)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.setContentLabelPref('misinfo', 'hide')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.setContentLabelPref('spam', 'ignore')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.addSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.removePinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.removeSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.removeSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.setPersonalDetails({ birthDate: '2023-09-11T18:05:42.556Z' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.setFeedViewPrefs('home', { hideReplies: true })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.setFeedViewPrefs('home', { hideReplies: false })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
        interests: {
          tags: [],
        },
      })

      await agent.setFeedViewPrefs('other', { hideReplies: true })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
      })

      await agent.setThreadViewPrefs({ sort: 'random' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
      })

      await agent.setThreadViewPrefs({ sort: 'oldest' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
      })

      await agent.setInterestsPref({ tags: ['foo', 'bar'] })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
      })
    })

    it('resolves duplicates correctly', async () => {
      const agent = new BskyAgent({ service: network.pds.url })

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
        ],
      })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
            ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
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
      })

      await agent.setAdultContentEnabled(false)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
            ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
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
      })

      await agent.setContentLabelPref('porn', 'ignore')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
            ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
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
      })

      await agent.removeLabeler('did:plc:other')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
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
            ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
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
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            nsfw: 'ignore',
            porn: 'ignore',
          },
          labelers: [
            ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
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
      })

      await agent.setPersonalDetails({ birthDate: '2023-09-11T18:05:42.556Z' })
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            nsfw: 'ignore',
            porn: 'ignore',
          },
          labelers: [
            ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
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
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: {
            ...DEFAULT_LABEL_SETTINGS,
            nsfw: 'ignore',
            porn: 'ignore',
          },
          labelers: [
            ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
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
      })

      const res = await agent.app.bsky.actor.getPreferences()
      await expect(res.data.preferences.sort(byType)).toStrictEqual(
        [
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
      let agent: BskyAgent
      const mutedWords = [
        { value: 'both', targets: ['content', 'tag'] },
        { value: 'content', targets: ['content'] },
        { value: 'tag', targets: ['tag'] },
        { value: 'tag_then_both', targets: ['tag'] },
        { value: 'tag_then_content', targets: ['tag'] },
        { value: 'tag_then_none', targets: ['tag'] },
      ]

      beforeAll(async () => {
        agent = new BskyAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user7.test',
          email: 'user7@test.com',
          password: 'password',
        })
      })

      it('upsertMutedWords', async () => {
        await agent.upsertMutedWords(mutedWords)
        await agent.upsertMutedWords(mutedWords) // double
        await expect(agent.getPreferences()).resolves.toHaveProperty(
          'moderationPrefs.mutedWords',
          mutedWords,
        )
      })

      it('upsertMutedWords with #', async () => {
        await agent.upsertMutedWords([
          { value: 'hashtag', targets: ['content'] },
        ])
        // is sanitized to `hashtag`
        await agent.upsertMutedWords([{ value: '#hashtag', targets: ['tag'] }])

        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        expect(mutedWords.find((m) => m.value === '#hashtag')).toBeFalsy()
        // merged with existing
        expect(mutedWords.find((m) => m.value === 'hashtag')).toStrictEqual({
          value: 'hashtag',
          targets: ['content', 'tag'],
        })
        // only one added
        expect(mutedWords.filter((m) => m.value === 'hashtag').length).toBe(1)
      })

      it('updateMutedWord', async () => {
        await agent.updateMutedWord({
          value: 'tag_then_content',
          targets: ['content'],
        })
        await agent.updateMutedWord({
          value: 'tag_then_both',
          targets: ['content', 'tag'],
        })
        await agent.updateMutedWord({ value: 'tag_then_none', targets: [] })
        await agent.updateMutedWord({ value: 'no_exist', targets: ['tag'] })
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        expect(
          mutedWords.find((m) => m.value === 'tag_then_content'),
        ).toHaveProperty('targets', ['content'])
        expect(
          mutedWords.find((m) => m.value === 'tag_then_both'),
        ).toHaveProperty('targets', ['content', 'tag'])
        expect(
          mutedWords.find((m) => m.value === 'tag_then_none'),
        ).toHaveProperty('targets', [])
        expect(mutedWords.find((m) => m.value === 'no_exist')).toBeFalsy()
      })

      it('updateMutedWord with #, does not update', async () => {
        await agent.upsertMutedWords([
          {
            value: '#just_a_tag',
            targets: ['tag'],
          },
        ])
        await agent.updateMutedWord({
          value: '#just_a_tag',
          targets: ['tag', 'content'],
        })
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs
        expect(mutedWords.find((m) => m.value === 'just_a_tag')).toStrictEqual({
          value: 'just_a_tag',
          targets: ['tag'],
        })
      })

      it('removeMutedWord', async () => {
        await agent.removeMutedWord({ value: 'tag_then_content', targets: [] })
        await agent.removeMutedWord({ value: 'tag_then_both', targets: [] })
        await agent.removeMutedWord({ value: 'tag_then_none', targets: [] })
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        expect(
          mutedWords.find((m) => m.value === 'tag_then_content'),
        ).toBeFalsy()
        expect(mutedWords.find((m) => m.value === 'tag_then_both')).toBeFalsy()
        expect(mutedWords.find((m) => m.value === 'tag_then_none')).toBeFalsy()
      })

      it('removeMutedWord with #, no match, no removal', async () => {
        await agent.removeMutedWord({ value: '#hashtag', targets: [] })
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        // was inserted with #hashtag, but we don't sanitize on remove
        expect(mutedWords.find((m) => m.value === 'hashtag')).toBeTruthy()
      })

      it('single-hash #', async () => {
        const prev = (await agent.getPreferences()).moderationPrefs
        const length = prev.mutedWords.length
        await agent.upsertMutedWords([{ value: '#', targets: [] }])
        const end = (await agent.getPreferences()).moderationPrefs

        // sanitized to empty string, not inserted
        expect(end.mutedWords.length).toEqual(length)
      })

      it('multi-hash ##', async () => {
        await agent.upsertMutedWords([{ value: '##', targets: [] }])
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        expect(mutedWords.find((m) => m.value === '#')).toBeTruthy()
      })

      it('multi-hash ##hashtag', async () => {
        await agent.upsertMutedWords([{ value: '##hashtag', targets: [] }])
        const a = (await agent.getPreferences()).moderationPrefs

        expect(a.mutedWords.find((w) => w.value === '#hashtag')).toBeTruthy()

        await agent.removeMutedWord({ value: '#hashtag', targets: [] })
        const b = (await agent.getPreferences()).moderationPrefs

        expect(b.mutedWords.find((w) => w.value === '#hashtag')).toBeFalsy()
      })

      it('hash emoji #️⃣', async () => {
        await agent.upsertMutedWords([{ value: '#️⃣', targets: [] }])
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        expect(mutedWords.find((m) => m.value === '#️⃣')).toBeTruthy()

        await agent.removeMutedWord({ value: '#️⃣', targets: [] })
        const end = (await agent.getPreferences()).moderationPrefs

        expect(end.mutedWords.find((m) => m.value === '#️⃣')).toBeFalsy()
      })

      it('hash emoji ##️⃣', async () => {
        await agent.upsertMutedWords([{ value: '##️⃣', targets: [] }])
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        expect(mutedWords.find((m) => m.value === '#️⃣')).toBeTruthy()

        await agent.removeMutedWord({ value: '#️⃣', targets: [] })
        const end = (await agent.getPreferences()).moderationPrefs

        expect(end.mutedWords.find((m) => m.value === '#️⃣')).toBeFalsy()
      })

      it('hash emoji ###️⃣', async () => {
        await agent.upsertMutedWords([{ value: '###️⃣', targets: [] }])
        const { mutedWords } = (await agent.getPreferences()).moderationPrefs

        expect(mutedWords.find((m) => m.value === '##️⃣')).toBeTruthy()

        await agent.removeMutedWord({ value: '##️⃣', targets: [] })
        const end = (await agent.getPreferences()).moderationPrefs

        expect(end.mutedWords.find((m) => m.value === '##️⃣')).toBeFalsy()
      })

      describe(`invalid characters`, () => {
        it('zero width space', async () => {
          const prev = (await agent.getPreferences()).moderationPrefs
          const length = prev.mutedWords.length
          await agent.upsertMutedWords([{ value: '#​', targets: [] }])
          const { mutedWords } = (await agent.getPreferences()).moderationPrefs

          expect(mutedWords.length).toEqual(length)
        })

        it('newline', async () => {
          await agent.upsertMutedWords([
            { value: 'test value\n with newline', targets: [] },
          ])
          const { mutedWords } = (await agent.getPreferences()).moderationPrefs

          expect(
            mutedWords.find((m) => m.value === 'test value with newline'),
          ).toBeTruthy()
        })

        it('newline(s)', async () => {
          await agent.upsertMutedWords([
            { value: 'test value\n\r with newline', targets: [] },
          ])
          const { mutedWords } = (await agent.getPreferences()).moderationPrefs

          expect(
            mutedWords.find((m) => m.value === 'test value with newline'),
          ).toBeTruthy()
        })

        it('empty space', async () => {
          await agent.upsertMutedWords([{ value: ' ', targets: [] }])
          const { mutedWords } = (await agent.getPreferences()).moderationPrefs

          expect(mutedWords.find((m) => m.value === ' ')).toBeFalsy()
        })

        it('leading/trailing space', async () => {
          await agent.upsertMutedWords([{ value: ' trim ', targets: [] }])
          const { mutedWords } = (await agent.getPreferences()).moderationPrefs

          expect(mutedWords.find((m) => m.value === 'trim')).toBeTruthy()
        })
      })
    })

    describe('hidden posts', () => {
      let agent: BskyAgent
      const postUri = 'at://did:plc:fake/app.bsky.feed.post/fake'

      beforeAll(async () => {
        agent = new BskyAgent({ service: network.pds.url })
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

    // end
  })
})

const byType = (a, b) => a.$type.localeCompare(b.$type)
