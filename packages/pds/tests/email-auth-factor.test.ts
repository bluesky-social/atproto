import { jest } from '@jest/globals'
import { type AtpAgent, ComAtprotoServerUpdateEmail } from '@atproto/api'
import {
  type Account,
  type SeedClient,
  TestNetworkNoAppView,
} from '@atproto/dev-env'
import type { AppContext } from '../src/index.js'

describe('email auth factor', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let sc: SeedClient

  // A dedicated account keeps this block independent of the sequential
  // confirm/update flow above, which leaves alice's address unconfirmed.
  let faye: Account
  // Captured token for disabling the email auth factor:
  let disableToken: string

  let sendMailMock: jest.SpiedFunction<
    AppContext['mailer']['transporter']['sendMail']
  >

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'email_confirmation',
    })
    ctx = network.pds.ctx
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    using sendConfirmEmailMock = jest.spyOn(ctx.mailer, 'sendConfirmEmail')

    faye = await sc.createAccount('faye', {
      handle: 'faye.test',
      email: 'faye@test.com',
      password: 'faye-pass',
    })

    // The pure-toggle branch in `updateEmail` only engages for a *confirmed*
    // address, and accounts start out unconfirmed.
    await agent.api.com.atproto.server.requestEmailConfirmation(undefined, {
      headers: sc.getHeaders(faye.did),
    })
    const [params] = sendConfirmEmailMock.mock.lastCall!

    await agent.api.com.atproto.server.confirmEmail(
      { email: faye.email, token: params.token },
      { headers: sc.getHeaders(faye.did), encoding: 'application/json' },
    )

    sendMailMock = jest
      .spyOn(ctx.mailer.transporter, 'sendMail')
      .mockImplementation(async () => {})
  })

  beforeEach(async () => {
    // Catch-all: never actually send, but keep recording calls for assertions.
    sendMailMock.mockClear()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('enables the auth factor without a token', async () => {
    await agent.api.com.atproto.server.updateEmail(
      { email: faye.email, emailAuthFactor: true },
      { headers: sc.getHeaders(faye.did), encoding: 'application/json' },
    )

    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(faye.did) },
    )
    expect(session.data.emailAuthFactor).toBe(true)
    // Enabling only adds protection, so no OTP is dispatched.
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('requires a confirmation token to disable the auth factor', async () => {
    using sendUpdateEmailMock = jest.spyOn(ctx.mailer, 'sendUpdateEmail')

    const attempt = agent.api.com.atproto.server.updateEmail(
      { email: faye.email, emailAuthFactor: false },
      { headers: sc.getHeaders(faye.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      ComAtprotoServerUpdateEmail.TokenRequiredError,
    )

    expect(sendUpdateEmailMock).toHaveBeenCalledTimes(1)
    const [params] = sendUpdateEmailMock.mock.lastCall!
    disableToken = params.token
    expect(disableToken).toBeDefined()

    // The first, token-less call must not have changed anything.
    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(faye.did) },
    )
    expect(session.data.emailAuthFactor).toBe(true)
  })

  it('disables the auth factor with a valid token', async () => {
    await agent.api.com.atproto.server.updateEmail(
      { email: faye.email, emailAuthFactor: false, token: disableToken },
      { headers: sc.getHeaders(faye.did), encoding: 'application/json' },
    )

    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(faye.did) },
    )
    expect(session.data.emailAuthFactor).toBe(false)
    // A pure toggle must not disturb the address or its confirmed status.
    expect(session.data.email).toBe(faye.email)
    expect(session.data.emailConfirmed).toBe(true)
  })

  it('no-ops when the auth factor is already disabled', async () => {
    using sendUpdateEmailMock = jest.spyOn(ctx.mailer, 'sendUpdateEmail')

    await agent.api.com.atproto.server.updateEmail(
      { email: faye.email, emailAuthFactor: false },
      { headers: sc.getHeaders(faye.did), encoding: 'application/json' },
    )

    // There is no second factor left to remove, so the call is idempotent:
    // nothing to confirm, and no OTP dispatched.
    expect(sendUpdateEmailMock).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()

    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(faye.did) },
    )
    expect(session.data.emailAuthFactor).toBe(false)
    expect(session.data.emailConfirmed).toBe(true)
  })
})
