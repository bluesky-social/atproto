import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { type WebSocket, WebSocketServer } from 'ws'
import { Jetstream } from './service.js'

describe('Jetstream.close()', () => {
  it('resolves only once the connection has actually closed', async () => {
    // The daemon does `await jetstream.close()` and then tears down its background
    // queue, so close() must not resolve while the stream is still running, or the
    // socket outlives what it depends on.
    //
    // Asserted on our own teardown, not the peer's acknowledgement: a client can't
    // wait on the peer without risking a hang, and `ws` fires its close event as
    // soon as the local socket is done.
    const wss = new WebSocketServer({ port: 0 })
    let jetstream: Jetstream | undefined
    try {
      await once(wss, 'listening')
      const { port } = wss.address() as AddressInfo

      const connection = once(wss, 'connection')
      jetstream = new Jetstream({ endpoint: `ws://localhost:${port}` })
      const running = jetstream.start({})
      const [socket] = (await connection) as [WebSocket]
      let socketClosed = false
      socket.on('close', () => {
        socketClosed = true
      })

      let finished = false
      void running.then(() => {
        finished = true
      })
      await jetstream.close()
      // The stream has unwound by the time close() resolves.
      expect(finished).toBe(true)

      await running
      // And the socket does close, shortly after.
      for (let i = 0; i < 50 && !socketClosed; i++) {
        await new Promise((r) => setTimeout(r, 20))
      }
      expect(socketClosed).toBe(true)
    } finally {
      await jetstream?.close()
      for (const client of wss.clients) client.terminate()
      await new Promise<void>((resolve, reject) =>
        wss.close((err) => (err ? reject(err) : resolve())),
      )
    }
  }, 15000)
})
