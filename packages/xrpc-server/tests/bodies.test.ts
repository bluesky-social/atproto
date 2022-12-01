import * as http from 'http'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import xrpc from '@atproto/xrpc'
import logger from '../src/logger'

const LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.validationTest',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['foo'],
            properties: {
              foo: { type: 'string' },
              bar: { type: 'number' },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['foo'],
            properties: {
              foo: { type: 'string' },
              bar: { type: 'number' },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.validationTest2',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['foo'],
            properties: {
              foo: { type: 'string' },
              bar: { type: 'number' },
            },
          },
        },
      },
    },
  },
]

describe('Parameters', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method(
    'io.example.validationTest',
    (_params: xrpcServer.Params, input?: xrpcServer.HandlerInput) => ({
      encoding: 'json',
      body: input?.body,
    }),
  )
  server.method('io.example.validationTest2', (_params: xrpcServer.Params) => ({
    encoding: 'json',
    body: { wrong: 'data' },
  }))
  const client = xrpc.service(`http://localhost:8892`)
  xrpc.addLexicons(LEXICONS)
  beforeAll(async () => {
    s = await createServer(8892, server)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('validates input and output bodies', async () => {
    const res1 = await client.call(
      'io.example.validationTest',
      {},
      {
        foo: 'hello',
        bar: 123,
      },
    )
    expect(res1.success).toBeTruthy()
    expect(res1.data.foo).toBe('hello')
    expect(res1.data.bar).toBe(123)

    await expect(client.call('io.example.validationTest', {})).rejects.toThrow(
      `A request body is expected but none was provided`,
    )
    await expect(
      client.call('io.example.validationTest', {}, {}),
    ).rejects.toThrow(`Input must have the property "foo"`)
    await expect(
      client.call('io.example.validationTest', {}, { foo: 123 }),
    ).rejects.toThrow(`Input/foo must be a string`)

    // 500 responses don't include details, so we nab details from the logger.
    let error: string | undefined
    const origError = logger.error
    logger.error = (obj, ...args) => {
      error = obj.message
      logger.error = origError
      return logger.error(obj, ...args)
    }

    await expect(client.call('io.example.validationTest2')).rejects.toThrow(
      'Internal Server Error',
    )
    expect(error).toEqual(`Output must have the property "foo"`)
  })
})
