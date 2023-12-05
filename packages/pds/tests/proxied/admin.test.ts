import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient } from '@atproto/dev-env'
import basicSeed from '../seeds/basic'
import {
  REASONOTHER,
  REASONSPAM,
} from '@atproto/api/src/client/types/com/atproto/moderation/defs'
import { forSnapshot } from '../_util'
import { NotFoundError } from '@atproto/api/src/client/types/app/bsky/feed/getPostThread'

describe('proxies admin requests', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_admin',
      pds: {
        // @NOTE requires admin pass be the same on pds and appview, which TestNetwork is handling for us.
        bskyAppViewModeration: true,
        inviteRequired: true,
      },
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    const { data: invite } =
      await agent.api.com.atproto.server.createInviteCode(
        { useCount: 10 },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    await basicSeed(sc, {
      inviteCode: invite.code,
      addModLabels: true,
    })
    await network.processAll()
  })

  beforeAll(async () => {
    const { data: invite } =
      await agent.api.com.atproto.server.createInviteCode(
        { useCount: 1, forAccount: sc.dids.alice },
        {
          headers: network.pds.adminAuthHeaders(),
          encoding: 'application/json',
        },
      )
    await agent.api.com.atproto.admin.disableAccountInvites(
      { account: sc.dids.bob },
      { headers: network.pds.adminAuthHeaders(), encoding: 'application/json' },
    )
    await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'password',
      inviteCode: invite.code,
    })
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('creates reports of a repo.', async () => {
    const { data: reportA } =
      await agent.api.com.atproto.moderation.createReport(
        {
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
        },
        {
          headers: sc.getHeaders(sc.dids.alice),
          encoding: 'application/json',
        },
      )
    const { data: reportB } =
      await agent.api.com.atproto.moderation.createReport(
        {
          reasonType: REASONOTHER,
          reason: 'impersonation',
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
        },
        {
          headers: sc.getHeaders(sc.dids.carol),
          encoding: 'application/json',
        },
      )
    expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
  })

  it('takes actions and resolves reports', async () => {
    const post = sc.posts[sc.dids.bob][1]
    const { data: actionA } =
      await agent.api.com.atproto.admin.emitModerationEvent(
        {
          event: { $type: 'com.atproto.admin.defs#modEventAcknowledge' },
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: post.ref.uriStr,
            cid: post.ref.cidStr,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          headers: network.pds.adminAuthHeaders(),
          encoding: 'application/json',
        },
      )
    expect(forSnapshot(actionA)).toMatchSnapshot()
    const { data: actionB } =
      await agent.api.com.atproto.admin.emitModerationEvent(
        {
          event: { $type: 'com.atproto.admin.defs#modEventAcknowledge' },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          headers: network.pds.adminAuthHeaders(),
          encoding: 'application/json',
        },
      )
    expect(forSnapshot(actionB)).toMatchSnapshot()
  })

  it('fetches moderation events.', async () => {
    const { data: result } =
      await agent.api.com.atproto.admin.queryModerationEvents(
        {
          subject: sc.posts[sc.dids.bob][1].ref.uriStr,
        },
        { headers: network.pds.adminAuthHeaders() },
      )
    expect(forSnapshot(result.events)).toMatchSnapshot()
  })
  it('fetches repo details.', async () => {
    const { data: result } = await agent.api.com.atproto.admin.getRepo(
      { did: sc.dids.eve },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches record details.', async () => {
    const post = sc.posts[sc.dids.bob][1]
    const { data: result } = await agent.api.com.atproto.admin.getRecord(
      { uri: post.ref.uriStr },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches event details.', async () => {
    const { data: result } =
      await agent.api.com.atproto.admin.getModerationEvent(
        { id: 2 },
        { headers: network.pds.adminAuthHeaders() },
      )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches a list of events.', async () => {
    const { data: result } =
      await agent.api.com.atproto.admin.queryModerationEvents(
        { subject: sc.dids.bob },
        { headers: network.pds.adminAuthHeaders() },
      )
    expect(forSnapshot(result.events)).toMatchSnapshot()
  })

  it('searches repos.', async () => {
    const { data: result } = await agent.api.com.atproto.admin.searchRepos(
      { term: 'alice' },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(forSnapshot(result.repos)).toMatchSnapshot()
  })

  it('passes through errors.', async () => {
    const tryGetRepo = agent.api.com.atproto.admin.getRepo(
      { did: 'did:does:not:exist' },
      { headers: network.pds.adminAuthHeaders() },
    )
    await expect(tryGetRepo).rejects.toThrow('Repo not found')
    const tryGetRecord = agent.api.com.atproto.admin.getRecord(
      { uri: 'at://did:does:not:exist/bad.collection.name/badrkey' },
      { headers: network.pds.adminAuthHeaders() },
    )
    await expect(tryGetRecord).rejects.toThrow('Record not found')
  })

  it('takesdown and labels repos, and reverts.', async () => {
    // takedown repo
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: { $type: 'com.atproto.admin.defs#modEventTakedown' },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
        createLabelVals: ['dogs'],
        negateLabelVals: ['cats'],
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )
    // check profile and labels
    const tryGetProfileAppview = agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.alice },
      {
        headers: { ...sc.getHeaders(sc.dids.carol) },
      },
    )
    await expect(tryGetProfileAppview).rejects.toThrow(
      'Account has been taken down',
    )
    // reverse action
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        event: {
          $type: 'com.atproto.admin.defs#modEventReverseTakedown',
        },
        createdBy: 'did:example:admin',
        reason: 'X',
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )
    // check profile and labels
    const { data: profileAppview } = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.alice },
      {
        headers: { ...sc.getHeaders(sc.dids.carol) },
      },
    )
    expect(profileAppview).toEqual(
      expect.objectContaining({ did: sc.dids.alice, handle: 'alice.test' }),
    )
  })

  it('takesdown and labels records, and reverts.', async () => {
    const post = sc.posts[sc.dids.alice][0]
    // takedown post
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: { $type: 'com.atproto.admin.defs#modEventTakedown' },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
        createLabelVals: ['dogs'],
        negateLabelVals: ['cats'],
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )
    // check thread and labels
    const tryGetPost = agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr, depth: 0 },
      { headers: sc.getHeaders(sc.dids.carol) },
    )
    await expect(tryGetPost).rejects.toThrow(NotFoundError)
    // reverse action
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        event: { $type: 'com.atproto.admin.defs#modEventReverseTakedown' },
        createdBy: 'did:example:admin',
        reason: 'X',
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )
    // check thread and labels
    const { data: threadAppview } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr, depth: 0 },
      {
        headers: { ...sc.getHeaders(sc.dids.carol) },
      },
    )
    expect(threadAppview.thread.post).toEqual(
      expect.objectContaining({ uri: post.ref.uriStr, cid: post.ref.cidStr }),
    )
  })
})
