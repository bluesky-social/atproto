import * as http from 'http'
import getPort from 'get-port'
import xrpc, { ServiceClient } from '@atproto/xrpc'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import { Readable } from 'stream'
import { randomBytes } from 'crypto'
import { gzipSync } from 'zlib'
import { cidForCbor } from '@atproto/common'
import { XRPCError } from '@atproto/xrpc'
import assert from 'assert'
import { wait } from '@atproto/common'

const LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.params',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['str', 'int', 'bool', 'arr'],
          properties: {
            str: { type: 'string', minLength: 2, maxLength: 10 },
            int: { type: 'integer', minimum: 2, maximum: 10 },
            bool: { type: 'boolean' },
            arr: { type: 'array', items: { type: 'integer' }, maxLength: 2 },
            def: { type: 'integer', default: 0 },
          },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.jsonUp',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['str', 'int', 'bool', 'arr'],
            properties: {
              str: { type: 'string', minLength: 2, maxLength: 10 },
              int: { type: 'integer', minimum: 2, maximum: 10 },
              bool: { type: 'boolean' },
              arr: { type: 'array', items: { type: 'integer' }, maxLength: 2 },
              def: { type: 'integer', default: 0 },
            },
          },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.blobUp',
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
  {
    lexicon: 1,
    id: 'io.example.blobDown',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            compressed: { type: 'boolean' },
          },
        },
        output: {
          encoding: '*/*',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.headers',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.errors',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            statusCode: { type: 'integer' },
          },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.errorBadConnection',
    defs: {
      main: {
        type: 'query',
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.errorTimeout',
    defs: {
      main: {
        type: 'query',
      },
    },
  },
]

