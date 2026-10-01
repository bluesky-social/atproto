import http from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
import { S3 } from '@aws-sdk/client-s3'
import { CID } from 'multiformats/cid'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { S3BlobStore } from './s3.js'

const testCid = CID.parse(
  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
)

type RequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void

/**
 * A minimal fake S3 endpoint whose behavior can be swapped per test. Override
 * {@link FakeS3Server.handler} via `vi.spyOn(server, 'handler')` to control how
 * each incoming request is handled.
 */
class FakeS3Server {
  server: http.Server
  connectionCount = 0
  private sockets = new Set<Socket>()

  constructor() {
    this.server = http.createServer((req, res) => {
      this.handler(req, res)
    })
    this.server.on('connection', (socket) => {
      this.connectionCount++
      this.sockets.add(socket)
      socket.on('close', () => this.sockets.delete(socket))
    })
  }

  /** Default handler; override per-test via `vi.spyOn(server, 'handler')`. */
  handler(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(501).end()
  }

  async listen(): Promise<string> {
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', resolve),
    )
    const { port } = this.server.address() as AddressInfo
    return `http://127.0.0.1:${port}`
  }

  /** Number of currently-open connections (keep-alive sockets included). */
  get openConnections(): number {
    return this.sockets.size
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) socket.destroy()
    await new Promise<void>((resolve, reject) =>
      this.server.close((err) => (err ? reject(err) : resolve())),
    )
  }
}

/** Polls `predicate` until it holds, or throws once `timeoutMs` elapses. */
const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 5_000,
): Promise<void> => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition')
    }
    await sleep(10)
  }
}

/** Consumes the request body, then never responds (stalled connection). */
const stallHandler: RequestHandler = (req) => {
  req.resume()
}

/** Consumes the request body, then responds with an S3-ish 200. */
const okHandler: RequestHandler = (req, res) => {
  req.on('data', () => {})
  req.on('end', () => {
    res.writeHead(200, { etag: '"d41d8cd98f00b204e9800998ecf8427e"' })
    res.end()
  })
}

