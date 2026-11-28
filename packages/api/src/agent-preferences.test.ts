import { describe, expect, it } from 'vitest'
import { preferencesStore } from './_xrpc-fetch.test.js'
import { Agent } from './agent.js'
import type { AppBskyActorDefs } from './client/index.js'
import { DEFAULT_LABEL_SETTINGS } from './moderation/const/labels.js'

describe('Agent preferences', () => {
  it('gets and sets preferences correctly', async () => {
    const { agent } = preferencesStore()

    const DEFAULT_LABELERS = Agent.appLabelers.map((did) => ({
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
      },
      interests: {
        tags: ['foo', 'bar'],
        updatedAt: expect.any(String),
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: [],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
      },
    })

    const firstUpdatedAt = (await agent.getPreferences()).interests.updatedAt
    expect(firstUpdatedAt).toBeDefined()

    await new Promise((resolve) => setTimeout(resolve, 2))
    await agent.setInterestsPref({ tags: ['baz'] })

    const updatedInterests = (await agent.getPreferences()).interests
    expect(updatedInterests).toEqual({
      tags: ['baz'],
      updatedAt: expect.any(String),
    })
    expect(Date.parse(updatedInterests.updatedAt!)).toBeGreaterThan(
      Date.parse(firstUpdatedAt!),
    )
  })

  it('resolves duplicates correctly', async () => {
    const { agent } = preferencesStore()

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
          $type: 'app.bsky.actor.defs#declaredAgePref',
          isOverAge13: false,
          isOverAge16: false,
          isOverAge18: false,
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
        },
        {
          $type: 'app.bsky.actor.defs#threadViewPref',
          sort: 'newest',
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
          ...Agent.appLabelers.map((did) => ({ did, labels: {} })),
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
      declaredAge: {
        isOverAge13: false,
        isOverAge16: false,
        isOverAge18: false,
      },
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: ['two'],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
          ...Agent.appLabelers.map((did) => ({ did, labels: {} })),
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
      declaredAge: {
        isOverAge13: false,
        isOverAge16: false,
        isOverAge18: false,
      },
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: ['two'],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
          ...Agent.appLabelers.map((did) => ({ did, labels: {} })),
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
      declaredAge: {
        isOverAge13: false,
        isOverAge16: false,
        isOverAge18: false,
      },
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: ['two'],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
          ...Agent.appLabelers.map((did) => ({ did, labels: {} })),
          {
            did: 'did:plc:first-labeler',
            labels: {},
          },
        ],
        mutedWords: [],
        hiddenPosts: [],
      },
      birthDate: new Date('2021-09-11T18:05:42.556Z'),
      declaredAge: {
        isOverAge13: false,
        isOverAge16: false,
        isOverAge18: false,
      },
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: ['two'],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
          ...Agent.appLabelers.map((did) => ({ did, labels: {} })),
          {
            did: 'did:plc:first-labeler',
            labels: {},
          },
        ],
        mutedWords: [],
        hiddenPosts: [],
      },
      birthDate: new Date('2021-09-11T18:05:42.556Z'),
      declaredAge: {
        isOverAge13: false,
        isOverAge16: false,
        isOverAge18: false,
      },
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: ['two'],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
          ...Agent.appLabelers.map((did) => ({ did, labels: {} })),
          {
            did: 'did:plc:first-labeler',
            labels: {},
          },
        ],
        mutedWords: [],
        hiddenPosts: [],
      },
      birthDate: new Date('2023-09-11T18:05:42.556Z'),
      declaredAge: {
        isOverAge13: false,
        isOverAge16: false,
        isOverAge18: false,
      },
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: ['two'],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
          ...Agent.appLabelers.map((did) => ({ did, labels: {} })),
          {
            did: 'did:plc:first-labeler',
            labels: {},
          },
        ],
        mutedWords: [],
        hiddenPosts: [],
      },
      birthDate: new Date('2023-09-11T18:05:42.556Z'),
      declaredAge: {
        isOverAge13: false,
        isOverAge16: false,
        isOverAge18: false,
      },
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
      },
      interests: {
        tags: [],
      },
      bskyAppState: {
        activeProgressGuide: undefined,
        queuedNudges: ['two', 'three'],
        nuxs: [],
      },
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
      liveEventPreferences: {
        hiddenFeedIds: [],
        hideAllFeeds: false,
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
          $type: 'app.bsky.actor.defs#declaredAgePref',
          isOverAge13: false,
          isOverAge16: false,
          isOverAge18: false,
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
        },
      ].sort(byType),
    )
  })

  describe('queued nudges', () => {
    it('queueNudges & dismissNudges', async () => {
      const { agent } = preferencesStore()
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
      const { agent } = preferencesStore()

      await agent.bskyAppSetActiveProgressGuide({
        guide: 'test-guide',
        // @ts-expect-error unspecced field
        numThings: 0,
      })
      await expect(agent.getPreferences()).resolves.toHaveProperty(
        'bskyAppState.activeProgressGuide.guide',
        'test-guide',
      )
      await agent.bskyAppSetActiveProgressGuide({
        guide: 'test-guide',
        // @ts-expect-error unspecced field
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

  describe('beta user', () => {
    it('setIsBetaUser', async () => {
      const { agent } = preferencesStore()

      // unset by default
      await expect(agent.getPreferences()).resolves.not.toHaveProperty(
        'bskyAppState.isBetaUser',
      )

      await agent.setIsBetaUser(true)
      await expect(agent.getPreferences()).resolves.toHaveProperty(
        'bskyAppState.isBetaUser',
        true,
      )

      await agent.setIsBetaUser(false)
      await expect(agent.getPreferences()).resolves.toHaveProperty(
        'bskyAppState.isBetaUser',
        false,
      )
    })

    it('preserves other bskyAppState fields', async () => {
      const { agent } = preferencesStore()

      await agent.bskyAppQueueNudges(['keepme'])
      await agent.setIsBetaUser(true)

      const prefs = await agent.getPreferences()
      expect(prefs.bskyAppState.isBetaUser).toEqual(true)
      expect(prefs.bskyAppState.queuedNudges).toEqual(['keepme'])
    })
  })

  describe('hidden posts', () => {
    const postUri = 'at://did:plc:fake/app.bsky.feed.post/fake'

    it('hidePost', async () => {
      const { agent } = preferencesStore()
      await agent.hidePost(postUri)
      await agent.hidePost(postUri) // double, should dedupe
      await expect(agent.getPreferences()).resolves.toHaveProperty(
        'moderationPrefs.hiddenPosts',
        [postUri],
      )
    })

    it('unhidePost', async () => {
      const { agent } = preferencesStore([
        { $type: 'app.bsky.actor.defs#hiddenPostsPref', items: [postUri] },
      ])
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

  describe('nuxs', () => {
    const nux = {
      id: 'a',
      completed: false,
      data: '{}',
      expiresAt: new Date(Date.now() + 6e3).toISOString(),
    }
    const bskyAppStatePref = (...nuxs: AppBskyActorDefs.Nux[]) => ({
      $type: 'app.bsky.actor.defs#bskyAppStatePref',
      nuxs,
    })

    it('bskyAppUpsertNux', async () => {
      const { agent } = preferencesStore()

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
      const { agent } = preferencesStore([bskyAppStatePref(nux)])

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
      const { agent } = preferencesStore([bskyAppStatePref(nux)])

      await agent.bskyAppRemoveNuxs([nux.id])

      const prefs = await agent.getPreferences()
      const nuxs = prefs.bskyAppState.nuxs

      expect(nuxs.length).toEqual(0)
    })

    it('bskyAppUpsertNux validates nux', async () => {
      const { agent } = preferencesStore()

      await expect(() =>
        // @ts-expect-error
        agent.bskyAppUpsertNux({ name: 'a' }),
      ).rejects.toThrow()
      await expect(() =>
        // @ts-expect-error
        agent.bskyAppUpsertNux({ id: 'a', completed: false, foo: 'bar' }),
      ).rejects.toThrow()
    })
  })

  describe('setPostInteractionSettings', () => {
    const rules: AppBskyActorDefs.PostInteractionSettingsPref = {
      threadgateAllowRules: [{ $type: 'app.bsky.feed.threadgate#mentionRule' }],
      postgateEmbeddingRules: [],
    }

    it('works', async () => {
      const { agent } = preferencesStore()

      await agent.setPostInteractionSettings(rules)

      const prefs = await agent.getPreferences()

      expect(prefs.postInteractionSettings).toEqual(rules)
    })

    it('clears', async () => {
      const { agent } = preferencesStore([
        { $type: 'app.bsky.actor.defs#postInteractionSettingsPref', ...rules },
      ])
      const next: AppBskyActorDefs.PostInteractionSettingsPref = {
        threadgateAllowRules: [],
        postgateEmbeddingRules: [],
      }

      await agent.setPostInteractionSettings(next)

      const prefs = await agent.getPreferences()

      expect(prefs.postInteractionSettings).toEqual(next)
    })

    /**
     * Logic matches threadgate `allow` logic, where `undefined` means "anyone
     * can reply" and an empty array means "no one can reply".
     *
     * Postgate `embeddingRules` behaves differently, where `undefined` and
     * an empty array both mean "no particular rules applied".
     *
     * Both props are optional though, so for easier sharing of types, we
     * allow `undefined`.
     */
    it('clears using undefined', async () => {
      const { agent } = preferencesStore([
        { $type: 'app.bsky.actor.defs#postInteractionSettingsPref', ...rules },
      ])
      const next: AppBskyActorDefs.PostInteractionSettingsPref = {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      }

      await agent.setPostInteractionSettings(next)

      const prefs = await agent.getPreferences()

      expect(prefs.postInteractionSettings).toEqual(next)
    })

    it('validates inputs', async () => {
      const { agent } = preferencesStore()

      await expect(() =>
        agent.setPostInteractionSettings({
          // @ts-expect-error we are testing invalid inputs
          threadgateAllowRules: [{ key: 'string' }],
          postgateEmbeddingRules: [],
        }),
      ).rejects.toThrow()
    })
  })

  describe('setVerificationPrefs', () => {
    it('default state', async () => {
      const { agent } = preferencesStore()
      const next: AppBskyActorDefs.VerificationPrefs = {
        hideBadges: false,
      }
      const prefs = await agent.getPreferences()
      expect(prefs.verificationPrefs).toEqual(next)
    })

    it('updates', async () => {
      const { agent } = preferencesStore()
      const next: AppBskyActorDefs.VerificationPrefs = {
        hideBadges: true,
      }
      await agent.setVerificationPrefs(next)
      const prefs = await agent.getPreferences()
      expect(prefs.verificationPrefs).toEqual(next)
    })
  })

  describe('updateLiveEventPreferences', () => {
    const liveEventPreferences = (
      hiddenFeedIds: string[],
      hideAllFeeds = false,
    ) => ({
      $type: 'app.bsky.actor.defs#liveEventPreferences',
      hiddenFeedIds,
      hideAllFeeds,
    })

    it('default state', async () => {
      const { agent } = preferencesStore()
      const prefs = await agent.getPreferences()
      expect(prefs.liveEventPreferences).toEqual({
        hiddenFeedIds: [],
        hideAllFeeds: false,
      })
    })

    it('hideFeed adds a feed id', async () => {
      const { agent } = preferencesStore()
      await agent.updateLiveEventPreferences({
        type: 'hideFeed',
        id: 'feed1',
      })
      const prefs = await agent.getPreferences()
      expect(prefs.liveEventPreferences).toEqual({
        hiddenFeedIds: ['feed1'],
        hideAllFeeds: false,
      })
    })

    it('hideFeed adds another feed id', async () => {
      const { agent } = preferencesStore([liveEventPreferences(['feed1'])])
      await agent.updateLiveEventPreferences({
        type: 'hideFeed',
        id: 'feed2',
      })
      const prefs = await agent.getPreferences()
      expect(prefs.liveEventPreferences).toEqual({
        hiddenFeedIds: ['feed1', 'feed2'],
        hideAllFeeds: false,
      })
    })

    it('unhideFeed removes a feed id', async () => {
      const { agent } = preferencesStore([
        liveEventPreferences(['feed1', 'feed2']),
      ])
      await agent.updateLiveEventPreferences({
        type: 'unhideFeed',
        id: 'feed1',
      })
      const prefs = await agent.getPreferences()
      expect(prefs.liveEventPreferences).toEqual({
        hiddenFeedIds: ['feed2'],
        hideAllFeeds: false,
      })
    })

    it('toggleHideAllFeeds toggles the flag', async () => {
      const { agent } = preferencesStore([liveEventPreferences(['feed2'])])
      await agent.updateLiveEventPreferences({ type: 'toggleHideAllFeeds' })
      const prefs = await agent.getPreferences()
      expect(prefs.liveEventPreferences).toEqual({
        hiddenFeedIds: ['feed2'],
        hideAllFeeds: true,
      })
    })

    it('toggleHideAllFeeds toggles back', async () => {
      const { agent } = preferencesStore([
        liveEventPreferences(['feed2'], true),
      ])
      await agent.updateLiveEventPreferences({ type: 'toggleHideAllFeeds' })
      const prefs = await agent.getPreferences()
      expect(prefs.liveEventPreferences).toEqual({
        hiddenFeedIds: ['feed2'],
        hideAllFeeds: false,
      })
    })
  })
})

const byType = (a: { $type: string }, b: { $type: string }) =>
  a.$type.localeCompare(b.$type)
