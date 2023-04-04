import { defaultFetchHandler } from '@atproto/xrpc'
import {
  CloseFn,
  runTestServer,
  TestServerInfo,
} from '@atproto/pds/tests/_util'
import {
  AtpAgent,
  AtpAgentFetchHandlerResponse,
  AtpSessionEvent,
  AtpSessionData,
} from '..'

describe('agent', () => {
  let server: TestServerInfo
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'api_agent',
    })
    close = server.close
  })

  afterAll(async () => {
    await close()
  })

  it('creates a new session on account creation.', async () => {
    const events: string[] = []
    const sessions: (AtpSessionData | undefined)[] = []
    const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      events.push(evt)
      sessions.push(sess)
    }

    const agent = new AtpAgent({ service: server.url, persistSession })

    const res = await agent.createAccount({
      handle: 'user1.test',
      email: 'user1@test.com',
      password: 'password',
    })

    expect(agent.hasSession).toEqual(true)
    expect(agent.session?.accessJwt).toEqual(res.data.accessJwt)
    expect(agent.session?.refreshJwt).toEqual(res.data.refreshJwt)
    expect(agent.session?.handle).toEqual(res.data.handle)
    expect(agent.session?.did).toEqual(res.data.did)
    expect(agent.session?.email).toEqual('user1@test.com')

    const { data: sessionInfo } = await agent.api.com.atproto.server.getSession(
      {},
    )
    expect(sessionInfo).toEqual({
      did: res.data.did,
      handle: res.data.handle,
      email: 'user1@test.com',
    })

    expect(events.length).toEqual(1)
    expect(events[0]).toEqual('create')
    expect(sessions.length).toEqual(1)
    expect(sessions[0]?.accessJwt).toEqual(agent.session?.accessJwt)
  })

  it('creates a new session on login.', async () => {
    const events: string[] = []
    const sessions: (AtpSessionData | undefined)[] = []
    const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      events.push(evt)
      sessions.push(sess)
    }

    const agent1 = new AtpAgent({ service: server.url, persistSession })

    const email = 'user2@test.com'
    await agent1.createAccount({
      handle: 'user2.test',
      email,
      password: 'password',
    })

    const agent2 = new AtpAgent({ service: server.url, persistSession })
    const res1 = await agent2.login({
      identifier: 'user2.test',
      password: 'password',
    })

    expect(agent2.hasSession).toEqual(true)
    expect(agent2.session?.accessJwt).toEqual(res1.data.accessJwt)
    expect(agent2.session?.refreshJwt).toEqual(res1.data.refreshJwt)
    expect(agent2.session?.handle).toEqual(res1.data.handle)
    expect(agent2.session?.did).toEqual(res1.data.did)
    expect(agent2.session?.email).toEqual('user2@test.com')

    const { data: sessionInfo } =
      await agent2.api.com.atproto.server.getSession({})
    expect(sessionInfo).toEqual({
      did: res1.data.did,
      handle: res1.data.handle,
      email,
    })

    expect(events.length).toEqual(2)
    expect(events[0]).toEqual('create')
    expect(events[1]).toEqual('create')
    expect(sessions.length).toEqual(2)
    expect(sessions[0]?.accessJwt).toEqual(agent1.session?.accessJwt)
    expect(sessions[1]?.accessJwt).toEqual(agent2.session?.accessJwt)
  })

  it('resumes an existing session.', async () => {
    const events: string[] = []
    const sessions: (AtpSessionData | undefined)[] = []
    const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      events.push(evt)
      sessions.push(sess)
    }

    const agent1 = new AtpAgent({ service: server.url, persistSession })

    await agent1.createAccount({
      handle: 'user3.test',
      email: 'user3@test.com',
      password: 'password',
    })
    if (!agent1.session) {
      throw new Error('No session created')
    }

    const agent2 = new AtpAgent({ service: server.url, persistSession })
    const res1 = await agent2.resumeSession(agent1.session)

    expect(agent2.hasSession).toEqual(true)
    expect(agent2.session?.handle).toEqual(res1.data.handle)
    expect(agent2.session?.did).toEqual(res1.data.did)

    const { data: sessionInfo } =
      await agent2.api.com.atproto.server.getSession({})
    expect(sessionInfo).toEqual({
      did: res1.data.did,
      handle: res1.data.handle,
      email: res1.data.email,
    })

    expect(events.length).toEqual(2)
    expect(events[0]).toEqual('create')
    expect(events[1]).toEqual('create')
    expect(sessions.length).toEqual(2)
    expect(sessions[0]?.accessJwt).toEqual(agent1.session?.accessJwt)
    expect(sessions[1]?.accessJwt).toEqual(agent2.session?.accessJwt)
  })

  it('refreshes existing session.', async () => {
    const events: string[] = []
    const sessions: (AtpSessionData | undefined)[] = []
    const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      events.push(evt)
      sessions.push(sess)
    }

    const agent = new AtpAgent({ service: server.url, persistSession })

    // create an account and a session with it
    await agent.createAccount({
      handle: 'user4.test',
      email: 'user4@test.com',
      password: 'password',
    })
    if (!agent.session) {
      throw new Error('No session created')
    }
    const session1 = agent.session
    const origAccessJwt = session1.accessJwt

    // wait 1 second so that a token refresh will issue a new access token
    // (if the timestamp, which has 1 second resolution, is the same -- then the access token won't change)
    await new Promise((r) => setTimeout(r, 1000))

    // patch the fetch handler to fake an expired token error on the next request
    const tokenExpiredFetchHandler = async function (
      httpUri: string,
      httpMethod: string,
      httpHeaders: Record<string, string>,
      httpReqBody: unknown,
    ): Promise<AtpAgentFetchHandlerResponse> {
      if (httpHeaders.authorization === `Bearer ${origAccessJwt}`) {
        return {
          status: 400,
          headers: {},
          body: { error: 'ExpiredToken' },
        }
      }
      return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody)
    }

    // put the agent through the auth flow
    AtpAgent.configure({ fetch: tokenExpiredFetchHandler })
    const res1 = await agent.api.app.bsky.feed.getTimeline()
    AtpAgent.configure({ fetch: defaultFetchHandler })

    expect(res1.success).toEqual(true)
    expect(agent.hasSession).toEqual(true)
    expect(agent.session?.accessJwt).not.toEqual(session1.accessJwt)
    expect(agent.session?.refreshJwt).not.toEqual(session1.refreshJwt)
    expect(agent.session?.handle).toEqual(session1.handle)
    expect(agent.session?.did).toEqual(session1.did)

    expect(events.length).toEqual(2)
    expect(events[0]).toEqual('create')
    expect(events[1]).toEqual('update')
    expect(sessions.length).toEqual(2)
    expect(sessions[0]?.accessJwt).toEqual(origAccessJwt)
    expect(sessions[1]?.accessJwt).toEqual(agent.session?.accessJwt)
  })

  it('dedupes session refreshes.', async () => {
    const events: string[] = []
    const sessions: (AtpSessionData | undefined)[] = []
    const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      events.push(evt)
      sessions.push(sess)
    }

    const agent = new AtpAgent({ service: server.url, persistSession })

    // create an account and a session with it
    await agent.createAccount({
      handle: 'user5.test',
      email: 'user5@test.com',
      password: 'password',
    })
    if (!agent.session) {
      throw new Error('No session created')
    }
    const session1 = agent.session
    const origAccessJwt = session1.accessJwt

    // wait 1 second so that a token refresh will issue a new access token
    // (if the timestamp, which has 1 second resolution, is the same -- then the access token won't change)
    await new Promise((r) => setTimeout(r, 1000))

    // patch the fetch handler to fake an expired token error on the next request
    let expiredCalls = 0
    let refreshCalls = 0
    const tokenExpiredFetchHandler = async function (
      httpUri: string,
      httpMethod: string,
      httpHeaders: Record<string, string>,
      httpReqBody: unknown,
    ): Promise<AtpAgentFetchHandlerResponse> {
      if (httpHeaders.authorization === `Bearer ${origAccessJwt}`) {
        expiredCalls++
        return {
          status: 400,
          headers: {},
          body: { error: 'ExpiredToken' },
        }
      }
      if (httpUri.includes('com.atproto.server.refreshSession')) {
        refreshCalls++
      }
      return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody)
    }

    // put the agent through the auth flow
    AtpAgent.configure({ fetch: tokenExpiredFetchHandler })
    const [res1, res2, res3] = await Promise.all([
      agent.api.app.bsky.feed.getTimeline(),
      agent.api.app.bsky.feed.getTimeline(),
      agent.api.app.bsky.feed.getTimeline(),
    ])
    AtpAgent.configure({ fetch: defaultFetchHandler })

    expect(expiredCalls).toEqual(3)
    expect(refreshCalls).toEqual(1)
    expect(res1.success).toEqual(true)
    expect(res2.success).toEqual(true)
    expect(res3.success).toEqual(true)
    expect(agent.hasSession).toEqual(true)
    expect(agent.session?.accessJwt).not.toEqual(session1.accessJwt)
    expect(agent.session?.refreshJwt).not.toEqual(session1.refreshJwt)
    expect(agent.session?.handle).toEqual(session1.handle)
    expect(agent.session?.did).toEqual(session1.did)

    expect(events.length).toEqual(2)
    expect(events[0]).toEqual('create')
    expect(events[1]).toEqual('update')
    expect(sessions.length).toEqual(2)
    expect(sessions[0]?.accessJwt).toEqual(origAccessJwt)
    expect(sessions[1]?.accessJwt).toEqual(agent.session?.accessJwt)
  })

  it('persists an empty session on login and resumeSession failures', async () => {
    const events: string[] = []
    const sessions: (AtpSessionData | undefined)[] = []
    const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      events.push(evt)
      sessions.push(sess)
    }

    const agent = new AtpAgent({ service: server.url, persistSession })

    try {
      await agent.login({
        identifier: 'baduser.test',
        password: 'password',
      })
    } catch (_e: any) {
      // ignore
    }
    expect(agent.hasSession).toEqual(false)

    try {
      await agent.resumeSession({
        accessJwt: 'bad',
        refreshJwt: 'bad',
        did: 'bad',
        handle: 'bad',
      })
    } catch (_e: any) {
      // ignore
    }
    expect(agent.hasSession).toEqual(false)

    expect(events.length).toEqual(2)
    expect(events[0]).toEqual('create-failed')
    expect(events[1]).toEqual('create-failed')
    expect(sessions.length).toEqual(2)
    expect(typeof sessions[0]).toEqual('undefined')
    expect(typeof sessions[1]).toEqual('undefined')
  })

  it('does not modify or persist the session on a failed refresh', async () => {
    const events: string[] = []
    const sessions: (AtpSessionData | undefined)[] = []
    const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      events.push(evt)
      sessions.push(sess)
    }

    const agent = new AtpAgent({ service: server.url, persistSession })

    // create an account and a session with it
    await agent.createAccount({
      handle: 'user6.test',
      email: 'user6@test.com',
      password: 'password',
    })
    if (!agent.session) {
      throw new Error('No session created')
    }
    const session1 = agent.session
    const origAccessJwt = session1.accessJwt

    // patch the fetch handler to fake an expired token error on the next request
    const tokenExpiredFetchHandler = async function (
      httpUri: string,
      httpMethod: string,
      httpHeaders: Record<string, string>,
      httpReqBody: unknown,
    ): Promise<AtpAgentFetchHandlerResponse> {
      if (httpHeaders.authorization === `Bearer ${origAccessJwt}`) {
        return {
          status: 400,
          headers: {},
          body: { error: 'ExpiredToken' },
        }
      }
      if (httpUri.includes('com.atproto.server.refreshSession')) {
        return {
          status: 500,
          headers: {},
          body: undefined,
        }
      }
      return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody)
    }

    // put the agent through the auth flow
    AtpAgent.configure({ fetch: tokenExpiredFetchHandler })
    try {
      await agent.api.app.bsky.feed.getTimeline()
      throw new Error('Should have failed')
    } catch (e: any) {
      // the original error passes through
      expect(e.status).toEqual(400)
      expect(e.error).toEqual('ExpiredToken')
    }
    AtpAgent.configure({ fetch: defaultFetchHandler })

    // still has session because it wasn't invalidated
    expect(agent.hasSession).toEqual(true)

    expect(events.length).toEqual(1)
    expect(events[0]).toEqual('create')
    expect(sessions.length).toEqual(1)
    expect(sessions[0]?.accessJwt).toEqual(origAccessJwt)
  })
})
