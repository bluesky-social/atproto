import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { DidString } from '@atproto/syntax'
import { app, com, tools } from '../src'
import { forSubjectStatusSnapshot } from './_util'

describe('appeal account takedown', () => {
  let network: TestNetwork
  let client: Client
  let sc: SeedClient
  let moderator: DidString

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

    client = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  it('actor takedown allows appeal request.', async () => {
    const account = await client.call(com.atproto.server.createAccount, {
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
    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: account.did,
        },
        takedown: { applied: true },
      },
      {
        headers: { authorization: network.pds.adminAuth() },
      },
    )

    await network.processAll()

    // Verify user can not get session token without setting the optional param
    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: 'jeff.test',
        password: 'password',
      }),
    ).rejects.toThrow('Account has been taken down')

    const auth = await client.call(com.atproto.server.createSession, {
      identifier: 'jeff.test',
      password: 'password',
      allowTakendown: true,
    })

    // send appeal event as the takendown account
    await client.call(
      com.atproto.moderation.createReport,
      {
        reasonType: com.atproto.moderation.defs.reasonAppeal.value,
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
    const result = await client.call(
      tools.ozone.moderation.queryStatuses,
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
    const auth = await client.call(com.atproto.server.createSession, {
      identifier: 'jeff.test',
      password: 'password',
      allowTakendown: true,
    })

    // send appeal event as the takendown account
    await expect(
      client.call(
        com.atproto.moderation.createReport,
        {
          reasonType: com.atproto.moderation.defs.reasonRude.value,
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
    const auth = await client.call(com.atproto.server.createSession, {
      identifier: 'jeff.test',
      password: 'password',
      allowTakendown: true,
    })

    // send appeal event as the takendown account
    await expect(
      client.create(
        app.bsky.feed.post,
        {
          text: 'test',
          createdAt: new Date().toISOString(),
        },
        {
          repo: auth.did,
          headers: { authorization: `Bearer ${auth.accessJwt}` },
        },
      ),
    ).rejects.toThrow('Bad token scope')
  })
})
