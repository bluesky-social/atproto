import { once, EventEmitter } from 'events'
import Mail from 'nodemailer/lib/mailer'
import AtpAgent from '@atproto/api'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { ServerMailer } from '../src/mailer'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import {
  ComAtprotoServerConfirmEmail,
  ComAtprotoServerUpdateEmail,
} from '@atproto/api'

describe('email confirmation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let mailer: ServerMailer
  const mailCatcher = new EventEmitter()
  let _origSendMail

  let alice

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'email_confirmation',
    })
    mailer = network.pds.ctx.mailer
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await userSeed(sc)
    alice = sc.accounts[sc.dids.alice]

    // Catch emails for use in tests
    _origSendMail = mailer.transporter.sendMail
    mailer.transporter.sendMail = async (opts) => {
      const result = await _origSendMail.call(mailer.transporter, opts)
      mailCatcher.emit('mail', opts)
      return result
    }
  })

  afterAll(async () => {
    mailer.transporter.sendMail = _origSendMail
    await network.close()
  })

  const getMailFrom = async (promise): Promise<Mail.Options> => {
    const result = await Promise.all([once(mailCatcher, 'mail'), promise])
    return result[0][0]
  }

  const getTokenFromMail = (mail: Mail.Options) =>
    mail.html?.toString().match(/>([a-z0-9]{5}-[a-z0-9]{5})</i)?.[1]

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
    alice.email = session.data.email
  })

  let confirmToken

  it('requests email confirmation', async () => {
    const mail = await getMailFrom(
      agent.api.com.atproto.server.requestEmailConfirmation(undefined, {
        headers: sc.getHeaders(alice.did),
      }),
    )
    expect(mail.to).toEqual(alice.email)
    expect(mail.html).toEqual('Confirm your Bluesky email')
    confirmToken = getTokenFromMail(mail)
    expect(confirmToken).toBeDefined()
  })

  it('fails email confirmation with a bad token', async () => {
    const attempt = agent.api.com.atproto.server.confirmEmail({
      email: 'new-alice@example.com',
      token: '123456',
    })
    await expect(attempt).rejects.toThrow(
      ComAtprotoServerConfirmEmail.InvalidTokenError,
    )
  })

  it('fails email confirmation with a bad token', async () => {
    const attempt = agent.api.com.atproto.server.confirmEmail({
      email: 'fake-alice@example.com',
      token: confirmToken,
    })
    await expect(attempt).rejects.toThrow(
      ComAtprotoServerConfirmEmail.InvalidEmailError,
    )
  })

  it('confirms email', async () => {
    await agent.api.com.atproto.server.confirmEmail({
      email: 'new-alice@example.com',
      token: confirmToken,
    })
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

  let updateToken

  it('requests email update', async () => {
    const mail = await getMailFrom(async () => {
      const res = await agent.api.com.atproto.server.requestEmailUpdate(
        undefined,
        {
          headers: sc.getHeaders(alice.did),
        },
      )
      expect(res.data.tokenRequired).toBe(true)
    })
    expect(mail.to).toEqual(alice.email)
    expect(mail.html).toEqual('Update your Bluesky email')
    updateToken = getTokenFromMail(mail)
    expect(updateToken).toBeDefined()
  })

  it('fails email update with a bad token', async () => {
    const attempt = agent.api.com.atproto.server.updateEmail({
      email: 'new-alice-2@example.com',
      token: '123456',
    })
    await expect(attempt).rejects.toThrow(
      ComAtprotoServerUpdateEmail.InvalidTokenError,
    )
  })

  it('updates email', async () => {
    await agent.api.com.atproto.server.updateEmail({
      email: 'new-alice-2@example.com',
      token: updateToken,
    })

    const session = await agent.api.com.atproto.server.getSession(
      {},
      { headers: sc.getHeaders(alice.did) },
    )
    expect(session.data.email).toBe('new-alice-2@example.com')
    expect(session.data.emailConfirmed).toBe(false)
  })
})
