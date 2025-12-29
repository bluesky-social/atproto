/* eslint-disable @typescript-eslint/no-namespace */

import assert from 'node:assert'
import { Client, XrpcResponseError } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'
import { LexAuthError, LexRouter } from '@atproto/lex-server'
import { Server, serve } from '@atproto/lex-server/nodejs'
import { com } from './lexicons.js'
import { AuthVerifier } from './password-agent-utils.test.js'
import { PasswordAgent, PasswordAuthAgentHooks } from './password-agent.js'

const hooks: PasswordAuthAgentHooks = {
  onRefreshFailure: async (session, cause) => {
    throw new Error('Should not fail to refresh session', { cause })
  },
  onDeleteFailure: async (session, cause) => {
    throw new Error('Should not fail to delete session', { cause })
  },
}

// Example app lexicon
namespace app {
  export namespace example {
    export namespace customMethod {
      export const main = l.procedure(
        'app.example.customMethod',
        l.params({}),
        l.jsonPayload({ message: l.string() }),
        l.jsonPayload({
          message: l.string(),
          did: l.string({ format: 'did' }),
        }),
      )
    }

    export namespace expiredToken {
      export const main = l.query(
        'app.example.expiredToken',
        l.params({}),
        l.payload(),
      )
    }
  }
}

describe('PasswordAgent', () => {
  let entrywayServer: Server
  let entrywayOrigin: string

  let pdsServer: Server
  let pdsOrigin: string

  beforeAll(async () => {
    const authVerifier = new AuthVerifier()

    const entrywayRouter = new LexRouter()
      .add(com.atproto.server.createSession, async ({ input }) => {
        const session = await authVerifier.create(input.body)

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
          handle: session.handle,
        }

        return { body }
      })
      .add(com.atproto.server.getSession, {
        auth: authVerifier.accessStrategy,
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
            handle: session.handle,
            email: session.email,
            emailConfirmed: true,
            emailAuthFactor: false,
            active: true,
            status: 'active',
          }

          return { body }
        },
      })
      .add(com.atproto.server.refreshSession, {
        auth: authVerifier.refreshStrategy,
        handler: async ({ credentials: { session } }) => {
          await session.rotate()

          // Note, we omit email and didDoc here to test that they are properly
          // fetched via getSession in the agent
          const body: com.atproto.server.refreshSession.OutputBody = {
            accessJwt: session.accessJwt,
            refreshJwt: session.refreshJwt,

            did: session.did,
            didDoc: undefined,
            handle: session.handle,

            email: undefined,
            emailConfirmed: undefined,
          }

          return { body }
        },
      })
      .add(com.atproto.server.deleteSession, {
        auth: authVerifier.refreshStrategy,
        handler: async ({ credentials: { session } }) => {
          await session.destroy()
          return {}
        },
      })

    entrywayServer = await serve(entrywayRouter)
    const { port } = entrywayServer.address() as { port: number }
    entrywayOrigin = `http://localhost:${port}`

    const pdsRouter = new LexRouter()
      .add(app.example.customMethod, {
        auth: authVerifier.accessStrategy,
        handler: async ({ input, credentials: { session } }) => {
          return { body: { message: input.body.message, did: session.did } }
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
      message: 'hello',
      did: 'did:example:alice',
    })

    await expect(
      client.call(app.example.customMethod, { message: 'world' }),
    ).resolves.toMatchObject({
      message: 'world',
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
      message: 'before',
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
      message: 'after',
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
      message: 'resume',
      did: 'did:example:carla',
    })
  })

  it('silently ignores expected logout errors', async () => {
    const result = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'dave',
      password: 'password123',
      authFactorToken: '2fa-token',
      hooks,
    })

    assert(result.success)
    const agent = result.value

    const session = structuredClone(agent.session)

    await agent.logout()
    await agent.logout()

    await PasswordAgent.delete(session)
    await PasswordAgent.delete(session)
  })
})
