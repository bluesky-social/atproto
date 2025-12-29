/* eslint-disable @typescript-eslint/no-namespace */

import assert from 'node:assert'
import { Client, XrpcResponseError } from '@atproto/lex-client'
import { DidString, l } from '@atproto/lex-schema'
import { LexAuthError, LexRouter } from '@atproto/lex-server'
import { Server, serve } from '@atproto/lex-server/nodejs'
import { com } from './lexicons.js'
import { PasswordAgent, PasswordAuthAgentHooks } from './password-agent.js'

const randomString = () =>
  Math.random().toString(36).substring(2, 10) +
  Math.random().toString(36).substring(2, 10)

const hooks: PasswordAuthAgentHooks = {
  onRefreshFailure(session, cause) {
    throw new Error('Should not fail to refresh session', { cause })
  },
  onDeleteFailure: async (session, cause) => {
    throw new Error('Should not fail to delete session', { cause })
  },
}

// Example app lexicon
namespace app {
  export namespace example {
    export const customMethod = l.procedure(
      'app.example.customMethod',
      l.params({}),
      l.payload('application/json', l.object({ message: l.string() })),
      l.payload(
        'application/json',
        l.object({
          reply: l.string(),
          did: l.string({ format: 'did' }),
        }),
      ),
    )
    export const expiredToken = l.query(
      'app.example.expiredToken',
      l.params({}),
      l.payload(),
    )
  }
}

