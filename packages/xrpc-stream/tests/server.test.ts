import * as http from 'http'
import { once } from 'events'
import { AddressInfo } from 'net'
import { createWebSocketStream, WebSocket } from 'ws'
import {
  ErrorFrame,
  Frame,
  InfoFrame,
  MessageFrame,
  XrpcStreamServer,
} from '../src'

describe('Server', () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms))
  it('streams message and info frames.', async () => {
    const httpServer = http.createServer()
    const server = new XrpcStreamServer({
      server: httpServer,
      handler: async function* () {
        await wait(1)
        yield new MessageFrame({ body: 1 })
        await wait(1)
        yield new MessageFrame({ body: 2 })
        await wait(1)
        yield new InfoFrame({ body: 'diagnostic info' })
        await wait(1)
        yield new MessageFrame({ body: 3 })
        return
      },
    })

    await once(httpServer.listen(), 'listening')
    const { port } = server.wss.address() as AddressInfo

    const ws = new WebSocket(`ws://localhost:${port}`)
    const frames: Frame[] = []
    for await (const bytes of createWebSocketStream(ws)) {
      frames.push(Frame.fromBytes(bytes))
    }

    expect(frames).toEqual([
      new MessageFrame({ body: 1 }),
      new MessageFrame({ body: 2 }),
      new InfoFrame({ body: 'diagnostic info' }),
      new MessageFrame({ body: 3 }),
    ])

    httpServer.close()
  })

  it('kills handler and closes on error frame.', async () => {
    let proceededAfterError = false
    const httpServer = http.createServer()
    const server = new XrpcStreamServer({
      server: httpServer,
      handler: async function* () {
        await wait(1)
        yield new MessageFrame({ body: 1 })
        await wait(1)
        yield new MessageFrame({ body: 2 })
        await wait(1)
        yield new ErrorFrame({ code: 'BadOops' })
        proceededAfterError = true
        await wait(1)
        yield new MessageFrame({ body: 3 })
        return
      },
    })

    await once(httpServer.listen(), 'listening')
    const { port } = server.wss.address() as AddressInfo

    const ws = new WebSocket(`ws://localhost:${port}`)
    const frames: Frame[] = []
    for await (const bytes of createWebSocketStream(ws)) {
      frames.push(Frame.fromBytes(bytes))
    }

    await wait(5) // Ensure handler hasn't kept running
    expect(proceededAfterError).toEqual(false)

    expect(frames).toEqual([
      new MessageFrame({ body: 1 }),
      new MessageFrame({ body: 2 }),
      new ErrorFrame({ code: 'BadOops' }),
    ])

    httpServer.close()
  })
})