describe('Proxy', () => {
  let srv: http.Server
  let proxySrv: http.Server
  let client: ServiceClient
  let proxyClient: ServiceClient

  const server = xrpcServer.createServer(LEXICONS)
  const proxy = xrpcServer.createServer(LEXICONS)
  const proxyHandler = (ctx: xrpcServer.XRPCReqContext) => {
    return xrpcServer.proxy(ctx, client.uri.href)
  }

  proxy.method('io.example.params', proxyHandler)
  server.method('io.example.params', (ctx) => {
    return {
      encoding: 'json',
      body: ctx.params,
    }
  })

  proxy.method('io.example.jsonUp', proxyHandler)
  server.method('io.example.jsonUp', (ctx) => {
    return {
      encoding: 'json',
      body: ctx.input?.body,
    }
  })

  proxy.method('io.example.blobUp', proxyHandler)
  server.method('io.example.blobUp', async (ctx) => {
    if (!(ctx.input?.body instanceof Readable))
      throw new Error('Input not readable')
    const buffers: Buffer[] = []
    for await (const data of ctx.input.body) {
      buffers.push(data)
    }
    const cid = await cidForCbor(Buffer.concat(buffers))
    return {
      encoding: 'application/json',
      body: { cid: cid.toString() },
    }
  })

  proxy.method('io.example.blobDown', proxyHandler)
  server.method('io.example.blobDown', (ctx) => {
    const body = randomBytes(1024)
    return {
      encoding: 'application/octet-stream',
      body: ctx.params.compressed ? gzipSync(body) : body,
      headers: {
        'content-encoding': ctx.params.compressed ? 'gzip' : 'identity',
      },
    }
  })

  proxy.method('io.example.headers', proxyHandler)
  server.method('io.example.headers', (ctx) => {
    return {
      encoding: 'application/json',
      body: ctx.req.headers,
      headers: {
        'my-custom-header-down': 'my-custom-header-down-val',
      },
    }
  })

  proxy.method('io.example.errors', proxyHandler)
  server.method('io.example.errors', (ctx) => {
    return {
      status: Number(ctx.params.statusCode || 400),
      message: 'Oops!',
      error: 'ERR_OOPS',
    }
  })

  proxy.method('io.example.errorBadConnection', async (ctx) => {
    const unusedport = await getPort()
    return xrpcServer.proxy(ctx, `http://localhost:${unusedport}`)
  })

  proxy.method('io.example.errorTimeout', async (ctx) => {
    return xrpcServer.proxy(ctx, client.uri.href, { timeout: 1 })
  })
  server.method('io.example.errorTimeout', async () => {
    await wait(100)
    return { encoding: 'application/json' }
  })

  xrpc.addLexicons(LEXICONS)

  beforeAll(async () => {
    const port = await getPort()
    const proxyPort = await getPort()
    srv = await createServer(port, server)
    proxySrv = await createServer(proxyPort, proxy)
    client = xrpc.service(`http://localhost:${port}`)
    proxyClient = xrpc.service(`http://localhost:${proxyPort}`)
  })

  afterAll(async () => {
    await closeServer(srv)
    await closeServer(proxySrv)
  })

  it('proxies query params', async () => {
    const res = await proxyClient.call('io.example.params', {
      str: 10,
      int: '5',
      bool: 'foo',
      arr: '3',
    })
    expect(res.success).toBeTruthy()
    expect(res.data.str).toBe('10')
    expect(res.data.int).toBe(5)
    expect(res.data.bool).toBe(true)
    expect(res.data.arr).toEqual([3])
    expect(res.data.def).toEqual(0)
    expect(res.headers['content-type']).toContain('application/json')
  })

  it('proxies json input', async () => {
    const res = await proxyClient.call(
      'io.example.jsonUp',
      {},
      {
        str: '10',
        int: 5,
        bool: true,
        arr: [3],
      },
    )
    expect(res.success).toBeTruthy()
    expect(res.data.str).toBe('10')
    expect(res.data.int).toBe(5)
    expect(res.data.bool).toBe(true)
    expect(res.data.arr).toEqual([3])
    expect(res.data.def).toEqual(0)
    expect(res.headers['content-type']).toContain('application/json')
  })

  it('proxies blob input uncompressed', async () => {
    const blob = randomBytes(1024)
    const cid = await cidForCbor(blob)
    const res = await proxyClient.call('io.example.blobUp', {}, blob, {
      headers: {
        'content-type': 'application/octet-stream',
      },
    })
    expect(res.success).toBeTruthy()
    expect(res.data.cid).toBe(cid.toString())
    expect(res.headers['content-type']).toContain('application/json')
  })

  it('proxies blob input compressed', async () => {
    const blob = randomBytes(1024)
    const cid = await cidForCbor(blob)
    const res = await proxyClient.call(
      'io.example.blobUp',
      {},
      gzipSync(blob),
      {
        headers: {
          'content-type': 'application/octet-stream',
          'content-encoding': 'gzip',
        },
      },
    )
    expect(res.success).toBeTruthy()
    expect(res.data.cid).toBe(cid.toString())
    expect(res.headers['content-type']).toContain('application/json')
  })

  it('proxies blob output uncompressed', async () => {
    const res = await proxyClient.call('io.example.blobDown')
    expect(res.success).toBeTruthy()
    expect(res.data.byteLength).toBe(1024)
    expect(res.headers['content-type']).toBe('application/octet-stream')
    expect(res.headers['content-encoding']).toBe('identity')
  })

  it('proxies blob output compressed', async () => {
    const res = await proxyClient.call('io.example.blobDown', {
      compressed: true,
    })
    expect(res.success).toBeTruthy()
    expect(res.data.byteLength).toBe(1024)
    expect(res.headers['content-type']).toBe('application/octet-stream')
    expect(res.headers['content-encoding']).toBe('gzip')
  })

  it('proxies custom headers', async () => {
    const res = await proxyClient.call('io.example.headers', {}, undefined, {
      headers: {
        'my-custom-header-up': 'my-custom-header-up-val',
      },
    })
    expect(res.success).toBeTruthy()
    expect(res.data['my-custom-header-up']).toBe('my-custom-header-up-val')
    expect(res.headers['my-custom-header-down']).toBe(
      'my-custom-header-down-val',
    )
    expect(res.headers['content-type']).toContain('application/json')
  })

  it('proxies 4xx errors', async () => {
    const attempt1 = proxyClient.call('io.example.errors', {})
    await expect(attempt1).rejects.toThrow()
    const err1 = await attempt1.catch((err) => err)
    assert(err1 instanceof XRPCError)
    expect(err1.status).toEqual(400)
    expect(err1.error).toEqual('ERR_OOPS')
    expect(err1.message).toEqual('Oops!')
    expect(err1.headers?.['content-type']).toContain('application/json')

    const attempt2 = proxyClient.call('io.example.errors', { statusCode: 403 })
    await expect(attempt1).rejects.toThrow()
    const err2 = await attempt2.catch((err) => err)
    assert(err2 instanceof XRPCError)
    expect(err2.status).toEqual(403)
    expect(err2.error).toEqual('ERR_OOPS')
    expect(err2.message).toEqual('Oops!')
    expect(err2.headers?.['content-type']).toContain('application/json')
  })

  it('proxies 5xx errors', async () => {
    const attempt1 = proxyClient.call('io.example.errors', { statusCode: 500 })
    await expect(attempt1).rejects.toThrow()
    const err1 = await attempt1.catch((err) => err)
    assert(err1 instanceof XRPCError)
    expect(err1.status).toEqual(502)
    expect(err1.error).toEqual('UpstreamFailure')
    expect(err1.message).toEqual('Upstream Failure')
    expect(err1.headers?.['content-type']).toContain('application/json')

    const attempt2 = proxyClient.call('io.example.errors', { statusCode: 503 })
    await expect(attempt1).rejects.toThrow()
    const err2 = await attempt2.catch((err) => err)
    assert(err2 instanceof XRPCError)
    expect(err2.status).toEqual(502)
    expect(err2.error).toEqual('UpstreamFailure')
    expect(err2.message).toEqual('Upstream Failure')
    expect(err2.headers?.['content-type']).toContain('application/json')
  })

  it('proxies bad connection errors', async () => {
    const attempt = proxyClient.call('io.example.errorBadConnection')
    await expect(attempt).rejects.toThrow()
    const err = await attempt.catch((err) => err)
    assert(err instanceof XRPCError)
    expect(err.status).toEqual(502)
    expect(err.error).toEqual('UpstreamFailure')
    expect(err.message).toEqual('Upstream Failure')
    expect(err.headers?.['content-type']).toContain('application/json')
  })

  it('proxies connection timeout errors', async () => {
    const attempt = proxyClient.call('io.example.errorTimeout')
    await expect(attempt).rejects.toThrow()
    const err = await attempt.catch((err) => err)
    assert(err instanceof XRPCError)
    expect(err.status).toEqual(504)
    expect(err.error).toEqual('UpstreamTimeout')
    expect(err.message).toEqual('Upstream Timeout')
    expect(err.headers?.['content-type']).toContain('application/json')
  })
})
