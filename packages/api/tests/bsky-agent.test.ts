import { TestNetworkNoAppView } from '@atproto/dev-env'
import {
  BskyAgent,
  ComAtprotoRepoPutRecord,
  AppBskyActorProfile,
  DEFAULT_LABEL_SETTINGS,
  AppBskyActorDefs,
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

      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        moderationPrefs: {
          adultContentEnabled: false,
          labels: DEFAULT_LABEL_SETTINGS,
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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
          labelers: [],
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

      beforeAll(async () => {
        agent = new BskyAgent({ service: network.pds.url })
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
            actors: [],
            expiresAt,
          })

          const { moderationPrefs } = await agent.getPreferences()
          const word = moderationPrefs.mutedWords.find((m) => m.value === 'word')

          expect(word!.id).toBeTruthy()
          expect(word!.targets).toEqual(['content'])
          expect(word!.actors).toEqual([])
          expect(word!.expiresAt).toEqual(expiresAt)
        })

        it('single-hash #, no insert', async () => {
          await agent.addMutedWord({ value: '#', targets: [] })
          const { moderationPrefs } = await agent.getPreferences()

          // sanitized to empty string, not inserted
          expect(moderationPrefs.mutedWords.length).toEqual(0)
        })

        it('multi-hash ##, inserts #', async () => {
          await agent.addMutedWord({ value: '##', targets: [] })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.find((m) => m.value === '#')).toBeTruthy()
        })

        it('multi-hash ##hashtag, inserts #hashtag', async () => {
          await agent.addMutedWord({ value: '##hashtag', targets: [] })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.find((w) => w.value === '#hashtag')).toBeTruthy()
        })

        it('hash emoji #️⃣, inserts #️⃣', async () => {
          await agent.addMutedWord({ value: '#️⃣', targets: [] })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.find((m) => m.value === '#️⃣')).toBeTruthy()
        })

        it('hash emoji w/leading hash ##️⃣, inserts #️⃣', async () => {
          await agent.addMutedWord({ value: '##️⃣', targets: [] })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.find((m) => m.value === '#️⃣')).toBeTruthy()
        })

        it('hash emoji with double leading hash ###️⃣, inserts ##️⃣', async () => {
          await agent.addMutedWord({ value: '###️⃣', targets: [] })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.find((m) => m.value === '##️⃣')).toBeTruthy()
        })

        describe(`invalid characters`, () => {
          it('#<zws>, no insert', async () => {
            await agent.addMutedWord({ value: '#​', targets: [] })
            const { moderationPrefs } = await agent.getPreferences()
            expect(moderationPrefs.mutedWords.length).toEqual(0)
          })

          it('#<zws>ab, inserts ab', async () => {
            await agent.addMutedWord({ value: '#​ab', targets: [] })
            const { moderationPrefs } = await agent.getPreferences()
            expect(moderationPrefs.mutedWords.length).toEqual(1)
          })

          it('phrase with newline, inserts phrase without newline', async () => {
            await agent.addMutedWord({
              value: 'test value\n with newline',
              targets: [],
            })
            const { moderationPrefs } = await agent.getPreferences()
            expect(
              moderationPrefs.mutedWords.find((m) => m.value === 'test value with newline'),
            ).toBeTruthy()
          })

          it('phrase with newlines, inserts phrase without newlines', async () => {
            await agent.addMutedWord({
              value: 'test value\n\r with newline',
              targets: [],
            })
            const { moderationPrefs } = await agent.getPreferences()
            expect(
              moderationPrefs.mutedWords.find((m) => m.value === 'test value with newline'),
            ).toBeTruthy()
          })

          it('empty space, no insert', async () => {
            await agent.addMutedWord({ value: ' ', targets: [] })
            const { moderationPrefs } = await agent.getPreferences()
            expect(moderationPrefs.mutedWords.length).toEqual(0)
          })

          it(`' trim ', inserts 'trim'`, async () => {
            await agent.addMutedWord({ value: ' trim ', targets: [] })
            const { moderationPrefs } = await agent.getPreferences()
            expect(moderationPrefs.mutedWords.find((m) => m.value === 'trim')).toBeTruthy()
          })
        })
      })

      describe('addMutedWords', () => {
        it('inserts happen sequentially, no clobbering', async () => {
          await agent.addMutedWords([
            { value: 'a', targets: ['content'] },
            { value: 'b', targets: ['content'] },
            { value: 'c', targets: ['content'] },
          ])

          const { moderationPrefs } = await agent.getPreferences()

          expect(moderationPrefs.mutedWords.length).toEqual(3)
        })
      })

      describe('upsertMutedWords (deprecated)', () => {
        it('no longer upserts, calls addMutedWords', async () => {
          await agent.upsertMutedWords([
            { value: 'both', targets: ['content'] },
          ])
          await agent.upsertMutedWords([{ value: 'both', targets: ['tag'] }])

          const { moderationPrefs } = await agent.getPreferences()

          expect(moderationPrefs.mutedWords.length).toEqual(2)
        })
      })

      describe('updateMutedWord', () => {
        it(`word doesn't exist, no update or insert`, async () => {
          await agent.updateMutedWord({
            value: 'word',
            targets: ['tag', 'content'],
          })
          const { moderationPrefs } = await agent.getPreferences()
          expect(moderationPrefs.mutedWords.length).toEqual(0)
        })

        it('updates and sanitizes new value', async () => {
          await agent.addMutedWord({
            value: 'value',
            targets: ['content'],
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find((m) => m.value === 'value')

          await agent.updateMutedWord({
            ...word!,
            value: '#new value',
          })

          const b = await agent.getPreferences()
          const updatedWord = b.moderationPrefs.mutedWords.find((m) => m.id === word!.id)

          expect(updatedWord!.value).toEqual('new value')
          expect(updatedWord).toHaveProperty('targets', ['content'])
        })

        it('updates targets', async () => {
          await agent.addMutedWord({
            value: 'word',
            targets: ['tag'],
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find((m) => m.value === 'word')

          await agent.updateMutedWord({
            ...word!,
            targets: ['content'],
          })

          const b = await agent.getPreferences()

          expect(b.moderationPrefs.mutedWords.find((m) => m.id === word!.id)).toHaveProperty(
            'targets',
            ['content'],
          )
        })

        it('updates actors', async () => {
          await agent.addMutedWord({
            value: 'value',
            targets: ['content'],
            actors: ['did:plc:fake'],
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find((m) => m.value === 'value')

          await agent.updateMutedWord({
            ...word!,
            actors: ['did:plc:fake2'],
          })

          const b = await agent.getPreferences()

          expect(b.moderationPrefs.mutedWords.find((m) => m.id === word!.id)).toHaveProperty(
            'actors',
            ['did:plc:fake2'],
          )
        })

        it('updates expiresAt', async () => {
          const expiresAt = new Date(Date.now() + 6e3).toISOString()
          const expiresAt2 = new Date(Date.now() + 10e3).toISOString()
          await agent.addMutedWord({
            value: 'value',
            targets: ['content'],
            expiresAt,
          })

          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find((m) => m.value === 'value')

          await agent.updateMutedWord({
            ...word!,
            expiresAt: expiresAt2,
          })

          const b = await agent.getPreferences()

          expect(b.moderationPrefs.mutedWords.find((m) => m.id === word!.id)).toHaveProperty(
            'expiresAt',
            expiresAt2,
          )
        })
      })

      describe('removeMutedWord', () => {
        it('removes word', async () => {
          await agent.addMutedWord({ value: 'word', targets: ['tag'] })
          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find((m) => m.value === 'word')

          await agent.removeMutedWord(word!)

          const b = await agent.getPreferences()

          expect(b.moderationPrefs.mutedWords.find((m) => m.id === word!.id)).toBeFalsy()
        })

        it(`word doesn't exist, no action`, async () => {
          await agent.addMutedWord({ value: 'word', targets: ['tag'] })
          const a = await agent.getPreferences()
          const word = a.moderationPrefs.mutedWords.find((m) => m.value === 'word')

          await agent.removeMutedWord({ value: 'another', targets: [] })

          const b = await agent.getPreferences()

          expect(b.moderationPrefs.mutedWords.find((m) => m.id === word!.id)).toBeTruthy()
        })
      })

      describe('removeMutedWords', () => {
        it(`removes sequentially, no clobbering`, async () => {
          await agent.addMutedWords([
            { value: 'a', targets: ['content'] },
            { value: 'b', targets: ['content'] },
            { value: 'c', targets: ['content'] },
          ])

          const a = await agent.getPreferences()
          await agent.removeMutedWords(a.moderationPrefs.mutedWords)
          const b = await agent.getPreferences()

          expect(b.moderationPrefs.mutedWords.length).toEqual(0)
        })
      })
    })

    describe('legacy muted words', () => {
      let agent: BskyAgent

      async function updatePreferences(
        agent: BskyAgent,
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
        agent = new BskyAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user8.test',
          email: 'user8@test.com',
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
          })

          {
            const { moderationPrefs } = await agent.getPreferences()
            const word = moderationPrefs.mutedWords.find((w) => w.value === 'word')
            expect(word).toBeTruthy()
            expect(word!.id).toBeFalsy()
          }

          await agent.upsertMutedWords([{ value: 'word2', targets: ['tag'] }])

          {
            const { moderationPrefs } = await agent.getPreferences()
            const word = moderationPrefs.mutedWords.find((w) => w.value === 'word')
            const word2 = moderationPrefs.mutedWords.find((w) => w.value === 'word2')

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
          })
          await addLegacyMutedWord({
            value: 'word2',
            targets: ['tag'],
          })

          await agent.updateMutedWord({ value: 'word', targets: ['tag'] })

          {
            const { moderationPrefs } = await agent.getPreferences()
            const word = moderationPrefs.mutedWords.find((w) => w.value === 'word')
            const word2 = moderationPrefs.mutedWords.find((w) => w.value === 'word2')

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
          })
          await addLegacyMutedWord({
            value: 'word2',
            targets: ['tag'],
          })

          await agent.removeMutedWord({ value: 'word', targets: ['tag'] })

          {
            const { moderationPrefs } = await agent.getPreferences()
            const word = moderationPrefs.mutedWords.find((w) => w.value === 'word')
            const word2 = moderationPrefs.mutedWords.find((w) => w.value === 'word2')

            expect(moderationPrefs.mutedWords.length).toEqual(1)
            expect(word).toBeFalsy()
            expect(word2!.id).toBeTruthy()
          }
        })
      })
    })

    describe('hidden posts', () => {
      let agent: BskyAgent
      const postUri = 'at://did:plc:fake/app.bsky.feed.post/fake'

      beforeAll(async () => {
        agent = new BskyAgent({ service: network.pds.url })
        await agent.createAccount({
          handle: 'user9.test',
          email: 'user9@test.com',
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
