import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import {
  REASONOTHER,
  REASONSPAM,
} from '@atproto/api/src/client/types/com/atproto/moderation/defs'
import { forSnapshot } from '../_util'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
} from '@atproto/api/src/client/types/com/atproto/admin/defs'
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
    sc = new SeedClient(agent)
    const { data: invite } =
      await agent.api.com.atproto.server.createInviteCode(
        { useCount: 10 },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    await basicSeed(sc, invite)
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
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: FLAG,
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
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: ACKNOWLEDGE,
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
    const { data: resolved } =
      await agent.api.com.atproto.admin.resolveModerationReports(
        {
          actionId: actionA.id,
          reportIds: [1, 2],
          createdBy: 'did:example:admin',
        },
        {
          headers: network.pds.adminAuthHeaders(),
          encoding: 'application/json',
        },
      )
    expect(forSnapshot(resolved)).toMatchSnapshot()
  })

  it('fetches report details.', async () => {
    const { data: result } =
      await agent.api.com.atproto.admin.getModerationReport(
        { id: 1 },
        { headers: network.pds.adminAuthHeaders() },
      )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches a list of reports.', async () => {
    const { data: result } =
      await agent.api.com.atproto.admin.getModerationReports(
        { reverse: true },
        { headers: network.pds.adminAuthHeaders() },
      )
    expect(forSnapshot(result)).toMatchSnapshot()
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

  it('reverses action.', async () => {
    const { data: result } =
      await agent.api.com.atproto.admin.reverseModerationAction(
        { id: 3, createdBy: 'did:example:admin', reason: 'X' },
        {
          headers: network.pds.adminAuthHeaders(),
          encoding: 'application/json',
        },
      )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches action details.', async () => {
    const { data: result } =
      await agent.api.com.atproto.admin.getModerationAction(
        { id: 3 },
        { headers: network.pds.adminAuthHeaders() },
      )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches a list of actions.', async () => {
    const { data: result } =
      await agent.api.com.atproto.admin.getModerationActions(
        { subject: sc.dids.bob },
        { headers: network.pds.adminAuthHeaders() },
      )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('searches repos.', async () => {
    const { data: result } = await agent.api.com.atproto.admin.searchRepos(
      { term: 'alice' },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(forSnapshot(result.repos)).toMatchSnapshot()
  })

  it('passes through errors.', async () => {
    const tryGetReport = agent.api.com.atproto.admin.getModerationReport(
      { id: 1000 },
      { headers: network.pds.adminAuthHeaders() },
    )
    await expect(tryGetReport).rejects.toThrow('Report not found')
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
    const { db, services } = network.bsky.ctx
    // takedown repo
    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
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
        headers: { ...sc.getHeaders(sc.dids.carol), 'x-appview-proxy': 'true' },
      },
    )
    await expect(tryGetProfileAppview).rejects.toThrow(
      'Account has been taken down',
    )
    const labelsA = await services
      .label(db.getPrimary())
      .getLabels(sc.dids.alice, { includeNeg: false, skipCache: true })
    expect(labelsA.map((l) => l.val)).toEqual(['dogs'])
    // reverse action
    await agent.api.com.atproto.admin.reverseModerationAction(
      { id: action.id, createdBy: 'did:example:admin', reason: 'X' },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )
    // check profile and labels
    const { data: profileAppview } = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.alice },
      {
        headers: { ...sc.getHeaders(sc.dids.carol), 'x-appview-proxy': 'true' },
      },
    )
    expect(profileAppview).toEqual(
      expect.objectContaining({ did: sc.dids.alice, handle: 'alice.test' }),
    )
    const labelsB = await services
      .label(db.getPrimary())
      .getLabels(sc.dids.alice, { includeNeg: false, skipCache: true })
    expect(labelsB.map((l) => l.val)).toEqual(['cats'])
  })

  it('takesdown and labels records, and reverts.', async () => {
    const { db, services } = network.bsky.ctx
    const post = sc.posts[sc.dids.alice][0]
    // takedown post
    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
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
    const tryGetPostAppview = agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr, depth: 0 },
      {
        headers: { ...sc.getHeaders(sc.dids.carol), 'x-appview-proxy': 'true' },
      },
    )
    await expect(tryGetPostAppview).rejects.toThrow(NotFoundError)
    const labelsA = await services
      .label(db.getPrimary())
      .getLabels(post.ref.uriStr, { includeNeg: false, skipCache: true })
    expect(labelsA.map((l) => l.val)).toEqual(['dogs'])
    // reverse action
    await agent.api.com.atproto.admin.reverseModerationAction(
      { id: action.id, createdBy: 'did:example:admin', reason: 'X' },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )
    // check thread and labels
    const { data: threadAppview } = await agent.api.app.bsky.feed.getPostThread(
      { uri: post.ref.uriStr, depth: 0 },
      {
        headers: { ...sc.getHeaders(sc.dids.carol), 'x-appview-proxy': 'true' },
      },
    )
    expect(threadAppview.thread.post).toEqual(
      expect.objectContaining({ uri: post.ref.uriStr, cid: post.ref.cidStr }),
    )
    const labelsB = await services
      .label(db.getPrimary())
      .getLabels(post.ref.uriStr, { includeNeg: false, skipCache: true })
    expect(labelsB.map((l) => l.val)).toEqual(['cats'])
  })

  it('does not persist actions and reports on pds.', async () => {
    const { db } = network.pds.ctx
    const actions = await db.db
      .selectFrom('moderation_action')
      .selectAll()
      .execute()
    const reports = await db.db
      .selectFrom('moderation_report')
      .selectAll()
      .execute()
    expect(actions).toEqual([])
    expect(reports).toEqual([])
  })
})
