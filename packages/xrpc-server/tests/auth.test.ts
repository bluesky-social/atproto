import * as http from 'http'
import getPort from 'get-port'
import xrpc, { ServiceClient, XRPCError } from '@atproto/xrpc'
import * as xrpcServer from '../src'
import {
  createServer,
  closeServer,
  createBasicAuth,
  basicAuthHeaders,
} from './_util'

const LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.authTest',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              present: { type: 'boolean', const: true },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              original: { type: 'string' },
            },
          },
        },
      },
    },
  },
]

describe('Auth', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method('io.example.authTest', {
    auth: createBasicAuth({ username: 'admin', password: 'password' }),
    handler: ({ auth }) => {
      return {
        encoding: 'application/json',
        body: {
          username: auth?.credentials?.username,
          original: auth?.artifacts?.original,
        },
      }
    },
  })
  xrpc.addLexicons(LEXICONS)

  let client: ServiceClient
  beforeAll(async () => {
    const port = await getPort()
    s = await createServer(port, server)
    client = xrpc.service(`http://localhost:${port}`)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('fails on bad auth before invalid request payload.', async () => {
    try {
      await client.call(
        'io.example.authTest',
        {},
        { present: false },
        {
          headers: basicAuthHeaders({
            username: 'admin',
            password: 'wrong',
          }),
        },
      )
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('AuthenticationRequired')
      expect(e.message).toBe('Authentication Required')
      expect(e.status).toBe(401)
    }
  })

  it('fails on invalid request payload after good auth.', async () => {
    try {
      await client.call(
        'io.example.authTest',
        {},
        { present: false },
        {
          headers: basicAuthHeaders({
            username: 'admin',
            password: 'password',
          }),
        },
      )
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('InvalidRequest')
      expect(e.message).toBe('Input/present must be true')
      expect(e.status).toBe(400)
    }
  })

  it('succeeds on good auth and payload.', async () => {
    const res = await client.call(
      'io.example.authTest',
      {},
      { present: true },
      {
        headers: basicAuthHeaders({
          username: 'admin',
          password: 'password',
        }),
      },
    )
    expect(res.success).toBe(true)
    expect(res.data).toEqual({
      username: 'admin',
      original: 'YWRtaW46cGFzc3dvcmQ=',
    })
  })
})
