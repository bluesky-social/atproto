import { jest } from '@jest/globals'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import type { Client } from '@atproto/lex'
import { com } from '../src/lexicons/index.js'

describe('account-status', () => {
  let network: TestNetworkNoAppView
  let client: Client

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_status',
    })
    client = network.pds.getClient()
  })

  afterEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('takedown + activation triggers an error', async () => {
    const { did } = await client.call(com.atproto.server.createAccount, {
      handle: 'iris.test',
      email: 'iris@test.com',
      password: 'password',
    })

    await expect(
      client.call(
        com.atproto.admin.updateSubjectStatus,
        {
          subject: com.atproto.admin.defs.repoRef.$build({ did }),
          takedown: { applied: true },
          deactivated: { applied: false },
        },
        { headers: { authorization: network.pds.adminAuth() } },
      ),
    ).rejects.toMatchObject({
      error: 'InvalidRequest',
      message: 'Cannot activate and takedown an account at the same time',
    })
  })

  it('activating a taken down account causes an error', async () => {
    const { did } = await client.call(com.atproto.server.createAccount, {
      handle: 'iris2.test',
      email: 'iris2@test.com',
      password: 'password',
    })

    const mock = jest.spyOn(network.pds.ctx.sequencer, 'sequenceEvts')

    // First deactivate
    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
        deactivated: { applied: true },
      },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    expect(mock).toHaveBeenCalledTimes(1)

    // Then takedown
    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
        takedown: { applied: true },
      },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    expect(mock).toHaveBeenCalledTimes(2)

    // Then remove the takedown
    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
        takedown: { applied: false },
      },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    expect(mock).toHaveBeenCalledTimes(3)

    // Then try to activate again (should work now)
    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
        deactivated: { applied: false },
      },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    expect(mock).toHaveBeenCalledTimes(4)

    // Attempt login to ensure account is active
    await client.call(com.atproto.server.createSession, {
      identifier: 'iris2.test',
      password: 'password',
    })

    // @TODO use "using" (requires updating jest)
    mock.mockRestore()
  })

  it('sequences an account status event when calling updateSubjectStatus without changing the status', async () => {
    const { did } = await client.call(com.atproto.server.createAccount, {
      handle: 'iris3.test',
      email: 'iris3@test.com',
      password: 'password',
    })

    const mock = jest.spyOn(network.pds.ctx.sequencer, 'sequenceEvts')

    // Update the account status without changing the status (should still sequence an event)
    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
      },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    expect(mock).toHaveBeenCalledTimes(1)

    // @TODO use "using" (requires updating jest)
    mock.mockRestore()
  })

  it('allows to takedown, then deactivate, an account', async () => {
    const { did } = await client.call(com.atproto.server.createAccount, {
      handle: 'iris4.test',
      email: 'iris4@test.com',
      password: 'password',
    })

    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
        takedown: { applied: true },
      },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
        deactivated: { applied: true },
      },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    const status = await client.call(
      com.atproto.admin.getSubjectStatus,
      { did },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    expect(status).toEqual({
      subject: com.atproto.admin.defs.repoRef.$build({ did }),
      takedown: { applied: true, ref: expect.any(String) },
      deactivated: { applied: true },
    })
  })

  it('throws when trying to activate a takedown account', async () => {
    const { did } = await client.call(com.atproto.server.createAccount, {
      handle: 'iris5.test',
      email: 'iris5@test.com',
      password: 'password',
    })

    await client.call(
      com.atproto.admin.updateSubjectStatus,
      {
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
        takedown: { applied: true },
      },
      { headers: { authorization: network.pds.adminAuth() } },
    )

    await expect(
      client.call(
        com.atproto.admin.updateSubjectStatus,
        {
          subject: com.atproto.admin.defs.repoRef.$build({ did }),
          deactivated: { applied: false },
        },
        { headers: { authorization: network.pds.adminAuth() } },
      ),
    ).rejects.toMatchObject({
      error: 'AccountNotFound',
    })
  })
})
