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
      str: { type: 'string', minLength: 2, maxLength: 10, required: true },
      int: { type: 'integer', minimum: 2, maximum: 10, required: true },
      num: { type: 'number', minimum: 2, maximum: 10, required: true },
      bool: { type: 'boolean', required: true },
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
    ).rejects.toThrow(`Parameter 'str' is less than minimum allowed length (2)`)
    await expect(
      client.call('io.example.paramTest', {
        str: 'loooooooooooooong',
        int: 5,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow(
      `Parameter 'str' is greater than maximum allowed length (10)`,
    )
    await expect(
      client.call('io.example.paramTest', {
        int: 5,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow(`Required parameter not supplied: str`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: -1,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow(`Parameter 'int' is less than minimum allowed value (2)`)
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 11,
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow(
      `Parameter 'int' is greater than maximum allowed value (10)`,
    )
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        num: 5.5,
        bool: true,
      }),
    ).rejects.toThrow(`Required parameter not supplied: int`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        num: -5.5,
        bool: true,
      }),
    ).rejects.toThrow(`Parameter 'num' is less than minimum allowed value (2)`)
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        num: 50.5,
        bool: true,
      }),
    ).rejects.toThrow(
      `Parameter 'num' is greater than maximum allowed value (10)`,
    )
    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        bool: true,
      }),
    ).rejects.toThrow(`Required parameter not supplied: num`)

    await expect(
      client.call('io.example.paramTest', {
        str: 'valid',
        int: 5,
        num: 5.5,
      }),
    ).rejects.toThrow(`Required parameter not supplied: bool`)
  })
})
