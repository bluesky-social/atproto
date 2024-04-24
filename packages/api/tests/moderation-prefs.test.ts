import { TestNetworkNoAppView } from '@atproto/dev-env'
import { BskyAgent, DEFAULT_LABEL_SETTINGS } from '..'
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
          label: 'porn',
          visibility: 'show',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'nudity',
          visibility: 'show',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'sexual',
          visibility: 'show',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'graphic-media',
          visibility: 'show',
        },
      ],
    })
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: {
        pinned: undefined,
        saved: undefined,
      },
      savedFeeds: expect.any(Array),
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: {
          porn: 'ignore',
          nudity: 'ignore',
          sexual: 'ignore',
          'graphic-media': 'ignore',
        },
        labelers: [
          ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
        ],
        hiddenPosts: [],
        mutedWords: [],
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
      threadViewPrefs: {
        prioritizeFollowedUsers: true,
        sort: 'oldest',
      },
    })
  })

  it('adds/removes moderation services', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user5.test',
      email: 'user5@test.com',
      password: 'password',
    })

    await agent.addLabeler('did:plc:other')
    expect(agent.labelersHeader).toStrictEqual(['did:plc:other'])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      savedFeeds: expect.any(Array),
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: DEFAULT_LABEL_SETTINGS,
        labelers: [
          ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
          {
            did: 'did:plc:other',
            labels: {},
          },
        ],
        hiddenPosts: [],
        mutedWords: [],
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
    })
    expect(agent.labelersHeader).toStrictEqual(['did:plc:other'])

    await agent.removeLabeler('did:plc:other')
    expect(agent.labelersHeader).toStrictEqual([])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      savedFeeds: expect.any(Array),
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: DEFAULT_LABEL_SETTINGS,
        labelers: [
          ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
        ],
        hiddenPosts: [],
        mutedWords: [],
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
    })
    expect(agent.labelersHeader).toStrictEqual([])
  })

  it('sets label preferences globally and per-moderator', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user7.test',
      email: 'user7@test.com',
      password: 'password',
    })

    await agent.addLabeler('did:plc:other')
    await agent.setContentLabelPref('porn', 'ignore')
    await agent.setContentLabelPref('porn', 'hide', 'did:plc:other')
    await agent.setContentLabelPref('x-custom', 'warn', 'did:plc:other')

    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      savedFeeds: expect.any(Array),
      interests: { tags: [] },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: { ...DEFAULT_LABEL_SETTINGS, porn: 'ignore', nsfw: 'ignore' },
        labelers: [
          ...BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
          {
            did: 'did:plc:other',
            labels: {
              porn: 'hide',
              'x-custom': 'warn',
            },
          },
        ],
        hiddenPosts: [],
        mutedWords: [],
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
    })
  })

  it(`updates label pref`, async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user8.test',
      email: 'user8@test.com',
      password: 'password',
    })

    await agent.addLabeler('did:plc:other')
    await agent.setContentLabelPref('porn', 'ignore')
    await agent.setContentLabelPref('porn', 'ignore', 'did:plc:other')
    await agent.setContentLabelPref('porn', 'hide')
    await agent.setContentLabelPref('porn', 'hide', 'did:plc:other')

    const { moderationPrefs } = await agent.getPreferences()
    const labeler = moderationPrefs.labelers.find(
      (l) => l.did === 'did:plc:other',
    )

    expect(moderationPrefs.labels.porn).toEqual('hide')
    expect(labeler?.labels?.porn).toEqual('hide')
  })

  it(`double-write for legacy: 'graphic-media' in sync with 'gore'`, async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user9.test',
      email: 'user9@test.com',
      password: 'password',
    })

    await agent.setContentLabelPref('graphic-media', 'hide')
    const a = await agent.getPreferences()

    expect(a.moderationPrefs.labels.gore).toEqual('hide')
    expect(a.moderationPrefs.labels['graphic-media']).toEqual('hide')

    await agent.setContentLabelPref('graphic-media', 'warn')
    const b = await agent.getPreferences()

    expect(b.moderationPrefs.labels.gore).toEqual('warn')
    expect(b.moderationPrefs.labels['graphic-media']).toEqual('warn')
  })

  it(`double-write for legacy: 'porn' in sync with 'nsfw'`, async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user10.test',
      email: 'user10@test.com',
      password: 'password',
    })

    await agent.setContentLabelPref('porn', 'hide')
    const a = await agent.getPreferences()

    expect(a.moderationPrefs.labels.nsfw).toEqual('hide')
    expect(a.moderationPrefs.labels.porn).toEqual('hide')

    await agent.setContentLabelPref('porn', 'warn')
    const b = await agent.getPreferences()

    expect(b.moderationPrefs.labels.nsfw).toEqual('warn')
    expect(b.moderationPrefs.labels.porn).toEqual('warn')
  })

  it(`double-write for legacy: 'sexual' in sync with 'suggestive'`, async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user11.test',
      email: 'user11@test.com',
      password: 'password',
    })

    await agent.setContentLabelPref('sexual', 'hide')
    const a = await agent.getPreferences()

    expect(a.moderationPrefs.labels.sexual).toEqual('hide')
    expect(a.moderationPrefs.labels.suggestive).toEqual('hide')

    await agent.setContentLabelPref('sexual', 'warn')
    const b = await agent.getPreferences()

    expect(b.moderationPrefs.labels.sexual).toEqual('warn')
    expect(b.moderationPrefs.labels.suggestive).toEqual('warn')
  })

  it(`double-write for legacy: filters out existing old label pref if double-written`, async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user12.test',
      email: 'user12@test.com',
      password: 'password',
    })

    await agent.setContentLabelPref('nsfw', 'hide')
    await agent.setContentLabelPref('porn', 'hide')
    const a = await agent.app.bsky.actor.getPreferences({})

    const nsfwSettings = a.data.preferences.filter(
      (pref) => pref.label === 'nsfw',
    )
    expect(nsfwSettings.length).toEqual(1)
  })

  it(`remaps old values to new on read`, async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    await agent.createAccount({
      handle: 'user13.test',
      email: 'user13@test.com',
      password: 'password',
    })

    await agent.setContentLabelPref('nsfw', 'hide')
    await agent.setContentLabelPref('gore', 'hide')
    await agent.setContentLabelPref('suggestive', 'hide')
    const a = await agent.getPreferences()

    expect(a.moderationPrefs.labels.porn).toEqual('hide')
    expect(a.moderationPrefs.labels['graphic-media']).toEqual('hide')
    expect(a.moderationPrefs.labels['sexual']).toEqual('hide')
  })
})
