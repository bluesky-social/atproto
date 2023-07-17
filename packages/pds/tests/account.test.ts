import { once, EventEmitter } from 'events'
import AtpAgent, { ComAtprotoServerResetPassword } from '@atproto/api'
import { IdResolver } from '@atproto/identity'
import * as crypto from '@atproto/crypto'
import Mail from 'nodemailer/lib/mailer'
import { AppContext, Database } from '../src'
import * as util from './_util'
import { ServerMailer } from '../src/mailer'

const email = 'alice@test.com'
const handle = 'alice.test'
const password = 'test123'
const passwordAlt = 'test456'
const minsToMs = 60 * 1000

describe('account', () => {
  let serverUrl: string
  let ctx: AppContext
  let repoSigningKey: string
  let agent: AtpAgent
  let close: util.CloseFn
  let mailer: ServerMailer
  let db: Database
  let idResolver: IdResolver
  const mailCatcher = new EventEmitter()
  let _origSendMail

  beforeAll(async () => {
    const server = await util.runTestServer({
      termsOfServiceUrl: 'https://example.com/tos',
      privacyPolicyUrl: '/privacy-policy',
      dbPostgresSchema: 'account',
    })
    close = server.close
    mailer = server.ctx.mailer
    db = server.ctx.db
    ctx = server.ctx
    serverUrl = server.url
    repoSigningKey = server.ctx.repoSigningKey.did()
    idResolver = new IdResolver({ plcUrl: ctx.cfg.didPlcUrl })
    agent = new AtpAgent({ service: serverUrl })

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

  it('serves the accounts system config', async () => {
    const res = await agent.api.com.atproto.server.describeServer({})
    expect(res.data.inviteCodeRequired).toBe(false)
    expect(res.data.availableUserDomains[0]).toBe('.test')
    expect(typeof res.data.inviteCodeRequired).toBe('boolean')
    expect(res.data.links?.privacyPolicy).toBe(
      'https://pds.public.url/privacy-policy',
    )
    expect(res.data.links?.termsOfService).toBe('https://example.com/tos')
  })

  it('fails on invalid handles', async () => {
    const promise = agent.api.com.atproto.server.createAccount({
      email: 'bad-handle@test.com',
      handle: 'did:bad-handle.test',
      password: 'asdf',
    })
    await expect(promise).rejects.toThrow('Input/handle must be a valid handle')
  })

  let did: string
  let jwt: string

  it('creates an account', async () => {
    const res = await agent.api.com.atproto.server.createAccount({
      email,
      handle,
      password,
    })
    did = res.data.did
    jwt = res.data.accessJwt

    expect(typeof jwt).toBe('string')
    expect(did.startsWith('did:plc:')).toBeTruthy()
    expect(res.data.handle).toEqual(handle)
  })

  it('generates a properly formatted PLC DID', async () => {
    const didData = await idResolver.did.resolveAtprotoData(did)

    expect(didData.did).toBe(did)
    expect(didData.handle).toBe(handle)
    expect(didData.signingKey).toBe(repoSigningKey)
    expect(didData.pds).toBe('https://pds.public.url') // Mapped from publicUrl
  })

  it('allows a custom set recovery key', async () => {
    const recoveryKey = (await crypto.P256Keypair.create()).did()
    const res = await agent.api.com.atproto.server.createAccount({
      email: 'custom-recovery@test.com',
      handle: 'custom-recovery.test',
      password: 'custom-recovery',
      recoveryKey,
    })

    const didData = await ctx.plcClient.getDocumentData(res.data.did)

    expect(didData.rotationKeys).toEqual([
      recoveryKey,
      ctx.cfg.recoveryKey,
      ctx.plcRotationKey.did(),
    ])
  })

  it('allows a user to bring their own DID', async () => {
    const userKey = await crypto.Secp256k1Keypair.create()
    const handle = 'byo-did.test'
    const did = await ctx.plcClient.createDid({
      signingKey: ctx.repoSigningKey.did(),
      handle,
      rotationKeys: [
        userKey.did(),
        ctx.cfg.recoveryKey,
        ctx.plcRotationKey.did(),
      ],
      pds: ctx.cfg.publicUrl,
      signer: userKey,
    })

    const res = await agent.api.com.atproto.server.createAccount({
      email: 'byo-did@test.com',
      handle,
      did,
      password: 'byo-did-pass',
    })

    expect(res.data.handle).toEqual(handle)
    expect(res.data.did).toEqual(did)
  })

  it('requires that the did a user brought be correctly set up for the server', async () => {
    const userKey = await crypto.Secp256k1Keypair.create()
    const baseDidInfo = {
      signingKey: ctx.repoSigningKey.did(),
      handle: 'byo-did.test',
      rotationKeys: [
        userKey.did(),
        ctx.cfg.recoveryKey,
        ctx.plcRotationKey.did(),
      ],
      pds: ctx.cfg.publicUrl,
      signer: userKey,
    }
    const baseAccntInfo = {
      email: 'byo-did@test.com',
      handle: 'byo-did.test',
      password: 'byo-did-pass',
    }

    const did1 = await ctx.plcClient.createDid({
      ...baseDidInfo,
      handle: 'different-handle.test',
    })
    const attempt1 = agent.api.com.atproto.server.createAccount({
      ...baseAccntInfo,
      did: did1,
    })
    await expect(attempt1).rejects.toThrow(
      'provided handle does not match DID document handle',
    )

    const did2 = await ctx.plcClient.createDid({
      ...baseDidInfo,
      pds: 'https://other-pds.com',
    })
    const attempt2 = agent.api.com.atproto.server.createAccount({
      ...baseAccntInfo,
      did: did2,
    })
    await expect(attempt2).rejects.toThrow(
      'DID document pds endpoint does not match service endpoint',
    )

    const did3 = await ctx.plcClient.createDid({
      ...baseDidInfo,
      rotationKeys: [userKey.did()],
    })
    const attempt3 = agent.api.com.atproto.server.createAccount({
      ...baseAccntInfo,
      did: did3,
    })
    await expect(attempt3).rejects.toThrow(
      'PLC DID does not include service rotation key',
    )

    const did4 = await ctx.plcClient.createDid({
      ...baseDidInfo,
      signingKey: userKey.did(),
    })
    const attempt4 = agent.api.com.atproto.server.createAccount({
      ...baseAccntInfo,
      did: did4,
    })
    await expect(attempt4).rejects.toThrow(
      'DID document signing key does not match service signing key',
    )
  })

  it('allows administrative email updates', async () => {
    await agent.api.com.atproto.admin.updateAccountEmail(
      {
        account: handle,
        email: 'alIce-NEw@teST.com',
      },
      {
        encoding: 'application/json',
        headers: { authorization: util.adminAuth() },
      },
    )

    const accnt = await ctx.services.account(ctx.db).getAccount(handle)
    expect(accnt?.email).toBe('alice-new@test.com')

    await agent.api.com.atproto.admin.updateAccountEmail(
      {
        account: did,
        email,
      },
      {
        encoding: 'application/json',
        headers: { authorization: util.adminAuth() },
      },
    )

    const accnt2 = await ctx.services.account(ctx.db).getAccount(handle)
    expect(accnt2?.email).toBe(email)
  })

  it('disallows non-admin moderators to perform email updates', async () => {
    const attemptUpdateMod = agent.api.com.atproto.admin.updateAccountEmail(
      {
        account: handle,
        email: 'new@email.com',
      },
      {
        encoding: 'application/json',
        headers: { authorization: util.moderatorAuth() },
      },
    )
    await expect(attemptUpdateMod).rejects.toThrow('Insufficient privileges')
    const attemptUpdateTriage = agent.api.com.atproto.admin.updateAccountEmail(
      {
        account: handle,
        email: 'new@email.com',
      },
      {
        encoding: 'application/json',
        headers: { authorization: util.triageAuth() },
      },
    )
    await expect(attemptUpdateTriage).rejects.toThrow('Insufficient privileges')
  })

  it('disallows duplicate email addresses and handles', async () => {
    const email = 'bob@test.com'
    const handle = 'bob.test'
    const password = 'test123'
    await agent.api.com.atproto.server.createAccount({
      email,
      handle,
      password,
    })

    await expect(
      agent.api.com.atproto.server.createAccount({
        email: email.toUpperCase(),
        handle: 'carol.test',
        password,
      }),
    ).rejects.toThrow('Email already taken: BOB@TEST.COM')

    await expect(
      agent.api.com.atproto.server.createAccount({
        email: 'carol@test.com',
        handle: handle.toUpperCase(),
        password,
      }),
    ).rejects.toThrow('Handle already taken: bob.test')
  })

  it('disallows improperly formatted handles', async () => {
    const tryHandle = async (handle: string) => {
      await agent.api.com.atproto.server.createAccount({
        email: 'john@test.com',
        handle,
        password: 'test123',
      })
    }
    await expect(tryHandle('did:john')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('john.bsky.io')).rejects.toThrow(
      'Not a supported handle domain',
    )
    await expect(tryHandle('j.test')).rejects.toThrow('Handle too short')
    await expect(tryHandle('jayromy-johnber12345678910.test')).rejects.toThrow(
      'Handle too long',
    )
    await expect(tryHandle('jo_hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo!hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo%hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo&hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo*hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo|hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo:hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo/hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('about.test')).rejects.toThrow('Reserved handle')
    await expect(tryHandle('atp.test')).rejects.toThrow('Reserved handle')
  })

  it('handles racing signups for same handle', async () => {
    const COUNT = 10

    let successes = 0
    let failures = 0
    const promises: Promise<unknown>[] = []
    for (let i = 0; i < COUNT; i++) {
      const attempt = async () => {
        try {
          await agent.api.com.atproto.server.createAccount({
            email: `matching@test.com`,
            handle: `matching.test`,
            password: `password`,
          })
          successes++
        } catch (err) {
          failures++
        }
      }
      promises.push(attempt())
    }
    await Promise.all(promises)
    expect(successes).toBe(1)
    expect(failures).toBe(9)
  })

  it('fails on unauthenticated requests', async () => {
    await expect(agent.api.com.atproto.server.getSession({})).rejects.toThrow()
  })

  it('logs in', async () => {
    const res = await agent.api.com.atproto.server.createSession({
      identifier: handle,
      password,
    })
    jwt = res.data.accessJwt
    expect(typeof jwt).toBe('string')
    expect(res.data.handle).toBe('alice.test')
    expect(res.data.did).toBe(did)
    expect(res.data.email).toBe(email)
  })

  it('can perform authenticated requests', async () => {
    agent.api.setHeader('authorization', `Bearer ${jwt}`)
    const res = await agent.api.com.atproto.server.getSession({})
    expect(res.data.did).toBe(did)
    expect(res.data.handle).toBe(handle)
    expect(res.data.email).toBe(email)
  })

  const getMailFrom = async (promise): Promise<Mail.Options> => {
    const result = await Promise.all([once(mailCatcher, 'mail'), promise])
    return result[0][0]
  }

  const getTokenFromMail = (mail: Mail.Options) =>
    mail.html?.toString().match(/>([a-z0-9]{5}-[a-z0-9]{5})</i)?.[1]

  it('can reset account password', async () => {
    const mail = await getMailFrom(
      agent.api.com.atproto.server.requestPasswordReset({ email }),
    )

    expect(mail.to).toEqual(email)
    expect(mail.html).toContain('Reset your password')
    expect(mail.html).toContain('alice.test')

    const token = getTokenFromMail(mail)

    if (token === undefined) {
      return expect(token).toBeDefined()
    }

    await agent.api.com.atproto.server.resetPassword({
      token,
      password: passwordAlt,
    })

    // Logs in with new password and not previous password
    await expect(
      agent.api.com.atproto.server.createSession({
        identifier: handle,
        password,
      }),
    ).rejects.toThrow('Invalid identifier or password')

    await expect(
      agent.api.com.atproto.server.createSession({
        identifier: handle,
        password: passwordAlt,
      }),
    ).resolves.toBeDefined()
  })

  it('allows only single-use of password reset token', async () => {
    const mail = await getMailFrom(
      agent.api.com.atproto.server.requestPasswordReset({ email }),
    )

    const token = getTokenFromMail(mail)

    if (token === undefined) {
      return expect(token).toBeDefined()
    }

    // Reset back from passwordAlt to password
    await agent.api.com.atproto.server.resetPassword({ token, password })

    // Reuse of token fails
    await expect(
      agent.api.com.atproto.server.resetPassword({ token, password }),
    ).rejects.toThrow(ComAtprotoServerResetPassword.InvalidTokenError)

    // Logs in with new password and not previous password
    await expect(
      agent.api.com.atproto.server.createSession({
        identifier: handle,
        password: passwordAlt,
      }),
    ).rejects.toThrow('Invalid identifier or password')

    await expect(
      agent.api.com.atproto.server.createSession({
        identifier: handle,
        password,
      }),
    ).resolves.toBeDefined()
  })

  it('changing password invalidates past refresh tokens', async () => {
    const mail = await getMailFrom(
      agent.api.com.atproto.server.requestPasswordReset({ email }),
    )

    expect(mail.to).toEqual(email)
    expect(mail.html).toContain('Reset your password')
    expect(mail.html).toContain('alice.test')

    const token = getTokenFromMail(mail)

    if (token === undefined) {
      return expect(token).toBeDefined()
    }

    const session = await agent.api.com.atproto.server.createSession({
      identifier: handle,
      password,
    })

    await agent.api.com.atproto.server.resetPassword({
      token: token.toLowerCase(), // Reset should work case-insensitively
      password,
    })

    await expect(
      agent.api.com.atproto.server.refreshSession(undefined, {
        headers: { authorization: `Bearer ${session.data.refreshJwt}` },
      }),
    ).rejects.toThrow('Token has been revoked')
  })

  it('allows only unexpired password reset tokens', async () => {
    await agent.api.com.atproto.server.requestPasswordReset({ email })

    const user = await db.db
      .updateTable('user_account')
      .where('email', '=', email)
      .set({
        passwordResetGrantedAt: new Date(
          Date.now() - 16 * minsToMs,
        ).toISOString(),
      })
      .returning(['passwordResetToken'])
      .executeTakeFirst()
    if (!user?.passwordResetToken) {
      throw new Error('Missing reset token')
    }

    // Use of expired token fails
    await expect(
      agent.api.com.atproto.server.resetPassword({
        token: user.passwordResetToken,
        password: passwordAlt,
      }),
    ).rejects.toThrow(ComAtprotoServerResetPassword.ExpiredTokenError)

    // Still logs in with previous password
    await expect(
      agent.api.com.atproto.server.createSession({
        identifier: handle,
        password: passwordAlt,
      }),
    ).rejects.toThrow('Invalid identifier or password')

    await expect(
      agent.api.com.atproto.server.createSession({
        identifier: handle,
        password,
      }),
    ).resolves.toBeDefined()
  })
})
