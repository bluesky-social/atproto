import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { forSnapshot } from './_util'

describe('account action appeal', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let moderator: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'auth',
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

    // Manually set the account as takendown at the PDS level
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

    // Verify user can not get session token
    await expect(
      agent.com.atproto.server.createSession({
        identifier: 'jeff.test',
        password: 'password',
      }),
    ).rejects.toThrow('Account has been taken down')

    // send appeal event as the takendown account
    await agent.com.atproto.server.appealAccountAction({
      identifier: 'jeff.test',
      password: 'password',
      comment: 'I want my account back',
    })

    // Verify that the appeal was created
    const { data: result } = await agent.tools.ozone.moderation.queryStatuses(
      {
        subject: account.did,
      },
      { headers: sc.getHeaders(moderator) },
    )

    expect(result.subjectStatuses[0].appealed).toBe(true)
    expect(forSnapshot(result.subjectStatuses[0])).toMatchSnapshot()
  })

  it('does not allow appeal from active account.', async () => {
    await agent.com.atproto.server.createAccount({
      handle: 'jeff2.test',
      email: 'jeff2@test.com',
      password: 'password',
    })

    // send appeal event as the takendown account
    await expect(
      agent.com.atproto.server.appealAccountAction({
        identifier: 'jeff2.test',
        password: 'password',
        comment: 'I want my account back',
      }),
    ).rejects.toThrow('No account action found')
  })
})
