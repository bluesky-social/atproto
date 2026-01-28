import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { app, com, tools } from '../../dist'
import { forSnapshot } from '../_util'
import basicSeed from '../seeds/basic'

describe('proxies admin requests', () => {
  let network: TestNetwork
  let client: Client
  let sc: SeedClient

  let moderator: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_admin',
      pds: {
        inviteRequired: true,
      },
    })
    client = network.pds.getClient()
    sc = network.getSeedClient()
    const invite = await client.call(
      com.atproto.server.createInviteCode,
      { useCount: 10 },
      { headers: network.pds.adminAuthHeaders() },
    )
    await basicSeed(sc, {
      inviteCode: invite.code,
      addModLabels: network.bsky,
    })
    const modAccount = await sc.createAccount('moderator', {
      handle: 'testmod.test',
      email: 'testmod@test.com',
      password: 'testmod-pass',
      inviteCode: invite.code,
    })
    moderator = modAccount.did
    await network.ozone.addModeratorDid(moderator)

    await network.processAll()
  })

  beforeAll(async () => {
    const invite = await client.call(
      com.atproto.server.createInviteCode,
      { useCount: 1, forAccount: sc.dids.alice },
      { headers: network.pds.adminAuthHeaders() },
    )
    await client.call(
      com.atproto.admin.disableAccountInvites,
      { account: sc.dids.bob },
      { headers: network.pds.adminAuthHeaders() },
    )
    await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'password',
      inviteCode: invite.code,
    })
  })

  beforeEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('creates reports of a repo.', async () => {
    const reportA = await client.call(
      com.atproto.moderation.createReport,
      {
        reasonType: 'com.atproto.moderation.defs#reasonSpam',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    const reportB = await client.call(
      com.atproto.moderation.createReport,
      {
        reasonType: 'com.atproto.moderation.defs#reasonOther',
        reason: 'impersonation',
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      },
      { headers: sc.getHeaders(sc.dids.carol) },
    )
    expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
  })

  it('takes actions and resolves reports', async () => {
    const post = sc.posts[sc.dids.bob][1]
    const actionA = await client.call(
      tools.ozone.moderation.emitEvent,
      {
        event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        createdBy: 'did:example:admin',
        // @ts-expect-error
        reason: 'Y',
      },
      { headers: sc.getHeaders(moderator) },
    )
    expect(forSnapshot(actionA)).toMatchSnapshot()
    const actionB = await client.call(
      tools.ozone.moderation.emitEvent,
      {
        event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
        createdBy: 'did:example:admin',
        // @ts-expect-error
        reason: 'Y',
      },
      { headers: sc.getHeaders(moderator) },
    )
    expect(forSnapshot(actionB)).toMatchSnapshot()
  })

  it('fetches moderation events.', async () => {
    const result = await client.call(
      tools.ozone.moderation.queryEvents,
      {
        subject: sc.posts[sc.dids.bob][1].ref.uriStr,
      },
      { headers: sc.getHeaders(moderator) },
    )
    expect(forSnapshot(result.events)).toMatchSnapshot()
  })

  it('fetches repo details.', async () => {
    const result = await client.call(
      tools.ozone.moderation.getRepo,
      { did: sc.dids.eve },
      { headers: sc.getHeaders(moderator) },
    )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches record details.', async () => {
    const post = sc.posts[sc.dids.bob][1]
    const result = await client.call(
      tools.ozone.moderation.getRecord,
      { uri: post.ref.uriStr },
      { headers: sc.getHeaders(moderator) },
    )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches event details.', async () => {
    const result = await client.call(
      tools.ozone.moderation.getEvent,
      { id: 2 },
      { headers: sc.getHeaders(moderator) },
    )
    expect(forSnapshot(result)).toMatchSnapshot()
  })

  it('fetches a list of events.', async () => {
    const result = await client.call(
      tools.ozone.moderation.queryEvents,
      { subject: sc.dids.bob },
      { headers: sc.getHeaders(moderator) },
    )
    expect(forSnapshot(result.events)).toMatchSnapshot()
  })

  it('searches repos.', async () => {
    const result = await client.call(
      tools.ozone.moderation.searchRepos,
      { term: 'alice' },
      { headers: sc.getHeaders(moderator) },
    )
    expect(forSnapshot(result.repos)).toMatchSnapshot()
  })

  it('passes through errors.', async () => {
    const tryGetRepo = client.call(
      tools.ozone.moderation.getRepo,
      { did: 'did:does:not:exist' },
      { headers: sc.getHeaders(moderator) },
    )
    await expect(tryGetRepo).rejects.toThrow('Repo not found')
    const tryGetRecord = client.call(
      tools.ozone.moderation.getRecord,
      { uri: 'at://did:does:not:exist/bad.collection.name/badrkey' },
      { headers: sc.getHeaders(moderator) },
    )
    await expect(tryGetRecord).rejects.toThrow('Could not locate record')
  })

  it('takesdown and labels repos, and reverts.', async () => {
    // takedown repo
    await client.call(
      tools.ozone.moderation.emitEvent,
      {
        event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        createdBy: 'did:example:admin',
        // @ts-expect-error
        reason: 'Y',
        createLabelVals: ['dogs'],
        negateLabelVals: ['cats'],
      },
      { headers: sc.getHeaders(moderator) },
    )
    await network.processAll()
    // check profile and labels
    const tryGetProfileAppview = client.call(
      app.bsky.actor.getProfile,
      { actor: sc.dids.alice },
      { headers: { ...sc.getHeaders(sc.dids.carol) } },
    )
    await expect(tryGetProfileAppview).rejects.toThrow(
      'Account has been suspended',
    )
    // reverse action
    await client.call(
      tools.ozone.moderation.emitEvent,
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        },
        createdBy: 'did:example:admin',
        // @ts-expect-error
        reason: 'X',
      },
      { headers: sc.getHeaders(moderator) },
    )
    await network.processAll()
    // check profile and labels
    const profileAppview = await client.call(
      app.bsky.actor.getProfile,
      { actor: sc.dids.alice },
      { headers: { ...sc.getHeaders(sc.dids.carol) } },
    )
    expect(profileAppview).toEqual(
      expect.objectContaining({ did: sc.dids.alice, handle: 'alice.test' }),
    )
  })

  it('takesdown and labels records, and reverts.', async () => {
    const post = sc.posts[sc.dids.alice][0]
    // takedown post
    await client.call(
      tools.ozone.moderation.emitEvent,
      {
        event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        createdBy: 'did:example:admin',
        // @ts-expect-error
        reason: 'Y',
        createLabelVals: ['dogs'],
        negateLabelVals: ['cats'],
      },
      { headers: sc.getHeaders(moderator) },
    )
    await network.processAll()

    // check takedown label has been created
    const label = await network.ozone.ctx.db.db
      .selectFrom('label')
      .selectAll()
      .where('val', '=', '!takedown')
      .where('uri', '=', post.ref.uriStr)
      .where('cid', '=', post.ref.cidStr)
      .executeTakeFirst()
    expect(label).toBeDefined()
    expect(label?.neg).toBe(false)

    // reverse action
    await client.call(
      tools.ozone.moderation.emitEvent,
      {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        event: { $type: 'tools.ozone.moderation.defs#modEventReverseTakedown' },
        createdBy: 'did:example:admin',
        // @ts-expect-error
        reason: 'X',
      },
      { headers: sc.getHeaders(moderator) },
    )
    await network.processAll()

    // check takedown label has been negated
    const labelNeg = await network.ozone.ctx.db.db
      .selectFrom('label')
      .selectAll()
      .where('val', '=', '!takedown')
      .where('uri', '=', post.ref.uriStr)
      .where('cid', '=', post.ref.cidStr)
      .executeTakeFirst()
    expect(labelNeg?.neg).toBe(true)
  })
})
