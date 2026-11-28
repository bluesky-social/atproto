import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { getPdsEndpoint, isValidDidDoc } from '@atproto/common-web'
import { DID, type XrpcCall, xrpcError, xrpcFetch } from './_xrpc-fetch.test.js'
import { AtpAgent } from './atp-agent.js'
import { BSKY_LABELER_DID } from './const.js'
import type { AtpSessionData, AtpSessionEvent } from './types.js'

const SERVICE = 'https://entryway.test'
const PDS = 'https://pds.test'
const HANDLE = 'alice.test'
const EMAIL = 'alice@test.com'
const POST = {
  uri: `at://${DID}/app.bsky.feed.post/3jzfcijpj2z2a`,
  cid: 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq',
}

const didDoc = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  id: DID,
  alsoKnownAs: [`at://${HANDLE}`],
  service: [
    {
      id: '#atproto_pds',
      type: 'AtprotoPersonalDataServer',
      serviceEndpoint: PDS,
    },
  ],
}

/**
 * Body of a successful session response (createSession, refreshSession, …).
 */
const sessionBody = (accessJwt: string, refreshJwt: string) => ({
  accessJwt,
  refreshJwt,
  handle: HANDLE,
  did: DID,
  didDoc,
  email: EMAIL,
  emailConfirmed: false,
  active: true,
})

const bearer = ({ headers }: XrpcCall) =>
  headers.get('authorization')?.replace(/^Bearer /, '')

const getPdsEndpointUrl = (...args: Parameters<typeof getPdsEndpoint>) => {
  const endpoint = getPdsEndpoint(...args)
  return endpoint ? new URL(endpoint) : endpoint
}

function recordSessionEvents() {
  const events: string[] = []
  const sessions: (AtpSessionData | undefined)[] = []
  const persistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => {
    events.push(evt)
    sessions.push(sess)
  }
  return { events, sessions, persistSession }
}

