import { jest } from '@jest/globals'
import {
  type AtpAgent,
  ComAtprotoServerConfirmEmail,
  ComAtprotoServerUpdateEmail,
} from '@atproto/api'
import {
  type Account,
  type SeedClient,
  TestNetworkNoAppView,
} from '@atproto/dev-env'
import type { AppContext } from '../src/index.js'
import userSeed from './seeds/users.js'

describe('email confirmation', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let sc: SeedClient

  let alice: Account
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
    await userSeed(sc)
    alice = sc.accounts[sc.dids.alice]

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

  it('starts a user out unverified', async () => {
    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(alice.did) },
    )
    expect(session.data.emailConfirmed).toEqual(false)
  })

  it('allows email update without token when unverified', async () => {
    const res = await agent.api.com.atproto.server.requestEmailUpdate(
      undefined,
      { headers: sc.getHeaders(alice.did) },
    )
    expect(res.data.tokenRequired).toBe(false)

    await agent.api.com.atproto.server.updateEmail(
      {
        email: 'new-alice@example.com',
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )
    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(alice.did) },
    )
    expect(session.data.email).toEqual('new-alice@example.com')
    expect(session.data.emailConfirmed).toEqual(false)
    alice.email = session.data.email!
  })

  let confirmToken: string

  it('requests email confirmation', async () => {
    using sendConfirmEmailMock = jest.spyOn(ctx.mailer, 'sendConfirmEmail')

    await agent.api.com.atproto.server.requestEmailConfirmation(undefined, {
      headers: sc.getHeaders(alice.did),
    })

    expect(sendConfirmEmailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    const [params] = sendConfirmEmailMock.mock.lastCall!
    expect(params).toEqual({
      token: expect.any(String),
    })

    const [mail] = sendMailMock.mock.lastCall!
    expect(mail.to).toEqual(alice.email)
    expect(mail.subject).toBe('Email Confirmation')
    expect(mail.html).toContain('Confirm your email')
    confirmToken = params.token

    expect(confirmToken).toBeDefined()
  })

  it('fails email confirmation with a bad token', async () => {
    const attempt = agent.api.com.atproto.server.confirmEmail(
      {
        email: alice.email,
        token: '123456',
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      ComAtprotoServerConfirmEmail.InvalidTokenError,
    )
  })

  it('fails email confirmation with a bad token', async () => {
    const attempt = agent.api.com.atproto.server.confirmEmail(
      {
        email: 'fake-alice@example.com',
        token: confirmToken,
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      ComAtprotoServerConfirmEmail.InvalidEmailError,
    )
  })

  it('confirms email', async () => {
    await agent.api.com.atproto.server.confirmEmail(
      {
        email: alice.email,
        token: confirmToken,
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )
    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(alice.did) },
    )
    expect(session.data.emailConfirmed).toBe(true)
  })

  it('disallows email update without token when verified', async () => {
    const attempt = agent.api.com.atproto.server.updateEmail(
      {
        email: 'new-alice-2@example.com',
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      ComAtprotoServerUpdateEmail.TokenRequiredError,
    )
  })

  let updateToken: string

  it('requests email update', async () => {
    using sendUpdateEmailMock = jest.spyOn(ctx.mailer, 'sendUpdateEmail')

    const res = await agent.api.com.atproto.server.requestEmailUpdate(
      undefined,
      {
        headers: sc.getHeaders(alice.did),
      },
    )
    expect(res.data.tokenRequired).toBe(true)
    expect(sendUpdateEmailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    const [params] = sendUpdateEmailMock.mock.lastCall!
    expect(params).toEqual({
      token: expect.any(String),
    })
    const [mail] = sendMailMock.mock.lastCall!
    expect(mail.to).toEqual(alice.email)
    expect(mail.subject).toBe('Email Update Requested')
    expect(mail.html).toContain('Update your email')

    updateToken = params.token

    expect(updateToken).toBeDefined()
  })

  it('fails email update with a bad token', async () => {
    const attempt = agent.api.com.atproto.server.updateEmail(
      {
        email: 'new-alice-2@example.com',
        token: '123456',
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      ComAtprotoServerUpdateEmail.InvalidTokenError,
    )
  })

  it('fails email update with a badly formatted email', async () => {
    const attempt = agent.api.com.atproto.server.updateEmail(
      {
        email: 'bad-email@disposeamail.com',
        token: updateToken,
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      'This email address is not supported, please use a different email.',
    )
  })

  it('fails email update with in-use email', async () => {
    const attempt = agent.api.com.atproto.server.updateEmail(
      {
        email: 'bob@test.com',
        token: updateToken,
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      'This email address is already in use, please use a different email.',
    )
  })

  it('updates email', async () => {
    await agent.api.com.atproto.server.updateEmail(
      {
        email: 'new-alice-2@example.com',
        token: updateToken,
      },
      { headers: sc.getHeaders(alice.did), encoding: 'application/json' },
    )

    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(alice.did) },
    )
    expect(session.data.email).toBe('new-alice-2@example.com')
    expect(session.data.emailConfirmed).toBe(false)
  })
})
