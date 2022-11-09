import * as http from 'http'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import xrpc from '@atproto/xrpc'

const SCHEMAS = [
  {
    lexicon: 1,
    id: 'io.example.paramTest',
    type: 'query',
    parameters: {
      type: 'object',
      required: ['str', 'int', 'num', 'bool'],
      properties: {
        str: { type: 'string', minLength: 2, maxLength: 10 },
        int: { type: 'integer', minimum: 2, maximum: 10 },
        num: { type: 'number', minimum: 2, maximum: 10 },
        bool: { type: 'boolean' },
      },
    },
    output: {
      encoding: 'application/json',
    },
  },
]

describe('Parameters', () => {
  let s: http.Server
  const server = xrpcServer.createServer(SCHEMAS)
  server.method('io.example.paramTest', (params: xrpcServer.Params) => ({
    encoding: 'json',
    body: params,
  }))
  const client = xrpc.service(`http://localhost:8889`)
  xrpc.addSchemas(SCHEMAS)
  beforeAll(async () => {
    s = await createServer(8889, server)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('validates query params', async () => {
    const res1 = await client.call('io.example.paramTest', {
      str: 'valid',
      int: 5,
      num: 5.5,
      bool: true,
    })
    expect(res1.success).toBeTruthy()
    expect(res1.data.str).toBe('valid')
    expect(res1.data.int).toBe(5)
    expect(res1.data.num).toBe(5.5)
    expect(res1.data.bool).toBe(true)

    const res2 = await client.call('io.example.paramTest', {
      str: 10,
      int: '5',
      num: '5.5',
      bool: 'foo',
    })
    expect(res2.success).toBeTruthy()
    expect(res2.data.str).toBe('10')
    expect(res2.data.int).toBe(5)
    expect(res2.data.num).toBe(5.5)
    expect(res2.data.bool).toBe(true)

    await expect(
      client.call('io.example.paramTest', {
        str: 'n',
        int: 5,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow('parameters/str must NOT have fewer than 2 characters')
    await expect(
      client.call('io.example.paramTest', {
        str: 'loooooooooooooong',
        int: 5,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow('parameters/str must NOT have more than 10 characters')
    await expect(
      client.call('io.example.paramTest', {
        int: 5,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow(`parameters must have required property 'str'`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: -1,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow('parameters/int must be >= 2')
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 11,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow('parameters/int must be <= 10')
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow(`parameters must have required property 'int'`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        num: -5.5,
        bool: true,
      }),
    ).rejects.toThrow('parameters/num must be >= 2')
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        num: 50.5,
        bool: true,
      }),
    ).rejects.toThrow('parameters/num must be <= 10')
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        bool: true,
      }),
    ).rejects.toThrow(`parameters must have required property 'num'`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        num: 5.5,
      }),
    ).rejects.toThrow(`parameters must have required property 'bool'`)
  })
})
