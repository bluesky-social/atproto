import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env/src/network-no-appview'

describe('Invitation Consumption', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'invitation_consumption',
    })
    agent = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  it('creates invitations in pending state', async () => {
    const email = `invite-${Date.now()}@example.com`
    await network.pds.ctx.invitationManager.createInvitation(
      email,
      'invite_user',
      Math.floor(Date.now() / 1000),
    )

    const invitation =
      await network.pds.ctx.invitationManager.getInvitationByEmail(email)

    expect(invitation).toBeDefined()
    expect(invitation?.status).toBe('pending')
  })

  it('consumes invitation for existing account', async () => {
    const email = `consume-${Date.now()}@example.com`
    const suffix = Date.now().toString().slice(-6)
    const handle = `c${suffix}.test`

    const account = await agent.api.com.atproto.server.createAccount({
      email,
      handle,
      password: 'test-password-123',
    })

    await network.pds.ctx.invitationManager.createInvitation(
      email,
      'consume_user',
      Math.floor(Date.now() / 1000),
    )

    await expect(
      network.pds.ctx.invitationManager.consumeInvitation(
        email,
        account.data.did,
        'consume_user',
      ),
    ).resolves.not.toThrow()

    const consumed =
      await network.pds.ctx.invitationManager.getInvitationByEmail(email)
    expect(consumed === null || consumed.status === 'used').toBe(true)
  })

  it('supports admin recovery by creating invitation after account exists', async () => {
    const email = `recovery-${Date.now()}@example.com`
    const suffix = Date.now().toString().slice(-6)

    const created = await agent.api.com.atproto.server.createAccount({
      email,
      handle: `r${suffix}.test`,
      password: 'test-password-123',
    })

    let invitation =
      await network.pds.ctx.invitationManager.getInvitationByEmail(email)
    expect(invitation).toBeNull()

    await network.pds.ctx.invitationManager.createInvitation(
      email,
      null,
      Math.floor(Date.now() / 1000),
    )

    invitation =
      await network.pds.ctx.invitationManager.getInvitationByEmail(email)
    expect(invitation).toBeDefined()
    expect(invitation?.status).toBe('pending')

    const account = await network.pds.ctx.accountManager.getAccount(
      created.data.did,
    )
    expect(account).toBeDefined()
  })
})
