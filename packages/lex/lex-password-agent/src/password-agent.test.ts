/* eslint-disable @typescript-eslint/no-namespace */

import assert from 'node:assert'
import { Client, XrpcResponseError } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'
import { LexAuthError, LexRouter } from '@atproto/lex-server'
import { Server, serve } from '@atproto/lex-server/nodejs'
import { com } from './lexicons.js'
import { PasswordAgent, PasswordAuthAgentHooks } from './password-agent.js'

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
          credentials: l.object({ user: l.string() }),
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
    let sessionCount = 0
    let refreshCount = 0

    const entrywayRouter = new LexRouter()
      .add(com.atproto.server.createSession, async ({ input }) => {
        if (
          input.body.identifier !== 'alice' ||
          input.body.password !== 'password123'
        ) {
          throw new LexAuthError('AuthenticationRequired', 'Invalid identifier')
        }

        if (input.body.authFactorToken !== '2fa-token') {
          throw new LexAuthError(
            'AuthFactorTokenRequired',
            '2FA token is required',
          )
        }

        const did = `did:example:alice`

        sessionCount++
        refreshCount++

        const body: com.atproto.server.createSession.OutputBody = {
          accessJwt: `access-token:${sessionCount}`,
          refreshJwt: `refresh-token:${refreshCount}`,
          did,
          didDoc: {
            '@context': 'https://w3.org/ns/did/v1',
            id: did,
            service: [
              {
                id: `${did}#atproto_pds`,
                type: 'AtprotoPersonalDataServer',
                serviceEndpoint: pdsUrl,
              },
            ],
          },
          handle: `alice.example`,
        }

        return { body }
      })
      .add(com.atproto.server.getSession, {
        auth: async ({ request: { headers } }) => {
          const auth = headers.get('authorization')
          if (auth !== `Bearer access-token:${sessionCount}`) {
            throw new LexAuthError('AuthenticationRequired', 'Invalid token')
          }
          return { did: 'did:example:alice' as l.DidString }
        },
        handler: async ({ credentials }) => {
          const body: com.atproto.server.getSession.OutputBody = {
            did: credentials.did,
            didDoc: {
              '@context': 'https://w3.org/ns/did/v1',
              id: credentials.did,
              service: [
                {
                  id: `${credentials.did}#atproto_pds`,
                  type: 'AtprotoPersonalDataServer',
                  serviceEndpoint: pdsOrigin,
                },
              ],
            },
            handle: `alice.example`,
            email: 'alice@example.com',
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
          if (auth !== `Bearer refresh-token:${refreshCount}`) {
            throw new LexAuthError('ExpiredToken', 'Invalid token')
          }
          return { did: 'did:example:alice' as l.DidString }
        },
        handler: async ({ credentials }) => {
          sessionCount++
          refreshCount++

          const body: com.atproto.server.refreshSession.OutputBody = {
            accessJwt: `access-token:${sessionCount}`,
            refreshJwt: `refresh-token:${refreshCount}`,
            handle: `alice.example`,
            did: credentials.did,

            // Note, we omit email and didDoc here to test that they
            // are properly fetched via getSession in the agent
          }

          return { body }
        },
      })
      .add(com.atproto.server.deleteSession, {
        auth: async ({ request: { headers } }) => {
          const auth = headers.get('authorization')
          if (auth !== `Bearer refresh-token:${refreshCount}`) {
            throw new LexAuthError('ExpiredToken', 'Invalid token')
          }
          return { did: 'did:example:alice' as l.DidString }
        },
        handler: async () => {
          sessionCount++
          refreshCount++
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
          if (auth !== `Bearer access-token:${sessionCount}`) {
            throw new LexAuthError('AuthenticationRequired', 'Invalid token')
          }
          return { user: 'alice' }
        },
        handler: async ({ input, credentials }) => {
          return { body: { reply: input.body.message, credentials } }
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
      credentials: { user: 'alice' },
    })

    await expect(
      client.call(app.example.customMethod, { message: 'world' }),
    ).resolves.toMatchObject({
      reply: 'world',
      credentials: { user: 'alice' },
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
      identifier: 'alice',
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
      credentials: { user: 'alice' },
    })

    expect(onRefreshed).not.toHaveBeenCalled()

    await expect(client.call(app.example.expiredToken)).rejects.toThrow(
      'Token expired',
    )

    expect(onRefreshed).toHaveBeenCalled()
    expect(onRefreshed).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessJwt: expect.stringContaining('access-token:'),
          refreshJwt: expect.stringContaining('refresh-token:'),

          email: expect.stringContaining('@'),
          emailConfirmed: true,
          emailAuthFactor: false,
          handle: 'alice.example',
          did: 'did:example:alice',
          didDoc: expect.objectContaining({ id: 'did:example:alice' }),
        }),
        pdsUrl: pdsOrigin,
      }),
    )

    await expect(
      client.call(app.example.customMethod, { message: 'after' }),
    ).resolves.toMatchObject({
      reply: 'after',
      credentials: { user: 'alice' },
    })
  })

  it('restores session from storage', async () => {
    const loginResult = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'alice',
      password: 'password123',
      authFactorToken: '2fa-token',
      hooks,
    })

    assert(loginResult.success)
    const loginAgent = loginResult.value
    const session = structuredClone(loginResult.value.session)

    const onRefreshed: PasswordAuthAgentHooks['onRefreshed'] = jest.fn()
    const agent = await PasswordAgent.resume(session, {
      hooks: { ...hooks, onRefreshed },
    })

    expect(agent.did).toEqual(loginAgent.did)
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
      credentials: { user: 'alice' },
    })
  })
})

// @TODO move this into a separate package
