import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import * as CreateSession from '@atproto/api/src/client/types/com/atproto/session/create'
import * as RefreshSession from '@atproto/api/src/client/types/com/atproto/session/refresh'
import { SeedClient } from './seeds/client'
import { adminAuth, CloseFn, runTestServer, TestServerInfo } from './_util'

describe('auth', () => {
  let server: TestServerInfo
  let client: AtpServiceClient
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'auth',
    })
    client = AtpApi.service(server.url)
    close = server.close
  })

  afterAll(async () => {
    await close()
  })

  const createAccount = async (info) => {
    const { data } = await client.com.atproto.account.create(info)
    return data
  }
  const getSession = async (jwt) => {
    const { data } = await client.com.atproto.session.get(
      {},
      {
        headers: SeedClient.getHeaders(jwt),
      },
    )
    return data
  }
  const createSession = async (info) => {
    const { data } = await client.com.atproto.session.create(info)
    return data
  }
  const deleteSession = async (jwt) => {
    await client.com.atproto.session.delete(undefined, {
      headers: SeedClient.getHeaders(jwt),
    })
  }
  const refreshSession = async (jwt) => {
    const { data } = await client.com.atproto.session.refresh(undefined, {
      headers: SeedClient.getHeaders(jwt),
    })
    return data
  }

  it('provides valid access and refresh token on account creation.', async () => {
    const account = await createAccount({
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'password',
    })
    // Valid access token
    const sessionInfo = await getSession(account.accessJwt)
    expect(sessionInfo).toEqual({ did: account.did, handle: account.handle })
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
    await createAccount({
      handle: 'bob.test',
      email: 'bob@test.com',
      password: 'password',
    })
    const session = await createSession({
      handle: 'bob.test',
      password: 'password',
    })
    // Valid access token
    const sessionInfo = await getSession(session.accessJwt)
    expect(sessionInfo).toEqual({
      did: session.did,
      handle: session.handle,
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

  it('fails on session creation with a bad password', async () => {
    const sessionPromise = createSession({
      handle: 'bob.test',
      password: 'wrong-pass',
    })
    await expect(sessionPromise).rejects.toThrow('Invalid handle or password')
  })

  it('provides valid access and refresh token on session refresh.', async () => {
    const account = await createAccount({
      handle: 'carol.test',
      email: 'carol@test.com',
      password: 'password',
    })
    const session = await refreshSession(account.refreshJwt)
    // Valid access token
    const sessionInfo = await getSession(session.accessJwt)
    expect(sessionInfo).toEqual({
      did: session.did,
      handle: session.handle,
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

  it('refresh token is revoked after use.', async () => {
    const account = await createAccount({
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'password',
    })
    await refreshSession(account.refreshJwt)
    const refreshAgain = refreshSession(account.refreshJwt)
    await expect(refreshAgain).rejects.toThrow('Token has been revoked')
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
    const account = await createAccount({
      handle: 'holga.test',
      email: 'holga@test.com',
      password: 'password',
    })
    const refresh = server.ctx.auth.createRefreshToken(account.did, -1)
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
    const { data: profile } = await client.app.bsky.actor.getProfile(
      { actor: account.did },
      { headers: SeedClient.getHeaders(account.accessJwt) },
    )
    await client.app.bsky.administration.takeModerationAction(
      {
        action: 'takedown',
        subject: {
          $type: 'app.bsky.actor.ref',
          did: profile.did,
          declarationCid: profile.declaration.cid,
        },
        createdBy: 'X',
        rationale: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    await expect(
      createSession({ handle: 'iris.test', password: 'password' }),
    ).rejects.toThrow(CreateSession.AccountTakedownError)
  })

  it('actor takedown disallows refresh session.', async () => {
    const account = await createAccount({
      handle: 'jared.test',
      email: 'jared@test.com',
      password: 'password',
    })
    const { data: profile } = await client.app.bsky.actor.getProfile(
      { actor: account.did },
      { headers: SeedClient.getHeaders(account.accessJwt) },
    )
    await client.app.bsky.administration.takeModerationAction(
      {
        action: 'takedown',
        subject: {
          $type: 'app.bsky.actor.ref',
          did: profile.did,
          declarationCid: profile.declaration.cid,
        },
        createdBy: 'X',
        rationale: 'Y',
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
