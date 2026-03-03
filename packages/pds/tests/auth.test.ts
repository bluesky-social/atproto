import * as jose from 'jose'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { createRefreshToken } from '../src/account-manager/helpers/auth'

describe('auth', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'auth',
    })
    agent = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  const createAccount = async (info) => {
    const { data } = await agent.com.atproto.server.createAccount(info)
    return data
  }
  const getSession = async (jwt) => {
    const { data } = await agent.com.atproto.server.getSession(
      {},
      {
        headers: SeedClient.getHeaders(jwt),
      },
    )
    return data
  }
  const createSession = async (info) => {
    const { data } = await agent.com.atproto.server.createSession(info)
    return data
  }
  const deleteSession = async (jwt) => {
    await agent.com.atproto.server.deleteSession(undefined, {
      headers: SeedClient.getHeaders(jwt),
    })
  }
  const refreshSession = async (jwt: string) => {
    const { data } = await agent.com.atproto.server.refreshSession(undefined, {
      headers: SeedClient.getHeaders(jwt),
    })
    return data
  }

  it('provides valid access and refresh token on account creation.', async () => {
    const email = 'alice@test.com'
    const account = await createAccount({
      handle: 'alice.test',
      email,
      password: 'password',
    })
    // Valid access token
    const sessionInfo = await getSession(account.accessJwt)
    expect(sessionInfo).toEqual({
      did: account.did,
      handle: account.handle,
      email,
      emailConfirmed: false,
      active: true,
    })
    // Valid refresh token
    const nextSession = await refreshSession(account.refreshJwt)
    expect(nextSession).toEqual(
      expect.objectContaining({
        did: account.did,
        handle: account.handle,
      }),
    )
  })

  it('provides valid access and refresh token on session creation.', async () => {
    const email = 'bob@test.com'
    await createAccount({
      handle: 'bob.test',
      email,
      password: 'password',
    })
    const session = await createSession({
      identifier: 'bob.test',
      password: 'password',
    })
    // Valid access token
    const sessionInfo = await getSession(session.accessJwt)
    expect(sessionInfo).toEqual({
      did: session.did,
      handle: session.handle,
      email,
      emailConfirmed: false,
      active: true,
    })
    // Valid refresh token
    const nextSession = await refreshSession(session.refreshJwt)
    expect(nextSession).toEqual(
      expect.objectContaining({
        did: session.did,
        handle: session.handle,
      }),
    )
  })

  it('allows session creation using email address.', async () => {
    const session = await createSession({
      identifier: 'bob@TEST.com',
      password: 'password',
    })
    expect(session.handle).toEqual('bob.test')
  })

  it('fails on session creation with a bad password.', async () => {
    const sessionPromise = createSession({
      identifier: 'bob.test',
      password: 'wrong-pass',
    })
    await expect(sessionPromise).rejects.toThrow(
      'Invalid identifier or password',
    )
  })

  it('provides valid access and refresh token on session refresh.', async () => {
    const email = 'carol@test.com'
    const account = await createAccount({
      handle: 'carol.test',
      password: 'password',
      email,
    })
    const session = await refreshSession(account.refreshJwt)
    // Valid access token
    const sessionInfo = await getSession(session.accessJwt)
    expect(sessionInfo).toEqual({
      did: session.did,
      handle: session.handle,
      email,
      emailConfirmed: false,
      active: true,
    })
    // Valid refresh token
    const nextSession = await refreshSession(session.refreshJwt)
    expect(nextSession).toEqual(
      expect.objectContaining({
        did: session.did,
        handle: session.handle,
      }),
    )
  })

  it('handles racing refreshes', async () => {
    const email = 'dan@test.com'
    const account = await createAccount({
      handle: 'dan.test',
      password: 'password',
      email,
    })
    const tokenIdPromises: Promise<string>[] = []
    const doRefresh = async () => {
      const res = await refreshSession(account.refreshJwt)
      const decoded = jose.decodeJwt(res.refreshJwt)
      if (!decoded?.jti) {
        throw new Error('undefined jti on refresh token')
      }
      return decoded.jti
    }
    for (let i = 0; i < 10; i++) {
      tokenIdPromises.push(doRefresh())
    }
    const tokenIds = await Promise.all(tokenIdPromises)
    for (let i = 0; i < 10; i++) {
      expect(tokenIds[i]).toEqual(tokenIds[0])
    }
  })

  it('refresh token provides new token with same id on multiple uses during grace period.', async () => {
    const account = await createAccount({
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'password',
    })
    const refresh1 = await refreshSession(account.refreshJwt)
    const refresh2 = await refreshSession(account.refreshJwt)

    const token0 = jose.decodeJwt(account.refreshJwt)
    const token1 = jose.decodeJwt(refresh1.refreshJwt)
    const token2 = jose.decodeJwt(refresh2.refreshJwt)

    expect(typeof token1?.jti).toEqual('string')
    expect(token1?.jti).toEqual(token2?.jti)
    expect(token1?.jti).not.toEqual(token0?.jti)
    expect(token2?.jti).not.toEqual(token0?.jti)
  })

  it('refresh token is revoked after grace period completes.', async () => {
    const { db } = network.pds.ctx.accountManager
    const account = await createAccount({
      handle: 'evan.test',
      email: 'evan@test.com',
      password: 'password',
    })
    await refreshSession(account.refreshJwt)
    const token = jose.decodeJwt(account.refreshJwt)

    // Update expiration (i.e. grace period) to end immediately
    const refreshUpdated = await db.db
      .updateTable('refresh_token')
      .set({ expiresAt: new Date().toISOString() })
      .where('id', '=', token?.jti ?? '')
      .executeTakeFirst()
    expect(Number(refreshUpdated.numUpdatedRows)).toEqual(1)

    // Token can no longer be used
    const refreshAgain = refreshSession(account.refreshJwt)
    await expect(refreshAgain).rejects.toThrow('Token has been revoked')

    // Ensure that token was cleaned-up
    const refreshInfo = await db.db
      .selectFrom('refresh_token')
      .selectAll()
      .where('id', '=', token?.jti ?? '')
      .executeTakeFirst()
    expect(refreshInfo).toBeUndefined()
  })

  it('refresh token is revoked when session is deleted.', async () => {
    const account = await createAccount({
      handle: 'finn.test',
      email: 'finn@test.com',
      password: 'password',
    })
    await deleteSession(account.refreshJwt)
    const refreshDeleted = refreshSession(account.refreshJwt)
    await expect(refreshDeleted).rejects.toThrow('Token has been revoked')
    await deleteSession(account.refreshJwt) // No problem double-revoking a token
  })

  it('access token cannot be used to refresh a session.', async () => {
    const account = await createAccount({
      handle: 'gordon.test',
      email: 'gordon@test.com',
      password: 'password',
    })
    const refreshWithAccess = refreshSession(account.accessJwt)
    await expect(refreshWithAccess).rejects.toThrow('Invalid token type')
  })

  it('expired refresh token cannot be used to refresh a session.', async () => {
    const account = await createAccount({
      handle: 'holga.test',
      email: 'holga@test.com',
      password: 'password',
    })
    const refreshJwt = await createRefreshToken({
      did: account.did,
      jwtKey: network.pds.jwtSecretKey(),
      serviceDid: network.pds.ctx.cfg.service.did,
      expiresIn: -1,
    })
    const refreshExpired = refreshSession(refreshJwt)
    await expect(refreshExpired).rejects.toThrow('Token has expired')
    await deleteSession(refreshJwt) // No problem revoking an expired token
  })

  it('actor takedown disallows fresh session.', async () => {
    const account = await createAccount({
      handle: 'iris.test',
      email: 'iris@test.com',
      password: 'password',
    })
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
    await expect(
      createSession({ identifier: 'iris.test', password: 'password' }),
    ).rejects.toMatchObject({
      error: 'AccountTakedown',
    })
  })

  it('actor takedown disallows refresh session.', async () => {
    const account = await createAccount({
      handle: 'jared.test',
      email: 'jared@test.com',
      password: 'password',
    })
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
    await expect(refreshSession(account.refreshJwt)).rejects.toMatchObject({
      error: 'AccountTakedown',
    })
  })

  describe('RemoteLogin Removal Regression Tests', () => {
    it('createSession works with standard password (no RemoteLogin wid: prefix)', async () => {
      const email = 'regtest1@test.com'
      await createAccount({
        handle: 'regtest1.test',
        email,
        password: 'mypassword123',
      })

      // Should NOT accept "wid:" prefix (RemoteLogin is removed)
      const session = await createSession({
        identifier: 'regtest1.test',
        password: 'mypassword123',
      })

      expect(session.handle).toBe('regtest1.test')
      expect(session.did).toBeTruthy()
      expect(session.accessJwt).toBeTruthy()
    })

    it('createSession rejects RemoteLogin-style wid: password prefix', async () => {
      const email = 'regtest2@test.com'
      await createAccount({
        handle: 'regtest2.test',
        email,
        password: 'mypassword',
      })

      // RemoteLogin used "wid:" prefix - should fail now
      await expect(
        createSession({
          identifier: 'regtest2.test',
          password: 'wid:mypassword',
        }),
      ).rejects.toThrow('Invalid identifier or password')
    })

    it('createSession does not treat @legal. usernames specially', async () => {
      const email = 'regtest3@test.com'
      const account = await createAccount({
        handle: 'regtest3.test',
        email,
        password: 'normalpass',
      })

      // RemoteLogin allowed usernames like "user@legal.domain.io"
      // Now these are just invalid identifiers
      await expect(
        createSession({
          identifier: 'regtest3@legal.test.com',
          password: 'normalpass',
        }),
      ).rejects.toThrow()

      // Standard handle login should work
      const session = await createSession({
        identifier: 'regtest3.test',
        password: 'normalpass',
      })
      expect(session.did).toBe(account.did)
    })

    it('createAccount works with standard password', async () => {
      const account = await createAccount({
        handle: 'regtest4.test',
        email: 'regtest4@test.com',
        password: 'standardPassword456',
      })

      expect(account.handle).toBe('regtest4.test')
      expect(account.did).toBeTruthy()
      expect(account.accessJwt).toBeTruthy()

      // Can login with standard credentials
      const session = await createSession({
        identifier: 'regtest4.test',
        password: 'standardPassword456',
      })
      expect(session.did).toBe(account.did)
    })

    it('createAccount does not perform Legal ID validation', async () => {
      // RemoteLogin used to validate Legal ID uniqueness during createAccount
      // This should no longer happen
      const account1 = await createAccount({
        handle: 'regtest5.test',
        email: 'regtest5@test.com',
        password: 'pass123',
      })

      const account2 = await createAccount({
        handle: 'regtest6.test',
        email: 'regtest6@test.com',
        password: 'pass456',
      })

      // Both should succeed without Legal ID checks
      expect(account1.did).toBeTruthy()
      expect(account2.did).toBeTruthy()
      expect(account1.did).not.toBe(account2.did)
    })
  })
})