describe(AtpAgent, () => {
  it('clones correctly', () => {
    const persistSession = (_evt: AtpSessionEvent, _sess?: AtpSessionData) => {}
    const agent = new AtpAgent({ service: SERVICE, persistSession })
    const agent2 = agent.clone()
    expect(agent2 instanceof AtpAgent).toBeTruthy()
    expect(agent.serviceUrl).toEqual(agent2.serviceUrl)
    expect(agent.service).toEqual(agent2.service)
  })

  it('creates a new session on account creation.', async () => {
    const { events, sessions, persistSession } = recordSessionEvents()
    const createAccount = vi.fn(() => {
      const { accessJwt, refreshJwt, handle, did } = sessionBody('a1', 'r1')
      return { accessJwt, refreshJwt, handle, did, didDoc }
    })
    using fetch = xrpcFetch({
      'com.atproto.server.createAccount': createAccount,
      'com.atproto.server.getSession': (call) =>
        bearer(call) === 'a1'
          ? { did: DID, handle: HANDLE, email: EMAIL, emailConfirmed: false }
          : xrpcError(400, 'InvalidToken'),
    })
    const agent = new AtpAgent({ service: SERVICE, fetch, persistSession })

    const res = await agent.createAccount({
      handle: HANDLE,
      email: EMAIL,
      password: 'pw',
    })

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { handle: HANDLE, email: EMAIL, password: 'pw' },
      }),
    )
    expect(agent.hasSession).toEqual(true)
    expect(agent.session?.accessJwt).toEqual(res.data.accessJwt)
    expect(agent.session?.refreshJwt).toEqual(res.data.refreshJwt)
    expect(agent.session?.handle).toEqual(res.data.handle)
    expect(agent.session?.did).toEqual(res.data.did)
    expect(agent.session?.email).toEqual(EMAIL)
    expect(agent.session?.emailConfirmed).toEqual(false)
    assert(isValidDidDoc(res.data.didDoc))
    expect(agent.pdsUrl).toEqual(getPdsEndpointUrl(res.data.didDoc))

    // authenticated requests go to the PDS from the did document
    await agent.com.atproto.server.getSession({})
    expect(new Request(...fetch.mock.lastCall!).url).toMatch(`${PDS}/xrpc/`)

    expect(events).toEqual(['create'])
    expect(sessions[0]?.accessJwt).toEqual(agent.session?.accessJwt)
  })

  it('creates a new session on login.', async () => {
    const { events, sessions, persistSession } = recordSessionEvents()
    const createSession = vi.fn(() => sessionBody('a1', 'r1'))
    using fetch = xrpcFetch({
      'com.atproto.server.createSession': createSession,
      'com.atproto.server.getSession': (call) =>
        bearer(call) === 'a1'
          ? { did: DID, handle: HANDLE }
          : xrpcError(400, 'InvalidToken'),
    })
    const agent = new AtpAgent({ service: SERVICE, fetch, persistSession })

    const res1 = await agent.login({ identifier: HANDLE, password: 'pw' })

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ body: { identifier: HANDLE, password: 'pw' } }),
    )
    expect(agent.hasSession).toEqual(true)
    expect(agent.session?.accessJwt).toEqual(res1.data.accessJwt)
    expect(agent.session?.refreshJwt).toEqual(res1.data.refreshJwt)
    expect(agent.session?.handle).toEqual(res1.data.handle)
    expect(agent.session?.did).toEqual(res1.data.did)
    expect(agent.session?.email).toEqual(EMAIL)
    expect(agent.session?.emailConfirmed).toEqual(false)
    assert(isValidDidDoc(res1.data.didDoc))
    expect(agent.pdsUrl).toEqual(getPdsEndpointUrl(res1.data.didDoc))

    await agent.com.atproto.server.getSession({})
    expect(new Request(...fetch.mock.lastCall!).url).toMatch(`${PDS}/xrpc/`)

    expect(events).toEqual(['create'])
    expect(sessions[0]?.accessJwt).toEqual(agent.session?.accessJwt)
  })

  it('resumes an existing session.', async () => {
    const { events, sessions, persistSession } = recordSessionEvents()
    using fetch = xrpcFetch({
      'com.atproto.server.refreshSession': (call) =>
        bearer(call) === 'r1'
          ? sessionBody('a2', 'r2')
          : xrpcError(400, 'InvalidToken'),
      'com.atproto.server.getSession': (call) =>
        bearer(call) === 'a2'
          ? { did: DID, handle: HANDLE }
          : xrpcError(400, 'InvalidToken'),
    })
    const agent = new AtpAgent({ service: SERVICE, fetch, persistSession })

    const res1 = await agent.resumeSession({
      accessJwt: 'a1',
      refreshJwt: 'r1',
      handle: HANDLE,
      did: DID,
      email: EMAIL,
      emailConfirmed: false,
      active: true,
    })

    expect(agent.hasSession).toEqual(true)
    expect(agent.session?.accessJwt).toEqual('a2')
    expect(agent.session?.handle).toEqual(res1.data.handle)
    expect(agent.session?.did).toEqual(res1.data.did)
    assert(isValidDidDoc(res1.data.didDoc))
    expect(agent.pdsUrl).toEqual(getPdsEndpointUrl(res1.data.didDoc))

    await expect(agent.com.atproto.server.getSession({})).resolves.toEqual(
      expect.objectContaining({ success: true }),
    )

    expect(events).toEqual(['update'])
    expect(sessions[0]?.accessJwt).toEqual(agent.session?.accessJwt)
  })

  it('refreshes existing session.', async () => {
    const { events, sessions, persistSession } = recordSessionEvents()
    using fetch = xrpcFetch({
      'com.atproto.server.createAccount': () => sessionBody('a1', 'r1'),
      'com.atproto.server.refreshSession': (call) =>
        bearer(call) === 'r1'
          ? sessionBody('a2', 'r2')
          : xrpcError(400, 'InvalidToken'),
      'com.atproto.repo.createRecord': (call) =>
        bearer(call) === 'a2' ? POST : xrpcError(400, 'ExpiredToken'),
    })
    const agent = new AtpAgent({ service: SERVICE, fetch, persistSession })
    await agent.createAccount({ handle: HANDLE, email: EMAIL, password: 'pw' })
    const session1 = agent.session!

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

    expect(events).toEqual(['create', 'update'])
    expect(sessions[0]?.accessJwt).toEqual('a1')
    expect(sessions[1]?.accessJwt).toEqual(agent.session?.accessJwt)
  })

  it('dedupes session refreshes.', async () => {
    const { events, sessions, persistSession } = recordSessionEvents()
    let expiredCalls = 0
    let refreshCalls = 0
    using fetch = xrpcFetch({
      'com.atproto.server.createAccount': () => sessionBody('a1', 'r1'),
      'com.atproto.server.refreshSession': (call) => {
        refreshCalls++
        return bearer(call) === 'r1'
          ? sessionBody('a2', 'r2')
          : xrpcError(400, 'InvalidToken')
      },
      'com.atproto.repo.createRecord': (call) => {
        if (bearer(call) === 'a2') return POST
        expiredCalls++
        return xrpcError(400, 'ExpiredToken')
      },
    })
    const agent = new AtpAgent({ service: SERVICE, fetch, persistSession })
    await agent.createAccount({ handle: HANDLE, email: EMAIL, password: 'pw' })
    const session1 = agent.session!

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

    expect(events).toEqual(['create', 'update'])
    expect(sessions[0]?.accessJwt).toEqual('a1')
    expect(sessions[1]?.accessJwt).toEqual(agent.session?.accessJwt)
  })

  it('persists an empty session on login and resumeSession failures', async () => {
    const { events, sessions, persistSession } = recordSessionEvents()
    using fetch = xrpcFetch({
      'com.atproto.server.createSession': () =>
        xrpcError(401, 'AuthenticationRequired'),
      'com.atproto.server.refreshSession': () => xrpcError(400, 'InvalidToken'),
    })
    const agent = new AtpAgent({ service: SERVICE, fetch, persistSession })

    await expect(
      agent.login({ identifier: 'baduser.test', password: 'password' }),
    ).rejects.toThrow()
    expect(agent.hasSession).toEqual(false)

    await expect(
      agent.resumeSession({
        accessJwt: 'bad',
        refreshJwt: 'bad',
        did: 'bad',
        handle: 'bad',
        active: true,
      }),
    ).rejects.toThrow()
    expect(agent.hasSession).toEqual(false)

    expect(events).toEqual(['create-failed', 'expired'])
    expect(sessions).toEqual([undefined, undefined])
  })

  it('does not modify the session on a failed refresh', async () => {
    const events: { event: string; session: AtpSessionData | undefined }[] = []
    const persistSession = (
      event: AtpSessionEvent,
      session?: AtpSessionData,
    ) => {
      events.push({ event, session: session && { ...session } })
    }
    using fetch = xrpcFetch({
      'com.atproto.server.createAccount': () => sessionBody('a1', 'r1'),
      'com.atproto.server.refreshSession': () =>
        new Response(null, { status: 500 }),
      'app.bsky.feed.getTimeline': () => xrpcError(400, 'ExpiredToken'),
    })
    const agent = new AtpAgent({ service: SERVICE, fetch, persistSession })
    await agent.createAccount({ handle: HANDLE, email: EMAIL, password: 'pw' })

    // put the agent through the auth flow
    await expect(agent.app.bsky.feed.getTimeline()).rejects.toSatisfy(
      (e: any) => {
        // the original error passes through
        expect(e.status).toEqual(400)
        expect(e.error).toEqual('ExpiredToken')
        return true
      },
    )

    // still has session because it wasn't invalidated
    expect(agent.hasSession).toEqual(true)

    expect(events.length).toEqual(2)
    expect(events[0].event).toEqual('create')
    expect(events[0].session?.accessJwt).toEqual('a1')
    expect(events[1].event).toEqual('network-error')
    expect(events[1].session?.accessJwt).toEqual('a1')
  })

  describe('createAccount', () => {
    it('persists an empty session on failure', async () => {
      const { events, sessions, persistSession } = recordSessionEvents()
      using fetch = xrpcFetch({
        'com.atproto.server.createAccount': () =>
          xrpcError(
            400,
            'InvalidRequest',
            'Input/handle must be a valid handle',
          ),
      })
      const agent = new AtpAgent({ service: SERVICE, fetch, persistSession })

      await expect(
        agent.createAccount({ handle: '', email: '', password: 'password' }),
      ).rejects.toThrow()

      expect(agent.hasSession).toEqual(false)
      expect(agent.session).toEqual(undefined)
      expect(events).toEqual(['create-failed'])
      expect(sessions).toEqual([undefined])
    })
  })

  describe('App labelers header', () => {
    it('adds the labelers header as expected', async () => {
      onTestFinished(() => {
        AtpAgent.configure({ appLabelers: [BSKY_LABELER_DID] })
      })

      using fetch = describeServerFetch()
      const agent = new AtpAgent({ service: SERVICE, fetch })
      const agent2 = new AtpAgent({ service: SERVICE, fetch })

      await agent.com.atproto.server.describeServer()
      expect(lastHeaders(fetch).get('atproto-accept-labelers')).toEqual(
        `${BSKY_LABELER_DID};redact`,
      )

      AtpAgent.configure({ appLabelers: ['did:plc:test1', 'did:plc:test2'] })
      await agent.com.atproto.server.describeServer()
      expect(lastHeaders(fetch).get('atproto-accept-labelers')).toEqual(
        'did:plc:test1;redact, did:plc:test2;redact',
      )
      await agent2.com.atproto.server.describeServer()
      expect(lastHeaders(fetch).get('atproto-accept-labelers')).toEqual(
        'did:plc:test1;redact, did:plc:test2;redact',
      )
    })
  })

  describe('configureLabelers', () => {
    it('adds the labelers header as expected', async () => {
      using fetch = describeServerFetch()
      const agent = new AtpAgent({ service: SERVICE, fetch })

      agent.configureLabelers(['did:plc:test1'])
      await agent.com.atproto.server.describeServer()
      expect(lastHeaders(fetch).get('atproto-accept-labelers')).toEqual(
        `${BSKY_LABELER_DID};redact, did:plc:test1`,
      )

      agent.configureLabelers(['did:plc:test1', 'did:plc:test2'])
      await agent.com.atproto.server.describeServer()
      expect(lastHeaders(fetch).get('atproto-accept-labelers')).toEqual(
        `${BSKY_LABELER_DID};redact, did:plc:test1, did:plc:test2`,
      )
    })
  })

  describe('configureProxy', () => {
    it('adds the proxy header as expected', async () => {
      using fetch = describeServerFetch()
      const agent = new AtpAgent({ service: SERVICE, fetch })

      await agent.com.atproto.server.describeServer()
      expect(lastHeaders(fetch).get('atproto-proxy')).toBeFalsy()

      agent.configureProxy('did:plc:test1#atproto_labeler')
      await agent.com.atproto.server.describeServer()
      expect(lastHeaders(fetch).get('atproto-proxy')).toEqual(
        'did:plc:test1#atproto_labeler',
      )

      await agent
        .withProxy('atproto_labeler', 'did:plc:test2')
        .com.atproto.server.describeServer()
      expect(lastHeaders(fetch).get('atproto-proxy')).toEqual(
        'did:plc:test2#atproto_labeler',
      )
    })
  })
})

const describeServerFetch = () =>
  xrpcFetch({
    'com.atproto.server.describeServer': () => ({
      did: 'did:web:fake.com',
      availableUserDomains: [],
    }),
  })

const lastHeaders = (fetch: ReturnType<typeof xrpcFetch>) =>
  new Request(...fetch.mock.lastCall!).headers

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
