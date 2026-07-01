import http from 'node:http'
import { AddressInfo } from 'node:net'
import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest'
import { S3BlobStore } from './s3.js'

type RequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void

/**
 * A minimal fake S3 endpoint whose behavior can be swapped per test. Requests
 * are handled by the handlers queue (one handler per incoming request, last
 * handler is re-used once the queue is exhausted).
 */
class FakeS3Server {
  server: http.Server
  handlers: RequestHandler[] = []
  requests: { method?: string; url?: string }[] = []
  private sockets = new Set<import('node:net').Socket>()

  constructor() {
    this.server = http.createServer((req, res) => {
      this.requests.push({ method: req.method, url: req.url })
      const handler =
        this.handlers.length > 1 ? this.handlers.shift() : this.handlers[0]
      assert(handler, 'no handler configured for incoming request')
      handler(req, res)
    })
    this.server.on('connection', (socket) => {
      this.sockets.add(socket)
      socket.on('close', () => this.sockets.delete(socket))
    })
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
    server.handlers.push(stallHandler, okHandler)

    const store = createBlobStore({
      uploadTimeoutMs: 30_000,
      requestTimeoutMs: 500,
    })

    const start = Date.now()
    await expect(store.putTemp(new Uint8Array([1, 2, 3]))).resolves.toBeTypeOf(
      'string',
    )

    expect(Date.now() - start).toBeLessThan(10_000)
    expect(
      server.requests.filter((r) => r.method === 'PUT').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('translates stalled connection errors into "Blob upload timed out"', async () => {
    // All requests stall. With retries disabled, the socket idle timeout
    // ("requestTimeoutMs") should reject the upload long before the total
    // upload budget ("uploadTimeoutMs") is exhausted.
    server.handlers.push(stallHandler)

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
    server.handlers.push(stallHandler)

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
})
