import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { WebSocketServer } from 'ws'
import { wait } from '@atproto/common'
import { CloseCode, WebSocketKeepAlive } from '../src/index.js'

describe('WebSocketKeepAlive', () => {
  it('uses a heartbeat to reconnect if a connection is dropped', async () => {
    // we run a server that, on first connection, pauses for longer than the heartbeat interval (doesn't return "pong"s)
    // on second connection, it sends a message and then closes

    const server = createServer()

    // make sure to always close the server (even in case of test failure)
    const { terminate } = httpTerminator.createHttpTerminator({ server })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    const wsServer = new WebSocketServer({ server })
    let firstConnection = true
    let firstWasClosed = false
    wsServer.on('connection', async (socket) => {
      if (firstConnection === true) {
        firstConnection = false
        socket.pause()
        await wait(600)
        // shouldn't send this message because the socket would be closed
        socket.send(Buffer.from('error message'), (err) => {
          if (err) throw err
          socket.close(CloseCode.Normal)
        })
        socket.on('close', () => {
          firstWasClosed = true
        })
      } else {
        socket.send(Buffer.from('test message'), (err) => {
          if (err) throw err
          socket.close(CloseCode.Normal)
        })
      }
    })

    await once(server.listen(0), 'listening')
    const port = (server.address() as AddressInfo).port

    const wsKeepAlive = new WebSocketKeepAlive({
      getUrl: async () => `ws://localhost:${port}`,
      heartbeatIntervalMs: 500,
    })

    const messages: Uint8Array[] = []
    for await (const msg of wsKeepAlive) {
      messages.push(msg)
    }

    expect(messages).toHaveLength(1)
    expect(Buffer.from(messages[0]).toString()).toBe('test message')
    expect(firstWasClosed).toBe(true)
  })
})