describe(S3BlobStore, () => {
  let server: FakeS3Server
  let endpoint: string

  beforeEach(async () => {
    server = new FakeS3Server()
    endpoint = await server.listen()
  })

  afterEach(async () => {
    await server.close()
  })

  const createConfig = (cfg: {
    uploadTimeoutMs?: number
    requestTimeoutMs?: number
    maxAttempts?: number
  }) => ({
    bucket: 'test-bucket',
    region: 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
    ...cfg,
  })

  const createBlobStore = (cfg: Parameters<typeof createConfig>[0]) => {
    return new S3BlobStore('did:example:alice', createConfig(cfg))
  }

  it('reaps stalled requests at requestTimeoutMs and succeeds on retry', async () => {
    // First request stalls, second succeeds. The SDK should reap the stalled
    // request after "requestTimeoutMs" and transparently retry, well within
    // the total "uploadTimeoutMs" budget.
    using handlerMock = vi.spyOn(server, 'handler')
    handlerMock
      .mockImplementationOnce(stallHandler)
      .mockImplementation(okHandler)

    const store = createBlobStore({
      uploadTimeoutMs: 30_000,
      requestTimeoutMs: 500,
    })

    const start = Date.now()
    await expect(store.putTemp(new Uint8Array([1, 2, 3]))).resolves.toBeTypeOf(
      'string',
    )

    expect(Date.now() - start).toBeLessThan(10_000)
    const putCalls = handlerMock.mock.calls.filter(
      ([req]) => req.method === 'PUT',
    )
    expect(putCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('translates stalled connection errors into "Blob upload timed out"', async () => {
    // All requests stall. With retries disabled, the socket idle timeout
    // ("requestTimeoutMs") should reject the upload long before the total
    // upload budget ("uploadTimeoutMs") is exhausted.
    using _handlerMock = vi
      .spyOn(server, 'handler')
      .mockImplementation(stallHandler)

    const store = createBlobStore({
      uploadTimeoutMs: 60_000,
      requestTimeoutMs: 500,
      maxAttempts: 1,
    })

    const start = Date.now()
    await expect(store.putTemp(new Uint8Array([1, 2, 3]))).rejects.toSatisfy(
      (err) => {
        assert(err instanceof Error)
        expect(err.message).toBe('Blob upload timed out')
        assert(err.cause instanceof Error)
        expect(err.cause.name).toBe('TimeoutError')
        return true
      },
    )
    expect(Date.now() - start).toBeLessThan(10_000)
  })

  it('aborts the upload after uploadTimeoutMs', async () => {
    // All requests stall, and the socket idle timeout is larger than the
    // total upload budget: the AbortSignal based upload timeout should kick
    // in.
    using _handlerMock = vi
      .spyOn(server, 'handler')
      .mockImplementation(stallHandler)

    const store = createBlobStore({
      uploadTimeoutMs: 1_000,
      requestTimeoutMs: 30_000,
      maxAttempts: 1,
    })

    await expect(store.putTemp(new Uint8Array([1, 2, 3]))).rejects.toSatisfy(
      (err) => {
        assert(err instanceof Error)
        expect(err.message).toBe('Blob upload timed out')
        assert(err.cause instanceof Error)
        expect(err.cause.name).toBe('AbortError')
        return true
      },
    )
  })

  describe('downloads (getBytes)', () => {
    // The following tests characterize the behavior of the socket idle
    // timeout ("requestTimeoutMs") on the download direction, which -- unlike
    // uploads -- streams client-paced data from S3 (a slow blob consumer can
    // leave the S3 socket idle mid-transfer).
    //
    // With the installed @smithy/node-http-handler, when requestTimeout is
    // >= 6s its registration is deferred by 3s and cancelled as soon as the
    // response headers arrive. Since S3 sends response headers well within
    // 3s (unless stalled), the idle timeout does not apply while the response
    // body is being streamed.

    it('does not reap slow downloads mid-stream (requestTimeoutMs >= 6s)', async () => {
      const idleMs = 7_000
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation((req, res) => {
          req.resume()
          res.writeHead(200, { 'content-length': '6' })
          res.write('foo') // Headers + first bytes sent immediately
          sleep(idleMs).then(() => res.end('bar')) // Idle > requestTimeoutMs
        })

      const store = createBlobStore({ requestTimeoutMs: 6_000 })

      const start = Date.now()
      await expect(store.getBytes(testCid)).resolves.toEqual(
        new Uint8Array(Buffer.from('foobar')),
      )
      expect(Date.now() - start).toBeGreaterThanOrEqual(idleMs)
    }, 15_000)

    it('reaps stalled downloads that never receive response headers', async () => {
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation(stallHandler)

      const store = createBlobStore({
        requestTimeoutMs: 500,
        maxAttempts: 1,
      })

      const start = Date.now()
      await expect(store.getBytes(testCid)).rejects.toSatisfy((err) => {
        assert(err instanceof Error)
        expect(err.name).toBe('TimeoutError')
        return true
      })
      expect(Date.now() - start).toBeLessThan(6_000)
    })

    it('reaps slow downloads mid-stream when requestTimeoutMs < 6s', async () => {
      // @NOTE This characterizes why "requestTimeoutMs" should be kept above
      // 6s: below that threshold, @smithy/node-http-handler arms the socket
      // idle timeout immediately and keeps it armed while the response body
      // is being streamed, causing slow (but legitimate) downloads to fail.
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation((req, res) => {
          req.resume()
          res.writeHead(200, { 'content-length': '6' })
          res.write('foo')
          sleep(2_000).then(() => res.end('bar')) // Idle > requestTimeoutMs
        })

      const store = createBlobStore({
        requestTimeoutMs: 500,
        maxAttempts: 1,
      })

      await expect(store.getBytes(testCid)).rejects.toThrow()
    })
  })

  describe('connection reuse', () => {
    it('shares one connection pool across stores from creator()', async () => {
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation((req, res) => {
          req.resume()
          res.writeHead(200, { 'content-length': '3' }).end('foo')
        })

      const creator = S3BlobStore.creator(createConfig({}))
      for (let i = 0; i < 10; i++) {
        await creator(`did:example:user${i}`).getBytes(testCid)
      }

      expect(server.connectionCount).toBe(1)
    })

    it('does not cap concurrent connections', async () => {
      // Hold every response open until all requests have reached the server.
      // A capped pool (the SDK defaults to 50 sockets) would queue the excess
      // requests and never get there.
      const concurrency = 64
      let release!: () => void
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      let received = 0
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation((req, res) => {
          req.resume()
          res.writeHead(200, { 'content-length': '3' })
          res.write('f')
          if (++received === concurrency) release()
          released.then(() => res.end('oo'))
        })

      const creator = S3BlobStore.creator(createConfig({}))
      const downloads = Array.from({ length: concurrency }, (_, i) =>
        creator(`did:example:user${i}`).getBytes(testCid),
      )

      await released
      await expect(Promise.all(downloads)).resolves.toHaveLength(concurrency)
      expect(server.connectionCount).toBe(concurrency)
    })
  })

  describe('resource cleanup', () => {
    const getHandler: RequestHandler = (req, res) => {
      req.resume()
      res.writeHead(200, { 'content-length': '3' }).end('foo')
    }

    it('destroys its owned client and frees its sockets on dispose', async () => {
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation(getHandler)
      using destroySpy = vi.spyOn(S3.prototype, 'destroy')

      // No client passed => the store owns the client it creates.
      const store = createBlobStore({})
      await store.getBytes(testCid)

      // The request opened a keep-alive socket that stays open until disposal.
      expect(server.openConnections).toBe(1)
      expect(destroySpy).not.toHaveBeenCalled()

      await store[Symbol.asyncDispose]()

      expect(destroySpy).toHaveBeenCalledTimes(1)
      // Destroying the client tears down its agent, closing the idle socket.
      await waitFor(() => server.openConnections === 0)
    })

    it('does not destroy an externally-provided client on dispose', async () => {
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation(getHandler)

      const client = new S3({
        region: 'us-east-1',
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
      })
      try {
        const destroySpy = vi.spyOn(client, 'destroy')
        const store = new S3BlobStore(
          'did:example:alice',
          createConfig({}),
          client,
        )
        await store.getBytes(testCid)

        await store[Symbol.asyncDispose]()

        // The store borrows the client; its owner is responsible for teardown.
        expect(destroySpy).not.toHaveBeenCalled()
        expect(server.openConnections).toBe(1)
      } finally {
        client.destroy()
      }
    })

    it('destroys the shared client when the creator is disposed', async () => {
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation(getHandler)
      using destroySpy = vi.spyOn(S3.prototype, 'destroy')

      const creator = S3BlobStore.creator(createConfig({}))
      for (let i = 0; i < 3; i++) {
        await creator(`did:example:user${i}`).getBytes(testCid)
      }

      // All stores share one client, which the creator (not the stores) owns.
      expect(server.openConnections).toBe(1)
      expect(destroySpy).not.toHaveBeenCalled()

      await creator[Symbol.asyncDispose]()

      expect(destroySpy).toHaveBeenCalledTimes(1)
      await waitFor(() => server.openConnections === 0)
    })

    it('does not destroy the shared client when a creator store is disposed', async () => {
      using _handlerMock = vi
        .spyOn(server, 'handler')
        .mockImplementation(getHandler)
      using destroySpy = vi.spyOn(S3.prototype, 'destroy')

      const creator = S3BlobStore.creator(createConfig({}))
      const store = creator('did:example:alice')
      await store.getBytes(testCid)

      await store[Symbol.asyncDispose]()

      // The store does not own the shared client, so its socket stays open.
      expect(destroySpy).not.toHaveBeenCalled()
      expect(server.openConnections).toBe(1)

      await creator[Symbol.asyncDispose]()
      expect(destroySpy).toHaveBeenCalledTimes(1)
    })
  })
})
