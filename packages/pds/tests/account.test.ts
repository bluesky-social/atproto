import { EventEmitter, once } from 'node:events'
import Mail from 'nodemailer/lib/mailer'
import * as crypto from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { IdResolver } from '@atproto/identity'
import { Client, DidString, HandleString } from '@atproto/lex'
import { AppContext, com } from '../src'
import { ServerMailer } from '../src/mailer'

const email = 'alice@test.com'
const handle = 'alice.test'
const password = 'test123'
const passwordAlt = 'test456'
const minsToMs = 60 * 1000

describe('account', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let client: Client
  let mailer: ServerMailer
  let idResolver: IdResolver
  const mailCatcher = new EventEmitter()
  let _origSendMail

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account',
      pds: {
        contactEmailAddress: 'abuse@example.com',
        termsOfServiceUrl: 'https://example.com/tos',
        privacyPolicyUrl: 'https://example.com/privacy-policy',
      },
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    mailer = network.pds.ctx.mailer
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    idResolver = network.pds.ctx.idResolver
    client = network.pds.getClient()

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

  it('serves the accounts system config', async () => {
    const res = await client.call(com.atproto.server.describeServer, {})
    expect(res.inviteCodeRequired).toBe(false)
    expect(res.availableUserDomains[0]).toBe('.test')
    expect(typeof res.inviteCodeRequired).toBe('boolean')
    expect(res.links?.privacyPolicy).toBe('https://example.com/privacy-policy')
    expect(res.links?.termsOfService).toBe('https://example.com/tos')
    expect(res.contact?.email).toBe('abuse@example.com')
  })

  it('fails on invalid handles', async () => {
    const promise = client.call(com.atproto.server.createAccount, {
      email: 'bad-handle@test.com',
      handle: 'did:bad-handle.test',
      password: 'asdf',
    })
    await expect(promise).rejects.toThrow('Input/handle must be a valid handle')
  })

  describe('email validation', () => {
    it('succeeds on allowed emails', async () => {
      const promise = client.call(com.atproto.server.createAccount, {
        email: 'ok-email@gmail.com',
        handle: 'ok-email.test',
        password: 'asdf',
      })
      await expect(promise).resolves.toBeTruthy()
    })

    it('fails on disallowed emails', async () => {
      const promise = client.call(com.atproto.server.createAccount, {
        email: 'bad-email@disposeamail.com',
        handle: 'bad-email.test',
        password: 'asdf',
      })
      await expect(promise).rejects.toThrow(
        'This email address is not supported, please use a different email.',
      )
    })
  })

  let did: DidString
  let jwt: string

  it('creates an account', async () => {
    const res = await client.call(com.atproto.server.createAccount, {
      email,
      handle,
      password,
    })
    did = res.did
    jwt = res.accessJwt

    expect(typeof res.accessJwt).toBe('string')
    expect(did.startsWith('did:plc:')).toBeTruthy()
    expect(res.handle).toEqual(handle)
  })

  it('generates a properly formatted PLC DID', async () => {
    const didData = await idResolver.did.resolveAtprotoData(did)
    const signingKey = await network.pds.ctx.actorStore.keypair(did)

    expect(didData.did).toBe(did)
    expect(didData.handle).toBe(handle)
    expect(didData.signingKey).toBe(signingKey.did())
    expect(didData.pds).toBe(network.pds.url)
  })

  it('allows a custom set recovery key', async () => {
    const recoveryKey = (await crypto.P256Keypair.create()).did()
    const res = await client.call(com.atproto.server.createAccount, {
      email: 'custom-recovery@test.com',
      handle: 'custom-recovery.test',
      password: 'custom-recovery',
      recoveryKey,
    })

    const didData = await ctx.plcClient.getDocumentData(res.did)

    expect(didData.rotationKeys).toEqual([
      recoveryKey,
      ctx.cfg.identity.recoveryDidKey,
      ctx.plcRotationKey.did(),
    ])
  })

  // @NOTE currently disabled until we allow a user to resver a keypair before migration
  // it('allows a user to bring their own DID', async () => {
  //   const userKey = await crypto.Secp256k1Keypair.create()
  //   const handle = 'byo-did.test'
  //   const did = await ctx.plcClient.createDid({
  //     signingKey: ctx.repoSigningKey.did(),
  //     handle,
  //     rotationKeys: [
  //       userKey.did(),
  //       ctx.cfg.identity.recoveryDidKey ?? '',
  //       ctx.plcRotationKey.did(),
  //     ],
  //     pds: network.pds.url,
  //     signer: userKey,
  //   })

  //   const res = await agent.api.com.atproto.server.createAccount({
  //     email: 'byo-did@test.com',
  //     handle,
  //     did,
  //     password: 'byo-did-pass',
  //   })

  //   expect(res.data.handle).toEqual(handle)
  //   expect(res.data.did).toEqual(did)
  // })

  // it('requires that the did a user brought be correctly set up for the server', async () => {
  //   const userKey = await crypto.Secp256k1Keypair.create()
  //   const baseDidInfo = {
  //     signingKey: ctx.repoSigningKey.did(),
  //     handle: 'byo-did.test',
  //     rotationKeys: [
  //       userKey.did(),
  //       ctx.cfg.identity.recoveryDidKey ?? '',
  //       ctx.plcRotationKey.did(),
  //     ],
  //     pds: ctx.cfg.service.publicUrl,
  //     signer: userKey,
  //   }
  //   const baseAccntInfo = {
  //     email: 'byo-did@test.com',
  //     handle: 'byo-did.test',
  //     password: 'byo-did-pass',
  //   }

  //   const did1 = await ctx.plcClient.createDid({
  //     ...baseDidInfo,
  //     handle: 'different-handle.test',
  //   })
  //   const attempt1 = agent.api.com.atproto.server.createAccount({
  //     ...baseAccntInfo,
  //     did: did1,
  //   })
  //   await expect(attempt1).rejects.toThrow(
  //     'provided handle does not match DID document handle',
  //   )

  //   const did2 = await ctx.plcClient.createDid({
  //     ...baseDidInfo,
  //     pds: 'https://other-pds.com',
  //   })
  //   const attempt2 = agent.api.com.atproto.server.createAccount({
  //     ...baseAccntInfo,
  //     did: did2,
  //   })
  //   await expect(attempt2).rejects.toThrow(
  //     'DID document pds endpoint does not match service endpoint',
  //   )

  //   const did3 = await ctx.plcClient.createDid({
  //     ...baseDidInfo,
  //     rotationKeys: [userKey.did()],
  //   })
  //   const attempt3 = agent.api.com.atproto.server.createAccount({
  //     ...baseAccntInfo,
  //     did: did3,
  //   })
  //   await expect(attempt3).rejects.toThrow(
  //     'PLC DID does not include service rotation key',
  //   )

  //   const did4 = await ctx.plcClient.createDid({
  //     ...baseDidInfo,
  //     signingKey: userKey.did(),
  //   })
  //   const attempt4 = agent.api.com.atproto.server.createAccount({
  //     ...baseAccntInfo,
  //     did: did4,
  //   })
  //   await expect(attempt4).rejects.toThrow(
  //     'DID document signing key does not match service signing key',
  //   )
  // })

  it('allows administrative email updates', async () => {
    await client.call(
      com.atproto.admin.updateAccountEmail,
      {
        account: handle,
        email: 'alIce-NEw@teST.com',
      },
      { headers: network.pds.adminAuthHeaders() },
    )

    const accnt = await ctx.accountManager.getAccount(handle)
    expect(accnt?.email).toBe('alice-new@test.com')

    await client.call(
      com.atproto.admin.updateAccountEmail,
      {
        account: did,
        email,
      },
      { headers: network.pds.adminAuthHeaders() },
    )

    const accnt2 = await ctx.accountManager.getAccount(handle)
    expect(accnt2?.email).toBe(email)
  })

  it('disallows duplicate email addresses and handles', async () => {
    const email = 'bob@test.com'
    const handle: HandleString = 'bob.test'
    const password = 'test123'
    await client.call(com.atproto.server.createAccount, {
      email,
      handle,
      password,
    })

    await expect(
      client.call(com.atproto.server.createAccount, {
        email: email.toUpperCase(),
        handle: 'carol.test',
        password,
      }),
    ).rejects.toThrow('Email already taken: BOB@TEST.COM')

    await expect(
      client.call(com.atproto.server.createAccount, {
        email: 'carol@test.com',
        handle: handle.toUpperCase() as HandleString,
        password,
      }),
    ).rejects.toThrow('Handle already taken: bob.test')
  })

  it('disallows improperly formatted handles', async () => {
    const tryHandle = async (handle: HandleString) => {
      await client.call(com.atproto.server.createAccount, {
        email: 'john@test.com',
        handle,
        password: 'test123',
      })
    }
    // @ts-expect-error
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
          await client.call(com.atproto.server.createAccount, {
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
    await expect(
      client.call(com.atproto.server.getSession, {}),
    ).rejects.toThrow()
  })

  it('logs in', async () => {
    const res = await client.call(com.atproto.server.createSession, {
      identifier: handle,
      password,
    })
    jwt = res.accessJwt
    expect(typeof jwt).toBe('string')
    expect(res.handle).toBe('alice.test')
    expect(res.did).toBe(did)
    expect(res.email).toBe(email)
  })

  it('can perform authenticated requests', async () => {
    // @TODO each test should be able to run independently & concurrently
    client.headers.set('authorization', `Bearer ${jwt}`)
    const res = await client.call(com.atproto.server.getSession, {})
    expect(res.did).toBe(did)
    expect(res.handle).toBe(handle)
    expect(res.email).toBe(email)
  })

  const getMailFrom = async (promise): Promise<Mail.Options> => {
    const result = await Promise.all([once(mailCatcher, 'mail'), promise])
    return result[0][0]
  }

  const getTokenFromMail = (mail: Mail.Options) =>
    mail.html?.toString().match(/>([a-z0-9]{5}-[a-z0-9]{5})</i)?.[1]

  it('can reset account password', async () => {
    const mail = await getMailFrom(
      client.call(com.atproto.server.requestPasswordReset, { email }),
    )

    expect(mail.to).toEqual(email)
    expect(mail.html).toContain('Reset password')
    expect(mail.html).toContain('alice.test')

    const token = getTokenFromMail(mail)

    if (token === undefined) {
      return expect(token).toBeDefined()
    }

    await client.call(com.atproto.server.resetPassword, {
      token,
      password: passwordAlt,
    })

    // Logs in with new password and not previous password
    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: handle,
        password,
      }),
    ).rejects.toThrow('Invalid identifier or password')

    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: handle,
        password: passwordAlt,
      }),
    ).resolves.toBeDefined()
  })

  it('allows only single-use of password reset token', async () => {
    const mail = await getMailFrom(
      client.call(com.atproto.server.requestPasswordReset, { email }),
    )

    const token = getTokenFromMail(mail)

    if (token === undefined) {
      return expect(token).toBeDefined()
    }

    // Reset back from passwordAlt to password
    await client.call(com.atproto.server.resetPassword, { token, password })

    // Reuse of token fails
    expect(
      await client.xrpcSafe(com.atproto.server.resetPassword, {
        body: { token, password },
      }),
    ).toMatchObject({
      success: false,
      error: 'InvalidTokenError',
    })

    // Logs in with new password and not previous password
    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: handle,
        password: passwordAlt,
      }),
    ).rejects.toThrow('Invalid identifier or password')

    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: handle,
        password,
      }),
    ).resolves.toBeDefined()
  })

  it('changing password invalidates past refresh tokens', async () => {
    const mail = await getMailFrom(
      client.call(com.atproto.server.requestPasswordReset, { email }),
    )

    expect(mail.to).toEqual(email)
    expect(mail.html).toContain('Reset password')
    expect(mail.html).toContain('alice.test')

    const token = getTokenFromMail(mail)

    if (token === undefined) {
      return expect(token).toBeDefined()
    }

    const session = await client.call(com.atproto.server.createSession, {
      identifier: handle,
      password,
    })

    await client.call(com.atproto.server.resetPassword, {
      token: token.toLowerCase(), // Reset should work case-insensitively
      password,
    })

    await expect(
      client.call(com.atproto.server.refreshSession, undefined, {
        headers: { authorization: `Bearer ${session.refreshJwt}` },
      }),
    ).rejects.toThrow('Token has been revoked')
  })

  it('allows only unexpired password reset tokens', async () => {
    await client.call(com.atproto.server.requestPasswordReset, { email })

    const res = await ctx.accountManager.db.db
      .updateTable('email_token')
      .where('purpose', '=', 'reset_password')
      .where('did', '=', did)
      .set({
        requestedAt: new Date(Date.now() - 16 * minsToMs).toISOString(),
      })
      .returning(['token'])
      .executeTakeFirst()
    if (!res?.token) {
      throw new Error('Missing reset token')
    }

    // Use of expired token fails
    expect(
      await client.xrpcSafe(com.atproto.server.resetPassword, {
        body: {
          token: res.token,
          password: passwordAlt,
        },
      }),
    ).toMatchObject({
      success: false,
      error: 'ExpiredTokenError',
    })

    // Still logs in with previous password
    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: handle,
        password: passwordAlt,
      }),
    ).rejects.toThrow('Invalid identifier or password')

    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: handle,
        password,
      }),
    ).resolves.toBeDefined()
  })

  it('allows an admin to update password', async () => {
    const tryUnauthed = client.call(com.atproto.admin.updateAccountPassword, {
      did,
      password: 'new-admin-pass',
    })
    await expect(tryUnauthed).rejects.toThrow('Authentication Required')

    await client.call(
      com.atproto.admin.updateAccountPassword,
      { did, password: 'new-admin-password' },
      { headers: network.pds.adminAuthHeaders() },
    )

    // old password fails
    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: did,
        password,
      }),
    ).rejects.toThrow('Invalid identifier or password')

    await expect(
      client.call(com.atproto.server.createSession, {
        identifier: did,
        password: 'new-admin-password',
      }),
    ).resolves.toBeDefined()
  })
})
