import getPort from 'get-port'
import { WebSocketServer } from 'ws'
import { wait } from '@atproto/common'
import { CloseCode, WebSocketKeepAlive } from '../src'

describe('WebSocketKeepAlive', () => {
  it('uses a heartbeat to reconnect if a connection is dropped', async () => {
    // we run a server that, on first connection, pauses for longer than the heartbeat interval (doesn't return "pong"s)
    // on second connection, it sends a message and then closes
    const port = await getPort()
    const server = new WebSocketServer({ port })
    let firstConnection = true
    let firstWasClosed = false
    server.on('connection', async (socket) => {
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
    server.close()
  })
})
