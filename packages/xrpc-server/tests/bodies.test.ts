import * as http from 'http'
import { Readable } from 'stream'
import { gzipSync } from 'zlib'
import getPort from 'get-port'
import xrpc, { ServiceClient } from '@atproto/xrpc'
import { bytesToStream, cidForCbor } from '@atproto/common'
import { randomBytes } from '@atproto/crypto'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
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
              bar: { type: 'integer' },
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
              bar: { type: 'integer' },
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
              bar: { type: 'integer' },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.blobTest',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: '*/*',
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['cid'],
            properties: {
              cid: { type: 'string' },
            },
          },
        },
      },
    },
  },
]

const BLOB_LIMIT = 5000

describe('Bodies', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS, {
    payload: {
      blobLimit: BLOB_LIMIT,
    },
  })
  server.method(
    'io.example.validationTest',
    (ctx: { params: xrpcServer.Params; input?: xrpcServer.HandlerInput }) => ({
      encoding: 'json',
      body: ctx.input?.body,
    }),
  )
  server.method('io.example.validationTest2', () => ({
    encoding: 'json',
    body: { wrong: 'data' },
  }))
  server.method(
    'io.example.blobTest',
    async (ctx: { input?: xrpcServer.HandlerInput }) => {
      if (!(ctx.input?.body instanceof Readable))
        throw new Error('Input not readable')
      const buffers: Buffer[] = []
      for await (const data of ctx.input.body) {
        buffers.push(data)
      }
      const cid = await cidForCbor(Buffer.concat(buffers))
      return {
        encoding: 'json',
        body: { cid: cid.toString() },
      }
    },
  )
  xrpc.addLexicons(LEXICONS)

  let client: ServiceClient
  let url: string
  beforeAll(async () => {
    const port = await getPort()
    s = await createServer(port, server)
    url = `http://localhost:${port}`
    client = xrpc.service(url)
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
    await expect(
      client.call(
        'io.example.validationTest',
        {},
        { foo: 'hello', bar: 123 },
        { encoding: 'image/jpeg' },
      ),
    ).rejects.toThrow(`Wrong request encoding (Content-Type): image/jpeg`)

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

  it('supports blobs and compression', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const { data: uncompressed } = await client.call(
      'io.example.blobTest',
      {},
      bytes,
      {
        encoding: 'application/octet-stream',
      },
    )
    expect(uncompressed.cid).toEqual(expectedCid.toString())

    const { data: compressed } = await client.call(
      'io.example.blobTest',
      {},
      gzipSync(bytes),
      {
        encoding: 'application/octet-stream',
        headers: {
          'content-encoding': 'gzip',
        },
      },
    )
    expect(compressed.cid).toEqual(expectedCid.toString())
  })

  it('supports max blob size (based on content-length)', async () => {
    const bytes = randomBytes(BLOB_LIMIT + 1)

    // Exactly the number of allowed bytes
    await client.call('io.example.blobTest', {}, bytes.slice(0, BLOB_LIMIT), {
      encoding: 'application/octet-stream',
    })

    // Over the number of allowed bytes
    const promise = client.call('io.example.blobTest', {}, bytes, {
      encoding: 'application/octet-stream',
    })

    await expect(promise).rejects.toThrow('request entity too large')
  })

  it('supports max blob size (missing content-length)', async () => {
    // We stream bytes in these tests so that content-length isn't included.
    const bytes = randomBytes(BLOB_LIMIT + 1)

    // Exactly the number of allowed bytes
    await client.call(
      'io.example.blobTest',
      {},
      bytesToStream(bytes.slice(0, BLOB_LIMIT)),
      {
        encoding: 'application/octet-stream',
      },
    )

    // Over the number of allowed bytes.
    const promise = client.call(
      'io.example.blobTest',
      {},
      bytesToStream(bytes),
      {
        encoding: 'application/octet-stream',
      },
    )

    await expect(promise).rejects.toThrow('request entity too large')
  })

  it('requires any parsable Content-Type for blob uploads', async () => {
    // not a real mimetype, but correct syntax
    await client.call('io.example.blobTest', {}, randomBytes(BLOB_LIMIT), {
      encoding: 'some/thing',
    })
  })

  // @TODO: figure out why this is failing dependent on the prev test being run
  // https://github.com/bluesky-social/atproto/pull/550/files#r1106400413
  it.skip('errors on an empty Content-type on blob upload', async () => {
    // empty mimetype, but correct syntax
    const res = await fetch(`${url}/xrpc/io.example.blobTest`, {
      method: 'post',
      headers: { 'Content-Type': '' },
      body: randomBytes(BLOB_LIMIT),
      // @ts-ignore see note in @atproto/xrpc/client.ts
      duplex: 'half',
    })
    const resBody = await res.json()
    const status = res.status
    expect(status).toBe(400)
    expect(resBody.error).toBe('InvalidRequest')
    expect(resBody.message).toBe(
      'Request encoding (Content-Type) required but not provided',
    )
  })
})