describe('PasswordAgent', () => {
  let entrywayServer: Server
  let entrywayOrigin: string

  let pdsServer: Server
  let pdsOrigin: string

  beforeAll(async () => {
    type SessionData = {
      identifier: string
      did: DidString
      accessJwt: string
      refreshJwt: string
    }
    const sessions: SessionData[] = []

    const entrywayRouter = new LexRouter()
      .add(com.atproto.server.createSession, async ({ input }) => {
        if (!input.body.identifier || input.body.password !== 'password123') {
          throw new LexAuthError('AuthenticationRequired', 'Invalid identifier')
        }

        if (input.body.authFactorToken !== '2fa-token') {
          throw new LexAuthError(
            'AuthFactorTokenRequired',
            '2FA token is required',
          )
        }

        const session: SessionData = {
          identifier: input.body.identifier,
          did: `did:example:${input.body.identifier}`,
          accessJwt: randomString(),
          refreshJwt: randomString(),
        }
        sessions.push(session)

        const body: com.atproto.server.createSession.OutputBody = {
          accessJwt: session.accessJwt,
          refreshJwt: session.refreshJwt,
          did: session.did,
          didDoc: {
            '@context': 'https://w3.org/ns/did/v1',
            id: session.did,
            service: [
              {
                id: `${session.did}#atproto_pds`,
                type: 'AtprotoPersonalDataServer',
                serviceEndpoint: pdsUrl,
              },
            ],
          },
          handle: `${session.identifier}.example`,
        }

        return { body }
      })
      .add(com.atproto.server.getSession, {
        auth: async ({ request: { headers } }) => {
          const auth = headers.get('authorization')
          const token = auth?.startsWith('Bearer ') && auth.slice(7)
          const session = sessions.find((s) => s.accessJwt === token)
          if (!session) {
            throw new LexAuthError('AuthenticationRequired', 'Invalid token')
          }
          return { session }
        },
        handler: async ({ credentials: { session } }) => {
          const body: com.atproto.server.getSession.OutputBody = {
            did: session.did,
            didDoc: {
              '@context': 'https://w3.org/ns/did/v1',
              id: session.did,
              service: [
                {
                  id: `${session.did}#atproto_pds`,
                  type: 'AtprotoPersonalDataServer',
                  serviceEndpoint: pdsOrigin,
                },
              ],
            },
            handle: `${session.identifier}.example`,
            email: `${session.identifier}@example.com`,
            emailConfirmed: true,
            emailAuthFactor: false,
            active: true,
            status: 'active',
          }
          return { body }
        },
      })
      .add(com.atproto.server.refreshSession, {
        auth: async ({ request: { headers } }) => {
          const auth = headers.get('authorization')
          const token = auth?.startsWith('Bearer ') && auth.slice(7)
          const session = sessions.find((s) => s.refreshJwt === token)
          if (!session) {
            throw new LexAuthError('ExpiredToken', 'Invalid token')
          }

          // Rotate tokens
          session.accessJwt = randomString()
          session.refreshJwt = randomString()

          return { session }
        },
        handler: async ({ credentials: { session } }) => {
          const body: com.atproto.server.refreshSession.OutputBody = {
            accessJwt: session.accessJwt,
            refreshJwt: session.refreshJwt,
            handle: `${session.identifier}.example`,
            did: session.did,

            // Note, we omit email and didDoc here to test that they
            // are properly fetched via getSession in the agent
          }

          return { body }
        },
      })
      .add(com.atproto.server.deleteSession, {
        auth: async ({ request: { headers } }) => {
          const auth = headers.get('authorization')
          const token = auth?.startsWith('Bearer ') && auth.slice(7)
          const sessIdx = sessions.findIndex((s) => s.refreshJwt === token)
          if (sessIdx !== -1) sessions.splice(sessIdx, 1)
        },
        handler: async () => {
          return {}
        },
      })

    entrywayServer = await serve(entrywayRouter)
    const { port } = entrywayServer.address() as { port: number }
    entrywayOrigin = `http://localhost:${port}`

    const pdsRouter = new LexRouter()
      .add(app.example.customMethod, {
        auth: async ({ request: { headers } }) => {
          const auth = headers.get('authorization')
          const token = auth?.startsWith('Bearer ') && auth.slice(7)
          const session = sessions.find((s) => s.accessJwt === token)
          if (!session) {
            throw new LexAuthError('AuthenticationRequired', 'Invalid token')
          }
          return { session }
        },
        handler: async ({ input, credentials: { session } }) => {
          return { body: { reply: input.body.message, did: session.did } }
        },
      })
      .add(app.example.expiredToken, async () => {
        throw new LexAuthError('ExpiredToken', 'Token expired')
      })

    pdsServer = await serve(pdsRouter)
    const { port: pdsPort } = pdsServer.address() as { port: number }
    pdsOrigin = `http://localhost:${pdsPort}`
    const pdsUrl = pdsOrigin
  })

  afterAll(async () => {
    entrywayServer.close()
    pdsServer.close()
  })

  it('fails with invalid credentials', async () => {
    await expect(
      PasswordAgent.login({
        service: entrywayOrigin,
        identifier: 'alice',
        password: 'wrong-password',
        hooks,
      }),
    ).rejects.toMatchObject({
      success: false,
      status: 401,
      error: 'AuthenticationRequired',
    })
  })

  it('requires 2fa', async () => {
    const result = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'alice',
      password: 'password123',
      hooks,
    })

    assert(!result.success)
    assert(result instanceof XrpcResponseError)
    expect(result.status).toBe(401)
    expect(result.error).toBe('AuthFactorTokenRequired')
  })

  it('logs in', async () => {
    const onDeleted = jest.fn()
    const onRefreshed = jest.fn()

    const result = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'alice',
      password: 'password123',
      authFactorToken: '2fa-token',
      hooks: { ...hooks, onDeleted, onRefreshed },
    })

    expect(onRefreshed).not.toHaveBeenCalled()

    assert(result.success)
    const agent = result.value
    const client = new Client(agent)

    await expect(
      client.call(app.example.customMethod, { message: 'hello' }),
    ).resolves.toMatchObject({
      reply: 'hello',
      did: 'did:example:alice',
    })

    await expect(
      client.call(app.example.customMethod, { message: 'world' }),
    ).resolves.toMatchObject({
      reply: 'world',
      did: 'did:example:alice',
    })

    expect(onDeleted).not.toHaveBeenCalled()

    await agent.logout()

    expect(onDeleted).toHaveBeenCalled()

    expect(
      client.call(app.example.customMethod, { message: 'hello' }),
    ).rejects.toThrow('Logged out')
  })

  it('refreshes expired token', async () => {
    const onRefreshed: PasswordAuthAgentHooks['onRefreshed'] = jest.fn()
    const result = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'bob',
      password: 'password123',
      authFactorToken: '2fa-token',
      hooks: { ...hooks, onRefreshed },
    })

    assert(result.success)

    const agent = result.value
    const client = new Client(agent)

    await expect(
      client.call(app.example.customMethod, { message: 'before' }),
    ).resolves.toMatchObject({
      reply: 'before',
      did: 'did:example:bob',
    })

    expect(onRefreshed).not.toHaveBeenCalled()

    await expect(client.call(app.example.expiredToken)).rejects.toThrow(
      'Token expired',
    )

    expect(onRefreshed).toHaveBeenCalled()
    expect(onRefreshed).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessJwt: expect.any(String),
          refreshJwt: expect.any(String),

          email: expect.stringContaining('@'),
          emailConfirmed: true,
          emailAuthFactor: false,
          handle: 'bob.example',
          did: 'did:example:bob',
          didDoc: expect.objectContaining({ id: 'did:example:bob' }),
        }),
        pdsUrl: pdsOrigin,
      }),
    )

    await expect(
      client.call(app.example.customMethod, { message: 'after' }),
    ).resolves.toMatchObject({
      reply: 'after',
      did: 'did:example:bob',
    })
  })

  it('restores session from storage', async () => {
    const loginResult = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'carla',
      password: 'password123',
      authFactorToken: '2fa-token',
      hooks,
    })

    assert(loginResult.success)
    const loginAgent = loginResult.value
    expect(loginAgent.did).toEqual('did:example:carla')
    const session = structuredClone(loginResult.value.session)

    const onRefreshed: PasswordAuthAgentHooks['onRefreshed'] = jest.fn()
    const agent = await PasswordAgent.resume(session, {
      hooks: { ...hooks, onRefreshed },
    })

    expect(agent.did).toEqual('did:example:carla')
    expect(onRefreshed).toHaveBeenCalled()

    // The initial session was refreshed and is now expired
    await expect(loginAgent.refresh()).rejects.toMatchObject({
      success: false,
      error: 'ExpiredToken',
      status: 401,
    })

    const client = new Client(agent)
    await expect(
      client.call(app.example.customMethod, { message: 'resume' }),
    ).resolves.toMatchObject({
      reply: 'resume',
      did: 'did:example:carla',
    })
  })
})

// @TODO move this into a separate package
