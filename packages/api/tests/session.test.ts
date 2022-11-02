import {
  CloseFn,
  runTestServer,
  TestServerInfo,
} from '@atproto/pds/tests/_util'
import * as locals from '@atproto/pds/src/locals'
import { sessionClient, Session, SessionServiceClient } from '..'

describe('session', () => {
  let server: TestServerInfo
  let client: SessionServiceClient
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'session',
    })
    client = sessionClient.service(server.url)
    close = server.close
  })

  afterAll(async () => {
    await close()
  })

  it('manages a new session on account creation.', async () => {
    const sessions: (Session | undefined)[] = []
    client.sessionManager.on('session', (session) => sessions.push(session))

    const { data: account } = await client.com.atproto.createAccount({
      username: 'alice.test',
      email: 'alice@test.com',
      password: 'password',
    })

    expect(client.sessionManager.active()).toEqual(true)
    expect(sessions).toEqual([
      { accessJwt: account.accessJwt, refreshJwt: account.refreshJwt },
    ])

    const { data: sessionInfo } = await client.com.atproto.getSession({})
    expect(sessionInfo).toEqual({
      did: account.did,
      name: account.username,
    })
  })

  it('ends a new session on session deletion.', async () => {
    const sessions: (Session | undefined)[] = []
    client.sessionManager.on('session', (session) => sessions.push(session))

    await client.com.atproto.deleteSession()

    expect(sessions).toEqual([undefined])
    expect(client.sessionManager.active()).toEqual(false)

    const getSessionAfterDeletion = client.com.atproto.getSession({})
    await expect(getSessionAfterDeletion).rejects.toThrow(
      'Authentication Required',
    )
  })

  it('manages a new session on session creation.', async () => {
    const sessions: (Session | undefined)[] = []
    client.sessionManager.on('session', (session) => sessions.push(session))

    const { data: session } = await client.com.atproto.createSession({
      username: 'alice.test',
      password: 'password',
    })

    expect(sessions).toEqual([
      { accessJwt: session.accessJwt, refreshJwt: session.refreshJwt },
    ])
    expect(client.sessionManager.active()).toEqual(true)

    const { data: sessionInfo } = await client.com.atproto.getSession({})
    expect(sessionInfo).toEqual({
      did: session.did,
      name: session.name,
    })
  })

  it('refreshes existing session.', async () => {
    const sessions: (Session | undefined)[] = []
    client.sessionManager.on('session', (session) => sessions.push(session))

    const { data: session } = await client.com.atproto.createSession({
      username: 'alice.test',
      password: 'password',
    })

    const { data: sessionRefresh } = await client.com.atproto.refreshSession()

    expect(sessions).toEqual([
      { accessJwt: session.accessJwt, refreshJwt: session.refreshJwt },
      {
        accessJwt: sessionRefresh.accessJwt,
        refreshJwt: sessionRefresh.refreshJwt,
      },
    ])
    expect(client.sessionManager.active()).toEqual(true)

    const { data: sessionInfo } = await client.com.atproto.getSession({})
    expect(sessionInfo).toEqual({
      did: sessionRefresh.did,
      name: sessionRefresh.name,
    })

    // Uses escape hatch: authorization set, so sessions are not managed by this call
    const refreshStaleSession = client.com.atproto.refreshSession(undefined, {
      headers: { authorization: `Bearer ${session.refreshJwt}` },
    })
    await expect(refreshStaleSession).rejects.toThrow('Token has been revoked')

    expect(sessions.length).toEqual(2)
    expect(client.sessionManager.active()).toEqual(true)
  })

  it('dedupes concurrent refreshes.', async () => {
    const sessions: (Session | undefined)[] = []
    client.sessionManager.on('session', (session) => sessions.push(session))

    const { data: session } = await client.com.atproto.createSession({
      username: 'alice.test',
      password: 'password',
    })

    const [{ data: sessionRefresh }] = await Promise.all(
      [...Array(10)].map(() => client.com.atproto.refreshSession()),
    )

    expect(sessions).toEqual([
      { accessJwt: session.accessJwt, refreshJwt: session.refreshJwt },
      {
        accessJwt: sessionRefresh.accessJwt,
        refreshJwt: sessionRefresh.refreshJwt,
      },
    ])
    expect(client.sessionManager.active()).toEqual(true)

    const { data: sessionInfo } = await client.com.atproto.getSession({})
    expect(sessionInfo).toEqual({
      did: sessionRefresh.did,
      name: sessionRefresh.name,
    })
  })

  it('manually sets and unsets existing session.', async () => {
    const sessions: (Session | undefined)[] = []
    client.sessionManager.on('session', (session) => sessions.push(session))

    const { data: session } = await client.com.atproto.createSession({
      username: 'alice.test',
      password: 'password',
    })
    const sessionCreds = {
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
    }
    expect(client.sessionManager.active()).toEqual(true)

    client.sessionManager.unset()
    expect(client.sessionManager.active()).toEqual(false)

    const getSessionAfterUnset = client.com.atproto.getSession({})
    await expect(getSessionAfterUnset).rejects.toThrow(
      'Authentication Required',
    )

    client.sessionManager.set(sessionCreds)
    expect(client.sessionManager.active()).toEqual(true)

    const { data: sessionInfo } = await client.com.atproto.getSession({})
    expect(sessionInfo).toEqual({
      did: session.did,
      name: session.name,
    })

    expect(sessions).toEqual([sessionCreds, undefined, sessionCreds])
    expect(client.sessionManager.active()).toEqual(true)
  })

  it('refreshes and retries request when access token is expired.', async () => {
    const sessions: (Session | undefined)[] = []
    client.sessionManager.on('session', (session) => sessions.push(session))
    const { auth } = locals.get(server.app)

    const { data: sessionInfo } = await client.com.atproto.getSession({})
    const accessExpired = await auth.createAccessToken(sessionInfo.did, -1)

    expect(sessions.length).toEqual(0)
    expect(client.sessionManager.active()).toEqual(true)

    client.sessionManager.set({
      refreshJwt: 'not-used-since-session-is-active',
      ...client.sessionManager.get(),
      accessJwt: accessExpired.jwt,
    })

    expect(sessions.length).toEqual(1)
    expect(client.sessionManager.active()).toEqual(true)

    const { data: updatedSessionInfo } = await client.com.atproto.getSession({})
    expect(updatedSessionInfo).toEqual(sessionInfo)

    expect(sessions.length).toEqual(2) // New session was created during getSession()
    expect(client.sessionManager.active()).toEqual(true)
  })

  it('unsets session when refresh token becomes expired.', async () => {
    const sessions: (Session | undefined)[] = []
    client.sessionManager.on('session', (session) => sessions.push(session))
    const { auth } = locals.get(server.app)

    const { data: sessionInfo } = await client.com.atproto.getSession({})
    const accessExpired = await auth.createAccessToken(sessionInfo.did, -1)
    const refreshExpired = await auth.createRefreshToken(sessionInfo.did, -1)

    expect(sessions.length).toEqual(0)
    expect(client.sessionManager.active()).toEqual(true)

    client.sessionManager.set({
      accessJwt: accessExpired.jwt,
      refreshJwt: refreshExpired.jwt,
    })

    expect(sessions.length).toEqual(1)
    expect(client.sessionManager.active()).toEqual(true)

    const getSessionAfterExpired = client.com.atproto.getSession({})
    await expect(getSessionAfterExpired).rejects.toThrow('Token has expired')

    expect(sessions.length).toEqual(2)
    expect(sessions[1]).toEqual(undefined)
    expect(client.sessionManager.active()).toEqual(false)
  })
})
