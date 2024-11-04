import { AddressInfo } from 'node:net'
import assert from 'assert'
import {
  AtpAgent,
  AtpSessionEvent,
  AtpSessionData,
  BSKY_LABELER_DID,
} from '../src'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { getPdsEndpoint, isValidDidDoc } from '@atproto/common-web'
import { createHeaderEchoServer } from './util/echo-server'

const getPdsEndpointUrl = (...args: Parameters<typeof getPdsEndpoint>) => {
  const endpoint = getPdsEndpoint(...args)
  return endpoint ? new URL(endpoint) : endpoint
}

describe('AtpAgent', () => {
  let network: TestNetworkNoAppView

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'api_agent',
      pds: {
        enableDidDocWithSession: true,
      },
    })
  })

  afterAll(async () => {
    await network.close()
  })

  it('clones correctly', () => {
    const persistSession = (_evt: AtpSessionEvent, _sess?: AtpSessionData) => {}
    const agent = new AtpAgent({ service: network.pds.url, persistSession })
    const agent2 = agent.clone()
    expect(agent2 instanceof AtpAgent).toBeTruthy()
    expect(agent.serviceUrl).toEqual(agent2.serviceUrl)
  })

  it('creates a new session on account creation.', async () => {
    const events: string[] = []
    const sessions: (AtpSessionData | undefined)[] = []
    const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      events.push(evt)
      sessions.push(sess)
    }

    const agent = new AtpAgent({ service: network.pds.url, persistSession })

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
    expect(agent.session?.emailConfirmed).toEqual(false)
    assert(isValidDidDoc(res.data.didDoc))
    expect(agent.pdsUrl).toEqual(getPdsEndpointUrl(res.data.didDoc))

    const { data: sessionInfo } = await agent.com.atproto.server.getSession({})
    expect(sessionInfo).toMatchObject({
      did: res.data.did,
      handle: res.data.handle,
      email: 'user1@test.com',
      emailConfirmed: false,
    })
    expect(isValidDidDoc(sessionInfo.didDoc)).toBe(true)

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

    const agent1 = new AtpAgent({ service: network.pds.url, persistSession })

    const email = 'user2@test.com'
    await agent1.createAccount({
      handle: 'user2.test',
      email,
      password: 'password',
    })

    const agent2 = new AtpAgent({ service: network.pds.url, persistSession })
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
    expect(agent2.session?.emailConfirmed).toEqual(false)
    assert(isValidDidDoc(res1.data.didDoc))
    expect(agent2.pdsUrl).toEqual(getPdsEndpointUrl(res1.data.didDoc))

    const { data: sessionInfo } = await agent2.com.atproto.server.getSession({})
    expect(sessionInfo).toMatchObject({
      did: res1.data.did,
      handle: res1.data.handle,
      email,
      emailConfirmed: false,
    })
    expect(isValidDidDoc(sessionInfo.didDoc)).toBe(true)

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

    const agent1 = new AtpAgent({ service: network.pds.url, persistSession })

    await agent1.createAccount({
      handle: 'user3.test',
      email: 'user3@test.com',
      password: 'password',
    })
    if (!agent1.session) {
      throw new Error('No session created')
    }

    const agent2 = new AtpAgent({ service: network.pds.url, persistSession })
    const res1 = await agent2.resumeSession(agent1.session)

    expect(agent2.hasSession).toEqual(true)
    expect(agent2.session?.handle).toEqual(res1.data.handle)
    expect(agent2.session?.did).toEqual(res1.data.did)
    assert(isValidDidDoc(res1.data.didDoc))
    expect(agent2.pdsUrl).toEqual(getPdsEndpointUrl(res1.data.didDoc))

    const { data: sessionInfo } = await agent2.com.atproto.server.getSession({})
    expect(sessionInfo).toMatchObject({
      did: res1.data.did,
      handle: res1.data.handle,
      email: res1.data.email,
      emailConfirmed: false,
    })
    expect(isValidDidDoc(sessionInfo.didDoc)).toBe(true)

    expect(events.length).toEqual(2)
    expect(events[0]).toEqual('create')
    expect(events[1]).toEqual('update')
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

    const agent = new AtpAgent({ service: network.pds.url, persistSession })

    // create an account and a session with it
    await agent.createAccount({
      handle: 'user4.test',
      email: 'user4@test.com',
      password: 'password',
    })
    if (!agent.session?.refreshJwt) {
      throw new Error('No session created')
    }
    const session1 = agent.session
    const origAccessJwt = session1.accessJwt

    // wait 1 second so that a token refresh will issue a new access token
    // (if the timestamp, which has 1 second resolution, is the same -- then the access token won't change)
    await new Promise((r) => setTimeout(r, 1000))

    // patch the fetch handler to fake an expired token error on the next request
    agent.sessionManager.setFetch(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const req = new Request(input, init)
        if (
          req.headers.get('authorization') === `Bearer ${origAccessJwt}` &&
          !req.url.includes('com.atproto.server.refreshSession')
        ) {
          return new Response(JSON.stringify({ error: 'ExpiredToken' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return globalThis.fetch(req)
      },
    )

    // put the agent through the auth flow
    const res1 = await createPost(agent)

    expect(res1.success).toEqual(true)
    expect(agent.hasSession).toEqual(true)
    expect(agent.session?.accessJwt).not.toEqual(session1.accessJwt)
    expect(agent.session?.refreshJwt).not.toEqual(session1.refreshJwt)
    expect(agent.session?.handle).toEqual(session1.handle)
    expect(agent.session?.did).toEqual(session1.did)
    expect(agent.session?.email).toEqual(session1.email)
    expect(agent.session?.emailConfirmed).toEqual(session1.emailConfirmed)

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

    const agent = new AtpAgent({ service: network.pds.url, persistSession })

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

    agent.sessionManager.setFetch(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const req = new Request(input, init)
        if (req.headers.get('authorization') === `Bearer ${origAccessJwt}`) {
          expiredCalls++
          return new Response(JSON.stringify({ error: 'ExpiredToken' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (req.url.includes('com.atproto.server.refreshSession')) {
          refreshCalls++
        }
        return globalThis.fetch(req)
      },
    )

    // put the agent through the auth flow
    const [res1, res2, res3] = await Promise.all([
      createPost(agent),
      createPost(agent),
      createPost(agent),
    ])

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
    expect(agent.session?.email).toEqual(session1.email)
    expect(agent.session?.emailConfirmed).toEqual(session1.emailConfirmed)

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

    const agent = new AtpAgent({ service: network.pds.url, persistSession })

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
        active: true,
      })
    } catch (_e: any) {
      // ignore
    }
    expect(agent.hasSession).toEqual(false)

    expect(events.length).toEqual(2)
    expect(events[0]).toEqual('create-failed')
    expect(events[1]).toEqual('expired')
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

    const agent = new AtpAgent({ service: network.pds.url, persistSession })

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
    agent.sessionManager.setFetch(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const req = new Request(input, init)
        if (req.headers.get('authorization') === `Bearer ${origAccessJwt}`) {
          return new Response(JSON.stringify({ error: 'ExpiredToken' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (req.url.includes('com.atproto.server.refreshSession')) {
          return new Response(undefined, { status: 500 })
        }
        return globalThis.fetch(req)
      },
    )

    // put the agent through the auth flow
    try {
      await agent.app.bsky.feed.getTimeline()
      throw new Error('Should have failed')
    } catch (e: any) {
      // the original error passes through
      expect(e.status).toEqual(400)
      expect(e.error).toEqual('ExpiredToken')
    }

    // still has session because it wasn't invalidated
    expect(agent.hasSession).toEqual(true)

    expect(events.length).toEqual(1)
    expect(events[0]).toEqual('create')
    expect(sessions.length).toEqual(1)
    expect(sessions[0]?.accessJwt).toEqual(origAccessJwt)
  })

  describe('createAccount', () => {
    it('persists an empty session on failure', async () => {
      const events: string[] = []
      const sessions: (AtpSessionData | undefined)[] = []
      const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
        events.push(evt)
        sessions.push(sess)
      }

      const agent = new AtpAgent({ service: network.pds.url, persistSession })

      await expect(
        agent.createAccount({
          handle: '',
          email: '',
          password: 'password',
        }),
      ).rejects.toThrow()

      expect(agent.hasSession).toEqual(false)
      expect(agent.session).toEqual(undefined)
      expect(events.length).toEqual(1)
      expect(events[0]).toEqual('create-failed')
      expect(sessions.length).toEqual(1)
      expect(sessions[0]).toEqual(undefined)
    })
  })

  describe('App labelers header', () => {
    it('adds the labelers header as expected', async () => {
      const server = await createHeaderEchoServer()
      const port = (server.address() as AddressInfo).port
      const agent = new AtpAgent({ service: `http://localhost:${port}` })
      const agent2 = new AtpAgent({ service: `http://localhost:${port}` })

      const res1 = await agent.com.atproto.server.describeServer()
      expect(res1.data['atproto-accept-labelers']).toEqual(
        `${BSKY_LABELER_DID};redact`,
      )

      AtpAgent.configure({ appLabelers: ['did:plc:test1', 'did:plc:test2'] })
      const res2 = await agent.com.atproto.server.describeServer()
      expect(res2.data['atproto-accept-labelers']).toEqual(
        'did:plc:test1;redact, did:plc:test2;redact',
      )
      const res3 = await agent2.com.atproto.server.describeServer()
      expect(res3.data['atproto-accept-labelers']).toEqual(
        'did:plc:test1;redact, did:plc:test2;redact',
      )
      AtpAgent.configure({ appLabelers: [BSKY_LABELER_DID] })

      await new Promise((r) => server.close(r))
    })
  })

  describe('configureLabelers', () => {
    it('adds the labelers header as expected', async () => {
      const server = await createHeaderEchoServer()
      const port = (server.address() as AddressInfo).port
      const agent = new AtpAgent({ service: `http://localhost:${port}` })

      agent.configureLabelers(['did:plc:test1'])
      const res1 = await agent.com.atproto.server.describeServer()
      expect(res1.data['atproto-accept-labelers']).toEqual(
        `${BSKY_LABELER_DID};redact, did:plc:test1`,
      )

      agent.configureLabelers(['did:plc:test1', 'did:plc:test2'])
      const res2 = await agent.com.atproto.server.describeServer()
      expect(res2.data['atproto-accept-labelers']).toEqual(
        `${BSKY_LABELER_DID};redact, did:plc:test1, did:plc:test2`,
      )

      await new Promise((r) => server.close(r))
    })
  })

  describe('configureProxy', () => {
    it('adds the proxy header as expected', async () => {
      const server = await createHeaderEchoServer()
      const port = (server.address() as AddressInfo).port
      const agent = new AtpAgent({ service: `http://localhost:${port}` })

      const res1 = await agent.com.atproto.server.describeServer()
      expect(res1.data['atproto-proxy']).toBeFalsy()

      agent.configureProxy('did:plc:test1#atproto_labeler')
      const res2 = await agent.com.atproto.server.describeServer()
      expect(res2.data['atproto-proxy']).toEqual(
        'did:plc:test1#atproto_labeler',
      )

      const res3 = await agent
        .withProxy('atproto_labeler', 'did:plc:test2')
        .com.atproto.server.describeServer()
      expect(res3.data['atproto-proxy']).toEqual(
        'did:plc:test2#atproto_labeler',
      )

      await new Promise((r) => server.close(r))
    })
  })
})

const createPost = async (agent: AtpAgent) => {
  return agent.com.atproto.repo.createRecord({
    repo: agent.accountDid,
    collection: 'app.bsky.feed.post',
    record: {
      text: 'hello there',
      createdAt: new Date().toISOString(),
    },
  })
}
