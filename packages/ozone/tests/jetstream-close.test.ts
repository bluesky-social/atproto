import type { AddressInfo } from 'node:net'
import { WebSocketServer } from 'ws'
import { Jetstream } from '../src/jetstream/service.js'

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
    await new Promise((r) => wss.once('listening', r))
    const { port } = wss.address() as AddressInfo

    let socketClosed = false
    wss.on('connection', (socket) => {
      socket.on('close', () => {
        socketClosed = true
      })
    })

    const jetstream = new Jetstream({ endpoint: `ws://localhost:${port}` })
    const running = jetstream.start({})
    // Wait for the connection to be established.
    await new Promise((r) => wss.once('connection', r))

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
    wss.close()
  }, 15000)
})
