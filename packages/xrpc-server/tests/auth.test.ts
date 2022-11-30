import * as http from 'http'
import express from 'express'
import xrpc, { XRPCError } from '@atproto/xrpc'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import { AuthRequiredError } from '../src'

const SCHEMAS = [
  {
    lexicon: 1,
    id: 'io.example.authTest',
    type: 'procedure',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        properties: {
          present: { const: true },
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
]

describe('Auth', () => {
  let s: http.Server
  const server = xrpcServer.createServer(SCHEMAS)
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
  const client = xrpc.service(`http://localhost:8894`)
  xrpc.addSchemas(SCHEMAS)
  beforeAll(async () => {
    s = await createServer(8894, server)
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
      expect(e.message).toBe('input/present must be equal to constant')
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

function createBasicAuth(allowed: { username: string; password: string }) {
  return function (req: express.Request) {
    const header = req.headers.authorization ?? ''
    if (!header.startsWith('Basic ')) {
      throw new AuthRequiredError()
    }
    const original = header.replace('Basic ', '')
    const [username, password] = Buffer.from(original, 'base64')
      .toString()
      .split(':')
    if (username !== allowed.username || password !== allowed.password) {
      throw new AuthRequiredError()
    }
    return {
      credentials: { username },
      artifacts: { original },
    }
  }
}

function basicAuthHeaders(creds: { username: string; password: string }) {
  return {
    authorization:
      'Basic ' +
      Buffer.from(`${creds.username}:${creds.password}`).toString('base64'),
  }
}
