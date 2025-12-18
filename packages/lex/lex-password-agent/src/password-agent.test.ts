import assert from 'node:assert'
import { Client, XrpcError } from '@atproto/lex-client'
import { LexRouter } from '@atproto/lex-router'
import { HttpServer, start } from '@atproto/lex-router/nodejs'
import { l } from '@atproto/lex-schema'
import { com } from './lexicons.js'
import { PasswordAgent } from './password-agent.js'

const customMethod = l.procedure(
  'com.example.customMethod',
  l.params(),
  l.payload('application/json', l.object({ message: l.string() })),
  l.payload(
    'application/json',
    l.object({
      reply: l.string(),
      credentials: l.object({ user: l.string() }),
    }),
  ),
)

describe('PasswordAgent', () => {
  let entrywayServer: HttpServer
  let entrywayOrigin: string

  let pdsServer: HttpServer
  let pdsOrigin: string

  beforeAll(async () => {
    let sessionCount = 0
    let refreshCount = 0

    const entrywayRouter = new LexRouter()
      .add(com.atproto.server.createSession, async ({ input }) => {
        if (input.body.authFactorToken !== '2fa-token') {
          throw new XrpcError(
            'AuthFactorTokenRequired',
            '2FA token is required',
          )
        }

        if (
          input.body.identifier !== 'alice' ||
          input.body.password !== 'password123'
        ) {
          throw new XrpcError('AuthenticationRequired', 'Invalid identifier')
        }

        const did = `did:example:alice`

        const body: com.atproto.server.createSession.OutputBody = {
          accessJwt: `access-token:${++sessionCount}`,
          refreshJwt: `refresh-token:${++refreshCount}`,
          handle: `alice.example`,
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
        }

        return { body }
      })
      .add(com.atproto.server.refreshSession, {
        auth: async ({ headers }) => {
          const auth = headers.get('authorization')
          if (auth !== `Bearer refresh-token:${refreshCount}`) {
            throw new XrpcError('AuthenticationRequired', 'Invalid token')
          }
          return { did: 'did:example:alice' as l.DidString }
        },
        handler: async ({ credentials }) => {
          const body: com.atproto.server.refreshSession.OutputBody = {
            accessJwt: `access-token:${++sessionCount}`,
            refreshJwt: `refresh-token:${++refreshCount}`,
            handle: `alice.example`,
            did: credentials.did,
          }
          return { body }
        },
      })

    entrywayServer = await start(entrywayRouter.fetchHandler)
    const { port } = entrywayServer.address() as { port: number }
    entrywayOrigin = `http://localhost:${port}`

    const pdsRouter = new LexRouter().add(customMethod, {
      auth: async ({ headers }) => {
        const auth = headers.get('authorization')
        if (auth !== `Bearer access-token:${sessionCount}`) {
          throw new XrpcError('AuthenticationRequired', 'Invalid token')
        }
        return { user: 'alice' }
      },
      handler: async ({ input, credentials }) => {
        return { body: { reply: input.body.message, credentials } }
      },
    })

    pdsServer = await start(pdsRouter.fetchHandler)
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
    })

    assert(!result.success)
    expect(result).toBeInstanceOf(XrpcError)
    expect(result.error).toBe('AuthFactorTokenRequired')
  })

  it('logs in', async () => {
    const result = await PasswordAgent.login({
      service: entrywayOrigin,
      identifier: 'alice',
      password: 'password123',
      authFactorToken: '2fa-token',
    })

    assert(result.success)
    const client = new Client(result.value)

    const res = await client.call(customMethod, { message: 'hello' })

    expect(res.reply).toBe('hello')
    expect(res.credentials.user).toBe('alice')
  })
})

// @TODO move this into a separate package
