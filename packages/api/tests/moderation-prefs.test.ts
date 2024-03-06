import { TestNetworkNoAppView } from '@atproto/dev-env'
import { BskyAgent, BSKY_MODSERVICE_DID, DEFAULT_LABEL_SETTINGS } from '..'
import './util/moderation-behavior'

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

  it('migrates legacy content-label prefs (no mutations)', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user1.test',
      email: 'user1@test.com',
      password: 'password',
    })

    await agent.app.bsky.actor.putPreferences({
      preferences: [
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'nsfw',
          visibility: 'show',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'nudity',
          visibility: 'show',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'suggestive',
          visibility: 'show',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'gore',
          visibility: 'show',
        },
      ],
    })
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: {
        pinned: undefined,
        saved: undefined,
      },
      hiddenPosts: [],
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: {
          porn: 'ignore',
          nudity: 'ignore',
          sexual: 'ignore',
          gore: 'ignore',
        },
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            labels: {},
          },
        ],
      },
      birthDate: undefined,
      feedViewPrefs: {
        home: {
          hideQuotePosts: false,
          hideReplies: false,
          hideRepliesByLikeCount: 0,
          hideRepliesByUnfollowed: true,
          hideReposts: false,
        },
      },
      mutedWords: [],
      threadViewPrefs: {
        prioritizeFollowedUsers: true,
        sort: 'oldest',
      },
    })
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
  })

  it('adds/removes moderation services', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user5.test',
      email: 'user5@test.com',
      password: 'password',
    })

    await agent.addModService('did:plc:other')
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      hiddenPosts: [],
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: DEFAULT_LABEL_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            labels: {},
          },
          {
            did: 'did:plc:other',
            labels: {},
          },
        ],
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
      mutedWords: [],
      threadViewPrefs: {
        sort: 'oldest',
        prioritizeFollowedUsers: true,
      },
    })
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])

    await agent.removeModService('did:plc:other')
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      hiddenPosts: [],
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: DEFAULT_LABEL_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            labels: {},
          },
        ],
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
      mutedWords: [],
      threadViewPrefs: {
        sort: 'oldest',
        prioritizeFollowedUsers: true,
      },
    })
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
  })

  it('cant remove the default moderation service', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user6.test',
      email: 'user6@test.com',
      password: 'password',
    })

    await agent.removeModService(BSKY_MODSERVICE_DID)
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      hiddenPosts: [],
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: DEFAULT_LABEL_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            labels: {},
          },
        ],
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
      mutedWords: [],
      threadViewPrefs: {
        sort: 'oldest',
        prioritizeFollowedUsers: true,
      },
    })
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
  })

  it('sets label preferences globally and per-moderator', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user7.test',
      email: 'user7@test.com',
      password: 'password',
    })

    await agent.addModService('did:plc:other')
    await agent.setContentLabelPref('porn', 'ignore')
    await agent.setContentLabelPref('porn', 'hide', 'did:plc:other')
    await agent.setContentLabelPref('x-custom', 'warn', 'did:plc:other')

    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      hiddenPosts: [],
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: { ...DEFAULT_LABEL_SETTINGS, porn: 'ignore' },
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            labels: {},
          },
          {
            did: 'did:plc:other',
            labels: {
              porn: 'hide',
              'x-custom': 'warn',
            },
          },
        ],
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
      mutedWords: [],
      threadViewPrefs: {
        sort: 'oldest',
        prioritizeFollowedUsers: true,
      },
    })
  })
})
