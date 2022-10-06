import { once, EventEmitter } from 'events'
import AdxApi, {
  ServiceClient as AdxServiceClient,
  TodoAdxCreateAccount,
} from '@adxp/api'
import {
  ExpiredTokenError,
  InvalidTokenError,
} from '@adxp/api/src/types/todo/adx/resetAccountPassword'
import { sign } from 'jsonwebtoken'
import Mail from 'nodemailer/lib/mailer'
import { App } from '../src'
import * as locals from '../src/locals'
import * as util from './_util'
import { User } from '../src/db/user'

const email = 'alice@test.com'
const username = 'alice.test'
const password = 'test123'
const passwordAlt = 'test456'

describe('account', () => {
  let serverUrl: string
  let client: AdxServiceClient
  let close: util.CloseFn
  let app: App | undefined
  const mailCatcher = new EventEmitter()
  let _origSendMail

  beforeAll(async () => {
    const server = await util.runTestServer({ inviteRequired: true })
    close = server.close
    app = server.app
    serverUrl = server.url
    client = AdxApi.service(serverUrl)

    if (app !== undefined) {
      // Catch emails for use in tests
      const { mailer } = locals.get(app)
      _origSendMail = mailer.transporter.sendMail
      mailer.transporter.sendMail = async (opts) => {
        const result = await _origSendMail.call(mailer.transporter, opts)
        mailCatcher.emit('mail', opts)
        return result
      }
    }
  })

  afterAll(async () => {
    if (app !== undefined) {
      const { mailer } = locals.get(app)
      mailer.transporter.sendMail = _origSendMail
    }
    if (close) {
      await close()
    }
  })

  let inviteCode: string

  it('creates an invite code', async () => {
    const res = await client.todo.adx.createInviteCode(
      {},
      { useCount: 1 },
      {
        headers: { authorization: util.adminAuth() },
        encoding: 'application/json',
      },
    )
    inviteCode = res.data.code
    const [host, code] = inviteCode.split('-')
    expect(host).toBe(new URL(serverUrl).hostname)
    expect(code.length).toBe(5)
  })

  it('serves the accounts system config', async () => {
    const res = await client.todo.adx.getAccountsConfig({})
    expect(res.data.inviteCodeRequired).toBe(true)
    expect(res.data.availableUserDomains[0]).toBe('test')
    expect(typeof res.data.inviteCodeRequired).toBe('boolean')
  })

  it('fails on invalid usernames', async () => {
    const promise = client.todo.adx.createAccount(
      {},
      {
        email: 'bad-username@test.com',
        username: 'did:bad-username.test',
        password: 'asdf',
        inviteCode,
      },
    )
    await expect(promise).rejects.toThrow(
      TodoAdxCreateAccount.InvalidUsernameError,
    )
  })

  it('fails on bad invite code', async () => {
    const promise = client.todo.adx.createAccount(
      {},
      {
        email,
        username,
        password,
        inviteCode: 'fake-invite',
      },
    )
    await expect(promise).rejects.toThrow(
      TodoAdxCreateAccount.InvalidInviteCodeError,
    )
  })

  let did: string
  let jwt: string

  it('creates an account', async () => {
    const res = await client.todo.adx.createAccount(
      {},
      { email, username, password, inviteCode },
    )
    did = res.data.did
    jwt = res.data.jwt

    expect(typeof jwt).toBe('string')
    expect(did.startsWith('did:plc:')).toBeTruthy()
    expect(res.data.username).toEqual(username)
  })

  it('disallows duplicate email addresses and usernames', async () => {
    const res = await client.todo.adx.createInviteCode(
      {},
      { useCount: 2 },
      {
        headers: { authorization: util.adminAuth() },
        encoding: 'application/json',
      },
    )
    const inviteCode = res.data.code
    const email = 'bob@test.com'
    const username = 'bob.test'
    const password = 'test123'
    await client.todo.adx.createAccount(
      {},
      { email, username, password, inviteCode },
    )

    await expect(
      client.todo.adx.createAccount(
        {},
        {
          email: email.toUpperCase(),
          username: 'carol.test',
          password,
          inviteCode,
        },
      ),
    ).rejects.toThrow('Email already taken: BOB@TEST.COM')

    await expect(
      client.todo.adx.createAccount(
        {},
        {
          email: 'carol@test.com',
          username: username.toUpperCase(),
          password,
          inviteCode,
        },
      ),
    ).rejects.toThrow('Username already taken: BOB.TEST')
  })

  it('fails on used up invite code', async () => {
    const promise = client.todo.adx.createAccount(
      {},
      {
        email: 'bob@test.com',
        username: 'bob.test',
        password: 'asdf',
        inviteCode,
      },
    )
    await expect(promise).rejects.toThrow(
      TodoAdxCreateAccount.InvalidInviteCodeError,
    )
  })

  it('fails on unauthenticated requests', async () => {
    await expect(client.todo.adx.getSession({})).rejects.toThrow()
  })

  it('logs in', async () => {
    const res = await client.todo.adx.createSession({}, { username, password })
    jwt = res.data.jwt
    expect(typeof jwt).toBe('string')
    expect(res.data.name).toBe('alice.test')
    expect(res.data.did).toBe(did)
  })

  it('can perform authenticated requests', async () => {
    client.setHeader('authorization', `Bearer ${jwt}`)
    const res = await client.todo.adx.getSession({})
    expect(res.data.did).toBe(did)
    expect(res.data.name).toBe(username)
  })

  const getMailFrom = async (promise): Promise<Mail.Options> => {
    const result = await Promise.all([once(mailCatcher, 'mail'), promise])
    return result[0][0]
  }

  const getTokenFromMail = (mail: Mail.Options) =>
    mail.html?.toString().match(/token=(.+?)"/)?.[1]

  it('can reset account password', async () => {
    const mail = await getMailFrom(
      client.todo.adx.requestAccountPasswordReset({}, { email }),
    )

    expect(mail.to).toEqual(email)
    expect(mail.html).toContain('Reset your password')

    const token = getTokenFromMail(mail)

    if (token === undefined) {
      return expect(token).toBeDefined()
    }

    await client.todo.adx.resetAccountPassword(
      {},
      { token, password: passwordAlt },
    )

    // Logs in with new password and not previous password
    await expect(
      client.todo.adx.createSession({}, { username, password }),
    ).rejects.toThrow('Invalid username or password')

    await expect(
      client.todo.adx.createSession({}, { username, password: passwordAlt }),
    ).resolves.toBeDefined()
  })

  it('allows only single-use of password reset token', async () => {
    const mail = await getMailFrom(
      client.todo.adx.requestAccountPasswordReset({}, { email }),
    )

    const token = getTokenFromMail(mail)

    if (token === undefined) {
      return expect(token).toBeDefined()
    }

    // Reset back from updatedPassword to password
    await client.todo.adx.resetAccountPassword({}, { token, password })

    // Reuse of token fails
    await expect(
      client.todo.adx.resetAccountPassword({}, { token, password }),
    ).rejects.toThrow(InvalidTokenError)

    // Logs in with new password and not previous password
    await expect(
      client.todo.adx.createSession({}, { username, password: passwordAlt }),
    ).rejects.toThrow('Invalid username or password')

    await expect(
      client.todo.adx.createSession({}, { username, password }),
    ).resolves.toBeDefined()
  })

  it('allows only unexpired password reset tokens', async () => {
    if (app === undefined) throw new Error()
    const { config, db } = locals.get(app)

    const table = db.db.getRepository(User)
    const user = await table.findOneBy({ did })
    if (!user) {
      return expect(user).toBeTruthy()
    }

    const signingKey = `${config.jwtSecret}::${user.password}`
    const expiredToken = await sign(
      { sub: did, scope: 'todo.adx.resetAccountPassword' },
      signingKey,
      { expiresIn: -1 },
    )

    // Use of expired token fails
    await expect(
      client.todo.adx.resetAccountPassword(
        {},
        { token: expiredToken, password: passwordAlt },
      ),
    ).rejects.toThrow(ExpiredTokenError)

    // Still logs in with previous password
    await expect(
      client.todo.adx.createSession({}, { username, password: passwordAlt }),
    ).rejects.toThrow('Invalid username or password')

    await expect(
      client.todo.adx.createSession({}, { username, password }),
    ).resolves.toBeDefined()
  })
})
