import http from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
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
  private sockets = new Set<Socket>()

  constructor() {
    this.server = http.createServer((req, res) => {
      this.handler(req, res)
    })
    this.server.on('connection', (socket) => {
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

  async close(): Promise<void> {
    for (const socket of this.sockets) socket.destroy()
    await new Promise<void>((resolve, reject) =>
      this.server.close((err) => (err ? reject(err) : resolve())),
    )
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

  const createBlobStore = (cfg: {
    uploadTimeoutMs?: number
    requestTimeoutMs?: number
    maxAttempts?: number
  }) => {
    return new S3BlobStore('did:example:alice', {
      bucket: 'test-bucket',
      region: 'us-east-1',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
      ...cfg,
    })
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
})
