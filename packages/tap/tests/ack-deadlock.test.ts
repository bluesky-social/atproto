import { describe, expect, it } from 'vitest'
import type { AddressInfo } from 'ws'
import { TapChannel, type TapHandler } from '../src/channel.js'
import { createWebSocketServer } from './_util.js'

const recordEvent = (id: number) => ({
  id,
  type: 'record' as const,
  record: {
    did: 'did:example:alice',
    rev: '3abc123',
    collection: 'com.example.post',
    rkey: 'abc123',
    action: 'create' as const,
    record: { text: 'hello' },
    cid: 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq',
    live: true,
  },
})

describe('TapChannel ack across a dropped connection', () => {
  it('does not hang when a handler awaits an ack it could not send', async () => {
    // Both shipped indexers `await opts.ack()` inside onEvent
    // (simple-indexer.ts, lex-indexer.ts). If the connection drops before the
    // ack is handed off, ackEvent buffers it and awaits a deferred that only
    // the reconnect can resolve — but the reconnect is inside the same
    // pull-driven loop the handler is currently blocking. Nothing can make
    // progress.
    const server = await createWebSocketServer()
    const { port } = server.address() as AddressInfo

    const acked: number[] = []
    let connections = 0
    server.on('connection', (socket) => {
      const isFirst = ++connections === 1
      socket.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'ack') {
          acked.push(msg.id)
          socket.close()
        }
      })
      if (isFirst) {
        // Deliver an event, then drop abruptly (1006) before the ack lands.
        socket.send(JSON.stringify(recordEvent(7)))
        socket.terminate()
      }
    })

    const handler: TapHandler = {
      onEvent: async (_evt, opts) => {
        await opts.ack()
      },
      onError: () => {},
    }

    const channel = new TapChannel(`ws://localhost:${port}`, handler, {})
    try {
      const outcome = await Promise.race([
        channel.start().then(() => 'finished' as const),
        new Promise<'hung'>((resolve) => setTimeout(() => resolve('hung'), 3000)),
      ])
      expect(outcome).toBe('finished')
      expect(acked).toEqual([7])
    } finally {
      await channel.destroy().catch(() => {})
      server.close()
    }
  }, 15000)
})
