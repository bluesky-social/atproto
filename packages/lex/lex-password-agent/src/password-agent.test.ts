import assert from 'node:assert'
import { Client } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'
import { LexError, LexRouter } from '@atproto/lex-server'
import { Server, startServer } from '@atproto/lex-server/nodejs'
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
const app = {
  example: {
    customMethod: l.procedure(
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
    ),
    expiredToken: l.query(
      'app.example.expiredToken',
      l.params({}),
      l.payload(),
    ),
  },
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
        if (input.body.authFactorToken !== '2fa-token') {
          throw new LexError('AuthFactorTokenRequired', '2FA token is required')
        }

        if (
          input.body.identifier !== 'alice' ||
          input.body.password !== 'password123'
        ) {
          throw new LexError('ExpiredToken', 'Invalid identifier')
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
            throw new LexError('AuthenticationRequired', 'Invalid token')
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
            throw new LexError('ExpiredToken', 'Invalid token')
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
            throw new LexError('ExpiredToken', 'Invalid token')
          }
          return { did: 'did:example:alice' as l.DidString }
        },
        handler: async () => {
          sessionCount++
          refreshCount++
          return {}
        },
      })

    entrywayServer = await startServer(entrywayRouter)
    const { port } = entrywayServer.address() as { port: number }
    entrywayOrigin = `http://localhost:${port}`

    const pdsRouter = new LexRouter()
      .add(app.example.customMethod, {
        auth: async ({ request: { headers } }) => {
          const auth = headers.get('authorization')
          if (auth !== `Bearer access-token:${sessionCount}`) {
            throw new LexError('AuthenticationRequired', 'Invalid token')
          }
          return { user: 'alice' }
        },
        handler: async ({ input, credentials }) => {
          return { body: { reply: input.body.message, credentials } }
        },
      })
      .add(app.example.expiredToken, async () => {
        throw new LexError('ExpiredToken', 'Token expired')
      })

    pdsServer = await startServer(pdsRouter)
    const { port: pdsPort } = pdsServer.address() as { port: number }
    pdsOrigin = `http://localhost:${pdsPort}`
    const pdsUrl = pdsOrigin
  })

  afterAll(async () => {
    entrywayServer.close()
    pdsServer.close()
  })

  it('requires 2fa', async () => {
    const result = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'alice',
      password: 'password123',
      hooks,
    })

    assert(!result.success)
    expect(result).toBeInstanceOf(LexError)
    expect(result.error).toBe('AuthFactorTokenRequired')
  })

  it('logs in', async () => {
    const onDelete = jest.fn()
    const result = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'alice',
      password: 'password123',
      authFactorToken: '2fa-token',
      hooks: {
        onDeleted: onDelete,
        ...hooks,
      },
    })

    assert(result.success)
    const agent = result.value
    const client = new Client(agent)

    expect(
      await client.call(app.example.customMethod, { message: 'hello' }),
    ).toMatchObject({
      reply: 'hello',
      credentials: { user: 'alice' },
    })

    expect(
      await client.call(app.example.customMethod, { message: 'world' }),
    ).toMatchObject({
      reply: 'world',
      credentials: { user: 'alice' },
    })

    expect(onDelete).not.toHaveBeenCalled()

    await agent.logout()

    expect(onDelete).toHaveBeenCalled()

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
      hooks: {
        ...hooks,
        onRefreshed,
      },
    })

    assert(result.success)

    const agent = result.value
    const client = new Client(agent)

    expect(
      await client.call(app.example.customMethod, { message: 'before' }),
    ).toMatchObject({
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

    expect(
      await client.call(app.example.customMethod, { message: 'after' }),
    ).toMatchObject({
      reply: 'after',
      credentials: { user: 'alice' },
    })
  })
})

// @TODO move this into a separate package
