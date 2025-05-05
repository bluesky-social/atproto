import { AtpAgent, ComAtprotoModerationDefs } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { forSubjectStatusSnapshot } from './_util'

describe('appeal account takedown', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let moderator: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'takedown_appeal',
    })
    sc = network.getSeedClient()
    const modAccount = await sc.createAccount('moderator', {
      handle: 'testmod.test',
      email: 'testmod@test.com',
      password: 'testmod-pass',
    })
    moderator = modAccount.did
    await network.ozone.addModeratorDid(moderator)

    agent = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  it('actor takedown allows appeal request.', async () => {
    const { data: account } = await agent.com.atproto.server.createAccount({
      handle: 'jeff.test',
      email: 'jeff@test.com',
      password: 'password',
    })
    await network.processAll()

    // Emit a takedown event
    await network.ozone.getModClient().performTakedown({
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: account.did,
      },
    })

    // Manually set the account as takendown at the PDS level
    // since the takedown event only propagates when the daemon is running
    await agent.com.atproto.admin.updateSubjectStatus(
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: account.did,
        },
        takedown: { applied: true },
      },
      {
        encoding: 'application/json',
        headers: { authorization: network.pds.adminAuth() },
      },
    )

    await network.processAll()

    // Verify user can not get session token without setting the optional param
    await expect(
      agent.com.atproto.server.createSession({
        identifier: 'jeff.test',
        password: 'password',
      }),
    ).rejects.toThrow('Account has been taken down')

    const { data: auth } = await agent.com.atproto.server.createSession({
      identifier: 'jeff.test',
      password: 'password',
      allowTakendown: true,
    })

    // send appeal event as the takendown account
    await agent.com.atproto.moderation.createReport(
      {
        reasonType: ComAtprotoModerationDefs.REASONAPPEAL,
        reason: 'I want my account back',
        subject: { $type: 'com.atproto.admin.defs#repoRef', did: account.did },
      },
      {
        headers: {
          authorization: `Bearer ${auth.accessJwt}`,
        },
      },
    )

    // Verify that the appeal was created
    const { data: result } = await agent.tools.ozone.moderation.queryStatuses(
      {
        subject: account.did,
      },
      { headers: sc.getHeaders(moderator) },
    )

    expect(result.subjectStatuses[0].appealed).toBe(true)
    expect(
      forSubjectStatusSnapshot(result.subjectStatuses[0]),
    ).toMatchSnapshot()
  })

  it('takendown actor is not allowed to create reports.', async () => {
    const { data: auth } = await agent.com.atproto.server.createSession({
      identifier: 'jeff.test',
      password: 'password',
      allowTakendown: true,
    })

    // send appeal event as the takendown account
    await expect(
      agent.com.atproto.moderation.createReport(
        {
          reasonType: ComAtprotoModerationDefs.REASONRUDE,
          reason: 'reporting others',
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: 'did:plc:test',
          },
        },
        {
          headers: {
            authorization: `Bearer ${auth.accessJwt}`,
          },
        },
      ),
    ).rejects.toThrow('Report not accepted from takendown account')
  })
  it('takendown actor is not allowed to create records.', async () => {
    const { data: auth } = await agent.com.atproto.server.createSession({
      identifier: 'jeff.test',
      password: 'password',
      allowTakendown: true,
    })

    // send appeal event as the takendown account
    await expect(
      agent.com.atproto.repo.createRecord(
        {
          repo: auth.did,
          collection: ids.AppBskyFeedPost,
          // rkey: 'self',
          record: {
            text: 'test',
            createdAt: new Date().toISOString(),
          },
        },
        {
          headers: {
            authorization: `Bearer ${auth.accessJwt}`,
          },
          encoding: 'application/json',
        },
      ),
    ).rejects.toThrow('Bad token scope')
  })
})
