import assert from 'node:assert'
import * as http from 'node:http'
import { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { cidForCbor } from '@atproto/common'
import { randomBytes } from '@atproto/crypto'
import { LexiconDoc } from '@atproto/lexicon'
import { ResponseType, XrpcClient } from '@atproto/xrpc'
import * as xrpcServer from '../src'
import { logger } from '../src/logger'
import {
  buildAddLexicons,
  buildMethodLexicons,
  closeServer,
  createServer,
} from './_util'

const BLOB_LIMIT = 5000

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
] as const satisfies LexiconDoc[]

const handlers = {
  'io.example.validationTest': (ctx: xrpcServer.HandlerContext) => {
    assert(!(ctx.input?.body instanceof Readable), 'Input is readable')

    return {
      encoding: 'application/json',
      body: ctx.input?.body ?? null,
    }
  },
  'io.example.validationTestTwo': () => {
    return {
      encoding: 'application/json',
      body: { wrong: 'data' },
    }
  },
  'io.example.blobTest': async (ctx: xrpcServer.HandlerContext) => {
    assert(ctx.input?.body != null, 'Input body is required')
    const buffer = await consumeInput(ctx.input.body)
    const cid = await cidForCbor(buffer)
    return {
      encoding: 'application/json',
      body: { cid: cid.toString() },
    }
  },
}

for (const buildServer of [buildMethodLexicons, buildAddLexicons]) {
  describe(buildServer, () => {
    let s: http.Server
    let client: XrpcClient
    let url: string
    beforeAll(async () => {
      const server = await buildServer(LEXICONS, handlers, {
        payload: {
          blobLimit: BLOB_LIMIT,
        },
      })
      s = await createServer(server)
      const { port } = s.address() as AddressInfo
      url = `http://localhost:${port}`
      client = new XrpcClient(url, LEXICONS)
    })
    afterAll(async () => {
      if (s) await closeServer(s)
    })

    test('io.example.validationTest', async () => {
      const res = await client.call(
        'io.example.validationTest',
        {},
        { foo: 'hello', bar: 123 },
      )
      expect(res.success).toBe(true)
      expect(res.data.foo).toBe('hello')
      expect(res.data.bar).toBe(123)
    })

    test('requires content-type when body is expected', async () => {
      await expect(
        client.call('io.example.validationTest', {}),
      ).rejects.toMatchObject({
        message: 'Request encoding (Content-Type) required but not provided',
      })
    })
    test('validates required input properties', async () => {
      await expect(
        client.call('io.example.validationTest', {}, {}),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: expect.stringContaining('foo'),
      })
    })
    test('validates input property types', async () => {
      await expect(
        client.call('io.example.validationTest', {}, { foo: 123 }),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: expect.stringContaining('foo'),
      })
    })
    test('rejects invalid encoding for object data', async () => {
      await expect(
        client.call(
          'io.example.validationTest',
          {},
          { foo: 'hello', bar: 123 },
          { encoding: 'image/jpeg' },
        ),
      ).rejects.toMatchObject({
        message: `Unable to encode object as image/jpeg data`,
      })
    })
    test('rejects image/jpeg content-type for json schema', async () => {
      await expect(
        client.call(
          'io.example.validationTest',
          {},
          // Does not need to be a valid jpeg
          new Blob([randomBytes(123)], { type: 'image/jpeg' }),
        ),
      ).rejects.toMatchObject({
        message: `Wrong request encoding (Content-Type): image/jpeg`,
      })
    })
    test('rejects multipart/form-data content-type for json schema', async () => {
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
      ).rejects.toMatchObject({
        message: `Wrong request encoding (Content-Type): multipart/form-data`,
      })
    })
    test('rejects application/x-www-form-urlencoded content-type for json schema', async () => {
      await expect(
        client.call(
          'io.example.validationTest',
          {},
          new URLSearchParams([['foo', 'bar']]),
        ),
      ).rejects.toMatchObject({
        message: `Wrong request encoding (Content-Type): application/x-www-form-urlencoded`,
      })
    })
    test('rejects application/octet-stream blob for json schema', async () => {
      await expect(
        client.call(
          'io.example.validationTest',
          {},
          new Blob([new Uint8Array([1])]),
        ),
      ).rejects.toMatchObject({
        message: `Wrong request encoding (Content-Type): application/octet-stream`,
      })
    })
    test('rejects application/octet-stream readable stream for json schema', async () => {
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
      ).rejects.toMatchObject({
        message: `Wrong request encoding (Content-Type): application/octet-stream`,
      })
    })
    test('rejects application/octet-stream uint8array for json schema', async () => {
      await expect(
        client.call('io.example.validationTest', {}, new Uint8Array([1])),
      ).rejects.toMatchObject({
        message: `Wrong request encoding (Content-Type): application/octet-stream`,
      })
    })

    test('validation errors on procedures include details in logs', async () => {
      // 500 responses don't include details, so we nab details from the logger.
      const spy = jest.spyOn(logger, 'error')
      try {
        await expect(
          client.call('io.example.validationTestTwo'),
        ).rejects.toThrow('Internal Server Error')

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            err: expect.objectContaining({
              message: expect.stringContaining('foo'),
            }),
          }),
          'unhandled exception in xrpc method io.example.validationTestTwo',
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('supports ArrayBuffers', async () => {
      const bytes = randomBytes(1024)
      const expectedCid = await cidForCbor(bytes)

      const bytesResponse = await client.call(
        'io.example.blobTest',
        {},
        bytes,
        {
          encoding: 'application/octet-stream',
        },
      )
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

    it('supports upload of json data', async () => {
      const jsonFile = new Blob(
        [Buffer.from(`{"foo":"bar","baz":[3, null]}`)],
        {
          type: 'application/json',
        },
      )
      const expectedCid = await cidForCbor(await jsonFile.arrayBuffer())
      const fileResponse = await client.call(
        'io.example.blobTest',
        {},
        jsonFile,
      )
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
            'content-encoding':
              'gzip, identity, deflate, identity, br, identity',
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
}

const bytesToReadableStream = (bytes: Uint8Array): ReadableStream => {
  // not using ReadableStream.from(), which lacks support in some contexts including nodejs v18.
  return new ReadableStream({
    pull(ctrl) {
      ctrl.enqueue(bytes)
      ctrl.close()
    },
  })
}

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
