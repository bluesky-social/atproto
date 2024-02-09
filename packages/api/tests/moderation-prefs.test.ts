import { TestNetworkNoAppView } from '@atproto/dev-env'
import {
  BskyAgent,
  BSKY_MODSERVICE_DID,
  DEFAULT_LABEL_GROUP_SETTINGS,
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

  it('migrates legacy content-label prefs (no mutations)', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user1.test',
      email: 'user1@test.com',
      password: 'password',
    })
    const userDid = userRes.data.did

    await agent.app.bsky.actor.putPreferences({
      preferences: [
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'nsfw',
          visibility: 'ignore',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'nudity',
          visibility: 'ignore',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'suggestive',
          visibility: 'ignore',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'gore',
          visibility: 'ignore',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'hate',
          visibility: 'ignore',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'spam',
          visibility: 'ignore',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'impersonation',
          visibility: 'ignore',
        },
      ],
    })
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: {
        pinned: undefined,
        saved: undefined,
      },
      moderationOpts: {
        userDid,
        adultContentEnabled: false,
        labelGroups: {
          ...DEFAULT_LABEL_GROUP_SETTINGS,
          porn: 'ignore',
          nudity: 'ignore',
          suggestive: 'ignore',
          violence: 'ignore',
          intolerance: 'ignore',
          spam: 'ignore',
          misinfo: 'ignore',
        },
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            enabled: true,
          },
        ],
      },
      birthDate: undefined,
      feedViewPrefs: {
        home: {
          hideQuotePosts: false,
          hideReplies: false,
          hideRepliesByLikeCount: 0,
          hideRepliesByUnfollowed: false,
          hideReposts: false,
        },
      },
      threadViewPrefs: {
        prioritizeFollowedUsers: true,
        sort: 'oldest',
      },
    })
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
  })

  it('adds a moderation service when first setting a label group enabled/disabled', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user4.test',
      email: 'user4@test.com',
      password: 'password',
    })
    const userDid = userRes.data.did

    await agent.setModServiceLabelGroupEnabled('did:plc:other', 'spam', false)
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      moderationOpts: {
        userDid,
        adultContentEnabled: false,
        labelGroups: DEFAULT_LABEL_GROUP_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            enabled: true,
          },
          {
            did: 'did:plc:other',
            enabled: true,
            disabledLabelGroups: ['spam'],
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
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])
  })

  it('enables/disables moderation services', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user5.test',
      email: 'user5@test.com',
      password: 'password',
    })
    const userDid = userRes.data.did

    await agent.addModService('did:plc:other')
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      moderationOpts: {
        userDid,
        adultContentEnabled: false,
        labelGroups: DEFAULT_LABEL_GROUP_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            enabled: true,
          },
          {
            did: 'did:plc:other',
            enabled: true,
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
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])

    await agent.setModServiceEnabled('did:plc:other', false)
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      moderationOpts: {
        userDid,
        adultContentEnabled: false,
        labelGroups: DEFAULT_LABEL_GROUP_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            enabled: true,
          },
          {
            did: 'did:plc:other',
            enabled: false,
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
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])

    await agent.setModServiceEnabled('did:plc:other', true)
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      moderationOpts: {
        userDid,
        adultContentEnabled: false,
        labelGroups: DEFAULT_LABEL_GROUP_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            enabled: true,
          },
          {
            did: 'did:plc:other',
            enabled: true,
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
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])
  })

  it('cant disable the default moderation service', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user6.test',
      email: 'user6@test.com',
      password: 'password',
    })
    const userDid = userRes.data.did

    await agent.setModServiceEnabled(BSKY_MODSERVICE_DID, false)
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      moderationOpts: {
        userDid,
        adultContentEnabled: false,
        labelGroups: DEFAULT_LABEL_GROUP_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            enabled: true,
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
    expect(agent.labelersHeader).toStrictEqual([BSKY_MODSERVICE_DID])
  })

  it('adds a moderation service when first setting enabled', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user7.test',
      email: 'user7@test.com',
      password: 'password',
    })
    const userDid = userRes.data.did

    await agent.setModServiceEnabled('did:plc:other', true)
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      moderationOpts: {
        userDid,
        adultContentEnabled: false,
        labelGroups: DEFAULT_LABEL_GROUP_SETTINGS,
        mods: [
          {
            did: BSKY_MODSERVICE_DID,
            enabled: true,
          },
          {
            did: 'did:plc:other',
            enabled: true,
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
    expect(agent.labelersHeader).toStrictEqual([
      BSKY_MODSERVICE_DID,
      'did:plc:other',
    ])
  })
})
