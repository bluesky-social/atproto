import AtpAgent from '@atproto/api'
import * as jwt from 'jsonwebtoken'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import * as CreateSession from '@atproto/api/src/client/types/com/atproto/server/createSession'
import * as RefreshSession from '@atproto/api/src/client/types/com/atproto/server/refreshSession'
import { SeedClient } from './seeds/client'
import { adminAuth, CloseFn, runTestServer, TestServerInfo } from './_util'

describe('auth', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'auth',
    })
    agent = new AtpAgent({ service: server.url })
    close = server.close
  })

  afterAll(async () => {
    await close()
  })

  const createAccount = async (info) => {
    const { data } = await agent.api.com.atproto.server.createAccount(info)
    return data
  }
  const getSession = async (jwt) => {
    const { data } = await agent.api.com.atproto.server.getSession(
      {},
      {
        headers: SeedClient.getHeaders(jwt),
      },
    )
    return data
  }
  const createSession = async (info) => {
    const { data } = await agent.api.com.atproto.server.createSession(info)
    return data
  }
  const deleteSession = async (jwt) => {
    await agent.api.com.atproto.server.deleteSession(undefined, {
      headers: SeedClient.getHeaders(jwt),
    })
  }
  const refreshSession = async (jwt) => {
    const { data } = await agent.api.com.atproto.server.refreshSession(
      undefined,
      {
        headers: SeedClient.getHeaders(jwt),
      },
    )
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

  it('refresh token provides new token with same id on multiple uses during grace period.', async () => {
    const account = await createAccount({
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'password',
    })
    const refresh1 = await refreshSession(account.refreshJwt)
    const refresh2 = await refreshSession(account.refreshJwt)

    const token0 = jwt.decode(account.refreshJwt, { json: true })
    const token1 = jwt.decode(refresh1.refreshJwt, { json: true })
    const token2 = jwt.decode(refresh2.refreshJwt, { json: true })

    expect(typeof token1?.jti).toEqual('string')
    expect(token1?.jti).toEqual(token2?.jti)
    expect(token1?.jti).not.toEqual(token0?.jti)
    expect(token2?.jti).not.toEqual(token0?.jti)
  })

  it('refresh token is revoked after grace period completes.', async () => {
    const { db } = server.ctx
    const account = await createAccount({
      handle: 'evan.test',
      email: 'evan@test.com',
      password: 'password',
    })
    await refreshSession(account.refreshJwt)
    const token = jwt.decode(account.refreshJwt, { json: true })

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
    await expect(refreshWithAccess).rejects.toThrow(
      'Token could not be verified',
    )
  })

  it('expired refresh token cannot be used to refresh a session.', async () => {
    const { auth } = server.ctx
    const account = await createAccount({
      handle: 'holga.test',
      email: 'holga@test.com',
      password: 'password',
    })
    const refresh = auth.createRefreshToken({ did: account.did, expiresIn: -1 })
    const refreshExpired = refreshSession(refresh.jwt)
    await expect(refreshExpired).rejects.toThrow('Token has expired')
    await deleteSession(refresh.jwt) // No problem revoking an expired token
  })

  it('actor takedown disallows fresh session.', async () => {
    const account = await createAccount({
      handle: 'iris.test',
      email: 'iris@test.com',
      password: 'password',
    })
    await agent.api.com.atproto.admin.takeModerationAction(
      {
        action: TAKEDOWN,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: account.did,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    await expect(
      createSession({ identifier: 'iris.test', password: 'password' }),
    ).rejects.toThrow(CreateSession.AccountTakedownError)
  })

  it('actor takedown disallows refresh session.', async () => {
    const account = await createAccount({
      handle: 'jared.test',
      email: 'jared@test.com',
      password: 'password',
    })
    await agent.api.com.atproto.admin.takeModerationAction(
      {
        action: TAKEDOWN,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: account.did,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    await expect(refreshSession(account.refreshJwt)).rejects.toThrow(
      RefreshSession.AccountTakedownError,
    )
  })
})
