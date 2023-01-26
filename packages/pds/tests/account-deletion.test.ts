import { once, EventEmitter } from 'events'
import Mail from 'nodemailer/lib/mailer'
import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { Database } from '../src'
import * as util from './_util'
import { ServerMailer } from '../src/mailer'

describe('account', () => {
  let client: AtpServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  let mailer: ServerMailer
  let db: Database
  const mailCatcher = new EventEmitter()
  let _origSendMail

  let alice

  beforeAll(async () => {
    const server = await util.runTestServer({
      dbPostgresSchema: 'account-deletion',
    })
    close = server.close
    mailer = server.ctx.mailer
    db = server.ctx.db
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc, server.ctx.messageQueue)
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
    if (close) {
      await close()
    }
  })

  const getMailFrom = async (promise): Promise<Mail.Options> => {
    const result = await Promise.all([once(mailCatcher, 'mail'), promise])
    return result[0][0]
  }

  const getTokenFromMail = (mail: Mail.Options) =>
    mail.html?.toString().match(/>(\d{6})</)?.[1]

  let token

  it('requests account deletion', async () => {
    const mail = await getMailFrom(
      client.com.atproto.account.requestDelete(undefined, {
        headers: sc.getHeaders(alice.did),
      }),
    )

    expect(mail.to).toEqual(alice.email)
    expect(mail.html).toContain('Delete your Bluesky account')

    token = getTokenFromMail(mail)
    if (!token) {
      return expect(token).toBeDefined()
    }
  })

  it('fails account deletion with a bad token', async () => {
    const attempt = client.com.atproto.account.delete({
      token: '123456',
      handle: alice.handle,
      password: alice.password,
    })
    await expect(attempt).rejects.toThrow('Token is invalid')
  })

  it('fails account deletion with a bad password', async () => {
    const attempt = client.com.atproto.account.delete({
      token,
      handle: alice.handle,
      password: 'bad-pass',
    })
    await expect(attempt).rejects.toThrow('Invalid handle or password')
  })

  it('deletes account with a valid token & password', async () => {
    await client.com.atproto.account.delete({
      token,
      handle: alice.handle,
      password: alice.password,
    })
  })

  it('no longer lets the user log in', async () => {
    const attempt = client.com.atproto.session.create({
      handle: alice.handle,
      password: alice.password,
    })
    await expect(attempt).rejects.toThrow('Invalid handle or password')
  })
})
