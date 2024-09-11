import * as http from 'http'
import { Readable } from 'stream'
import { brotliCompressSync, deflateSync, gzipSync } from 'zlib'
import getPort from 'get-port'
import { LexiconDoc } from '@atproto/lexicon'
import { ResponseType, XrpcClient } from '@atproto/xrpc'
import { cidForCbor } from '@atproto/common'
import { randomBytes } from '@atproto/crypto'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import logger from '../src/logger'

const LEXICONS: LexiconDoc[] = [
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
    id: 'io.example.validationTestTwo',
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

async function consumeInput(
  input: Readable | string | object,
): Promise<Buffer> {
  if (Buffer.isBuffer(input)) {
    return input
  }
  if (typeof input === 'string') {
    return Buffer.from(input)
  }
  if (input instanceof Readable) {
    try {
      return Buffer.concat(await input.toArray())
    } catch (err) {
      if (err instanceof xrpcServer.XRPCError) {
        throw err
      } else {
        throw new xrpcServer.XRPCError(
          ResponseType.InvalidRequest,
          'unable to read input',
        )
      }
    }
  }
  throw new Error('Invalid input')
}

describe('Bodies', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS, {
    payload: {
      blobLimit: BLOB_LIMIT,
    },
  })
  server.method(
    'io.example.validationTest',
    (ctx: { params: xrpcServer.Params; input?: xrpcServer.HandlerInput }) => {
      if (ctx.input?.body instanceof Readable) {
        throw new Error('Input is readable')
      }

      return {
        encoding: 'json',
        body: ctx.input?.body ?? null,
      }
    },
  )
  server.method('io.example.validationTestTwo', () => ({
    encoding: 'json',
    body: { wrong: 'data' },
  }))
  server.method(
    'io.example.blobTest',
    async (ctx: { input?: xrpcServer.HandlerInput }) => {
      const buffer = await consumeInput(ctx.input?.body)
      const cid = await cidForCbor(buffer)
      return {
        encoding: 'json',
        body: { cid: cid.toString() },
      }
    },
  )

  let client: XrpcClient
  let url: string
  beforeAll(async () => {
    const port = await getPort()
    s = await createServer(port, server)
    url = `http://localhost:${port}`
    client = new XrpcClient(url, LEXICONS)
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
      'Request encoding (Content-Type) required but not provided',
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
    ).rejects.toThrow(`Unable to encode object as image/jpeg data`)
    await expect(
      client.call(
        'io.example.validationTest',
        {},
        // Does not need to be a valid jpeg
        new Blob([randomBytes(123)], { type: 'image/jpeg' }),
      ),
    ).rejects.toThrow(`Wrong request encoding (Content-Type): image/jpeg`)
    await expect(
      client.call(
        'io.example.validationTest',
        {},
        (() => {
          const formData = new FormData()
          formData.append('foo', 'bar')
          return formData
        })(),
      ),
    ).rejects.toThrow(
      `Wrong request encoding (Content-Type): multipart/form-data`,
    )
    await expect(
      client.call(
        'io.example.validationTest',
        {},
        new URLSearchParams([['foo', 'bar']]),
      ),
    ).rejects.toThrow(
      `Wrong request encoding (Content-Type): application/x-www-form-urlencoded`,
    )
    await expect(
      client.call(
        'io.example.validationTest',
        {},
        new Blob([new Uint8Array([1])]),
      ),
    ).rejects.toThrow(
      `Wrong request encoding (Content-Type): application/octet-stream`,
    )
    await expect(
      client.call(
        'io.example.validationTest',
        {},
        new ReadableStream({
          pull(ctrl) {
            ctrl.enqueue(new Uint8Array([1]))
            ctrl.close()
          },
        }),
      ),
    ).rejects.toThrow(
      `Wrong request encoding (Content-Type): application/octet-stream`,
    )
    await expect(
      client.call('io.example.validationTest', {}, new Uint8Array([1])),
    ).rejects.toThrow(
      `Wrong request encoding (Content-Type): application/octet-stream`,
    )

    // 500 responses don't include details, so we nab details from the logger.
    let error: string | undefined
    const origError = logger.error
    logger.error = (obj, ...args) => {
      error = obj.message
      logger.error = origError
      return logger.error(obj, ...args)
    }

    await expect(client.call('io.example.validationTestTwo')).rejects.toThrow(
      'Internal Server Error',
    )
    expect(error).toEqual(`Output must have the property "foo"`)
  })

  it('supports ArrayBuffers', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const bytesResponse = await client.call('io.example.blobTest', {}, bytes, {
      encoding: 'application/octet-stream',
    })
    expect(bytesResponse.data.cid).toEqual(expectedCid.toString())
  })

  it('supports empty payload on procedues with encoding', async () => {
    const bytes = new Uint8Array(0)
    const expectedCid = await cidForCbor(bytes)
    const bytesResponse = await client.call('io.example.blobTest', {}, bytes)
    expect(bytesResponse.data.cid).toEqual(expectedCid.toString())
  })

  it('supports upload of empty txt file', async () => {
    const txtFile = new Blob([], { type: 'text/plain' })
    const expectedCid = await cidForCbor(await txtFile.arrayBuffer())
    const fileResponse = await client.call('io.example.blobTest', {}, txtFile)
    expect(fileResponse.data.cid).toEqual(expectedCid.toString())
  })

  // This does not work because the xrpc-server will add a json middleware
  // regardless of the "input" definition. This is probably a behavior that
  // should be fixed in the xrpc-server.
  it.skip('supports upload of json data', async () => {
    const jsonFile = new Blob([Buffer.from(`{"foo":"bar","baz":[3, null]}`)], {
      type: 'application/json',
    })
    const expectedCid = await cidForCbor(await jsonFile.arrayBuffer())
    const fileResponse = await client.call('io.example.blobTest', {}, jsonFile)
    expect(fileResponse.data.cid).toEqual(expectedCid.toString())
  })

  it('supports ArrayBufferView', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const bufferResponse = await client.call(
      'io.example.blobTest',
      {},
      Buffer.from(bytes),
    )
    expect(bufferResponse.data.cid).toEqual(expectedCid.toString())
  })

  it('supports Blob', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const blobResponse = await client.call(
      'io.example.blobTest',
      {},
      new Blob([bytes], { type: 'application/octet-stream' }),
    )
    expect(blobResponse.data.cid).toEqual(expectedCid.toString())
  })

  it('supports Blob without explicit type', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const blobResponse = await client.call(
      'io.example.blobTest',
      {},
      new Blob([bytes]),
    )
    expect(blobResponse.data.cid).toEqual(expectedCid.toString())
  })

  it('supports ReadableStream', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const streamResponse = await client.call(
      'io.example.blobTest',
      {},
      // ReadableStream.from not available in node < 20
      new ReadableStream({
        pull(ctrl) {
          ctrl.enqueue(bytes)
          ctrl.close()
        },
      }),
    )
    expect(streamResponse.data.cid).toEqual(expectedCid.toString())
  })

  it('supports blob uploads', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const { data } = await client.call('io.example.blobTest', {}, bytes, {
      encoding: 'application/octet-stream',
    })
    expect(data.cid).toEqual(expectedCid.toString())
  })

  it(`supports identity encoding`, async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const { data } = await client.call('io.example.blobTest', {}, bytes, {
      encoding: 'application/octet-stream',
      headers: { 'content-encoding': 'identity' },
    })
    expect(data.cid).toEqual(expectedCid.toString())
  })

  it('supports gzip encoding', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const { data } = await client.call(
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
    expect(data.cid).toEqual(expectedCid.toString())
  })

  it('supports deflate encoding', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const { data } = await client.call(
      'io.example.blobTest',
      {},
      deflateSync(bytes),
      {
        encoding: 'application/octet-stream',
        headers: {
          'content-encoding': 'deflate',
        },
      },
    )
    expect(data.cid).toEqual(expectedCid.toString())
  })

  it('supports br encoding', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const { data } = await client.call(
      'io.example.blobTest',
      {},
      brotliCompressSync(bytes),
      {
        encoding: 'application/octet-stream',
        headers: {
          'content-encoding': 'br',
        },
      },
    )
    expect(data.cid).toEqual(expectedCid.toString())
  })

  it('supports multiple encodings', async () => {
    const bytes = randomBytes(1024)
    const expectedCid = await cidForCbor(bytes)

    const { data } = await client.call(
      'io.example.blobTest',
      {},
      brotliCompressSync(deflateSync(gzipSync(bytes))),
      {
        encoding: 'application/octet-stream',
        headers: {
          'content-encoding': 'gzip, identity, deflate, identity, br, identity',
        },
      },
    )
    expect(data.cid).toEqual(expectedCid.toString())
  })

  it('fails gracefully on invalid encodings', async () => {
    const bytes = randomBytes(1024)

    const promise = client.call(
      'io.example.blobTest',
      {},
      brotliCompressSync(bytes),
      {
        encoding: 'application/octet-stream',
        headers: {
          'content-encoding': 'gzip',
        },
      },
    )

    await expect(promise).rejects.toThrow('unable to read input')
  })

  it('supports empty payload', async () => {
    const bytes = new Uint8Array(0)
    const expectedCid = await cidForCbor(bytes)

    // Using "undefined" as body to avoid encoding as lexicon { $bytes: "<base64>" }
    const result = await client.call('io.example.blobTest', {}, bytes, {
      encoding: 'text/plain',
    })

    expect(result.data.cid).toEqual(expectedCid.toString())
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
      bytesToReadableStream(bytes.slice(0, BLOB_LIMIT)),
      {
        encoding: 'application/octet-stream',
      },
    )

    // Over the number of allowed bytes.
    const promise = client.call(
      'io.example.blobTest',
      {},
      bytesToReadableStream(bytes),
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

  it('errors on an empty Content-type on blob upload', async () => {
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
    expect(resBody).toMatchObject({
      error: 'InvalidRequest',
      message: 'Request encoding (Content-Type) required but not provided',
    })
  })
})

const bytesToReadableStream = (bytes: Uint8Array): ReadableStream => {
  // not using ReadableStream.from(), which lacks support in some contexts including nodejs v18.
  return new ReadableStream({
    pull(ctrl) {
      ctrl.enqueue(bytes)
      ctrl.close()
    },
  })
}
