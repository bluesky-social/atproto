import { TestNetworkNoAppView } from '@atproto/dev-env'
import {
  BskyAgent,
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
      moderationPrefs: {
        userDid,
        adultContentEnabled: false,
        labelGroups: {},
        labelers: [
          {
            labeler: { did: BSKY_MODSERVICE_DID },
            labelGroups: {
              porn: 'ignore',
              nudity: 'ignore',
              suggestive: 'ignore',
              violence: 'ignore',
              intolerance: 'ignore',
              spam: 'ignore',
              misinfo: 'ignore',
            },
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
  })

  it('migrates legacy content-label prefs (default service added)', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user8.test',
      email: 'user8@test.com',
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
    await agent.addModService(BSKY_MODSERVICE_DID)
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: {
        pinned: undefined,
        saved: undefined,
      },
      moderationPrefs: {
        userDid,
        adultContentEnabled: false,
        labelGroups: {},
        labelers: [
          {
            labeler: { did: BSKY_MODSERVICE_DID },
            labelGroups: {
              porn: 'ignore',
              nudity: 'ignore',
              suggestive: 'ignore',
              violence: 'ignore',
              intolerance: 'ignore',
              spam: 'ignore',
              misinfo: 'ignore',
            },
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
    await agent.setModServiceLabelGroupPref(
      BSKY_MODSERVICE_DID,
      'intolerance',
      'hide',
    )
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: {
        pinned: undefined,
        saved: undefined,
      },
      moderationPrefs: {
        userDid,
        adultContentEnabled: false,
        labelGroups: {},
        labelers: [
          {
            labeler: { did: BSKY_MODSERVICE_DID },
            labelGroups: {
              porn: 'ignore',
              nudity: 'ignore',
              suggestive: 'ignore',
              violence: 'ignore',
              intolerance: 'hide',
              spam: 'ignore',
              misinfo: 'ignore',
            },
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
  })

  it('migrates legacy content-label prefs (other service added)', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user2.test',
      email: 'user2@test.com',
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
    await agent.addModService('did:plc:other')
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: {
        pinned: undefined,
        saved: undefined,
      },
      moderationPrefs: {
        userDid,
        adultContentEnabled: false,
        labelGroups: {},
        labelers: [
          {
            labeler: { did: 'did:plc:other' },
            labelGroups: DEFAULT_LABELGROUP_PREFERENCES,
          },
          {
            labeler: { did: BSKY_MODSERVICE_DID },
            labelGroups: {
              porn: 'ignore',
              nudity: 'ignore',
              suggestive: 'ignore',
              violence: 'ignore',
              intolerance: 'ignore',
              spam: 'ignore',
              misinfo: 'ignore',
            },
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
  })

  it('migrates legacy content-label prefs (modify default service settings)', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user3.test',
      email: 'user3@test.com',
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
    await agent.setModServiceLabelGroupPref(
      BSKY_MODSERVICE_DID,
      'intolerance',
      'hide',
    )
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: {
        pinned: undefined,
        saved: undefined,
      },
      moderationPrefs: {
        userDid,
        adultContentEnabled: false,
        labelGroups: {},
        labelers: [
          {
            labeler: { did: BSKY_MODSERVICE_DID },
            labelGroups: {
              porn: 'ignore',
              nudity: 'ignore',
              suggestive: 'ignore',
              violence: 'ignore',
              intolerance: 'hide',
              spam: 'ignore',
              misinfo: 'ignore',
            },
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
  })

  it('adds a moderation service when first setting a label pref', async () => {
    const agent = new BskyAgent({ service: network.pds.url })

    const userRes = await agent.createAccount({
      handle: 'user4.test',
      email: 'user4@test.com',
      password: 'password',
    })
    const userDid = userRes.data.did

    await agent.setModServiceLabelGroupPref('did:plc:other', 'spam', 'ignore')
    await expect(agent.getPreferences()).resolves.toStrictEqual({
      feeds: { pinned: undefined, saved: undefined },
      moderationPrefs: {
        userDid,
        adultContentEnabled: false,
        labelGroups: {},
        labelers: [
          {
            labeler: { did: 'did:plc:other' },
            labelGroups: {
              ...DEFAULT_LABELGROUP_PREFERENCES,
              ...{ spam: 'ignore' },
            },
          },
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
  })
})
