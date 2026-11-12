import { once } from 'node:events'
import { type IncomingMessage, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import { type WebSocket, WebSocketServer } from 'ws'
import { type LexValue, encode } from '@atproto/lex-cbor'
import { subscribeRepos } from './subscribe-repos.js'

const NSID = 'com.atproto.sync.subscribeRepos'

// RFC 6455 normal closure
const NORMAL_CLOSURE = 1000

// maxReconnectSeconds: 0 caps the backoff at 0ms, so reconnects don't wait.
const noBackoff = { maxReconnectSeconds: 0 }

/** Encodes an XRPC event stream frame: a CBOR header followed by a CBOR body. */
function frame(header: LexValue, body: LexValue): Buffer {
  return Buffer.concat([encode(header), encode(body)])
}

const identityFrame = (seq: number) =>
  frame(
    { op: 1, t: '#identity' },
    { seq, did: 'did:plc:alice', time: '2026-01-01T00:00:00.000Z' },
  )

/**
 * Starts a WebSocket server; dispose with `await using`. `onConnection` is
 * called for every connection, with its 0-based index. `requests` records every
 * upgrade request, so a test can assert on the URLs a subscription dialed.
 */
async function startServer(
  onConnection: (connection: { ws: WebSocket; index: number }) => void,
) {
  const requests: IncomingMessage[] = []
  const server = createServer()
  const wss = new WebSocketServer({ server })
  let index = 0
  wss.on('connection', (ws, req) => {
    requests.push(req)
    onConnection({ ws, index: index++ })
  })
  await once(server.listen(0), 'listening')
  const { port } = server.address() as AddressInfo
  return {
    origin: new URL(`http://localhost:${port}`),
    requests,
    async [Symbol.asyncDispose]() {
      for (const ws of wss.clients) ws.terminate()
      wss.close()
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

async function drain<T>(gen: AsyncGenerator<T, void, unknown>): Promise<T[]> {
  const out: T[] = []
  for await (const m of gen) out.push(m)
  return out
}

describe(subscribeRepos, () => {
  it('resumes from the last received seq after a reconnect', async () => {
    await using server = await startServer(({ ws, index }) => {
      if (index === 0) {
        ws.send(identityFrame(1))
        // #info carries no seq, so it leaves the cursor where it was
        ws.send(frame({ op: 1, t: '#info' }, { name: 'OutdatedCursor' }))
        ws.send(identityFrame(2), () => ws.terminate())
      } else {
        ws.send(identityFrame(3), () => ws.close(NORMAL_CLOSURE))
      }
    })
    const messages = await drain(
      subscribeRepos(server.origin, { ...noBackoff, cursor: 0 }),
    )
    expect(messages.map((m) => m.$type)).toEqual([
      `${NSID}#identity`,
      `${NSID}#info`,
      `${NSID}#identity`,
      `${NSID}#identity`,
    ])
    expect(server.requests.map((r) => r.url)).toEqual([
      `/xrpc/${NSID}?cursor=0`,
      `/xrpc/${NSID}?cursor=2`,
    ])
  })

  it('starts from the live tip without a cursor', async () => {
    await using server = await startServer(({ ws }) => {
      ws.close(NORMAL_CLOSURE)
    })
    await drain(subscribeRepos(server.origin, noBackoff))
    expect(server.requests.map((r) => r.url)).toEqual([`/xrpc/${NSID}`])
  })

  it('uses a cursor function on every connection without tracking', async () => {
    await using server = await startServer(({ ws, index }) => {
      if (index === 0) ws.send(identityFrame(5), () => ws.terminate())
      else ws.close(NORMAL_CLOSURE)
    })
    using cursor = vi.fn(async () => 1)
    await drain(subscribeRepos(server.origin, { ...noBackoff, cursor }))
    expect(cursor).toHaveBeenCalledTimes(2)
    expect(server.requests.map((r) => r.url)).toEqual([
      `/xrpc/${NSID}?cursor=1`,
      `/xrpc/${NSID}?cursor=1`,
    ])
  })

  it('invokes a url function before every connection', async () => {
    await using server = await startServer(({ ws, index }) => {
      if (index === 0) ws.send(identityFrame(1), () => ws.terminate())
      else ws.close(NORMAL_CLOSURE)
    })
    using url = vi.fn(async () => server.origin)
    await drain(subscribeRepos(url, noBackoff))
    expect(url).toHaveBeenCalledTimes(2)
    expect(server.requests.map((r) => r.url)).toEqual([
      `/xrpc/${NSID}`,
      `/xrpc/${NSID}?cursor=1`,
    ])
  })

  it('forwards connection options to the WebSocket', async () => {
    await using server = await startServer(({ ws }) => {
      ws.close(NORMAL_CLOSURE)
    })
    await drain(
      subscribeRepos(server.origin, {
        ...noBackoff,
        headers: { 'x-example': 'value' },
      }),
    )
    expect(server.requests[0].headers).toMatchObject({ 'x-example': 'value' })
  })
})
