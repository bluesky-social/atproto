import * as http from 'http'
import { once } from 'events'
import { AddressInfo } from 'net'
import { WebSocket } from 'ws'
import {
  ErrorFrame,
  Frame,
  InfoFrame,
  MessageFrame,
  XrpcStreamServer,
  byFrame,
} from '../src'

describe('Stream', () => {
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
        yield new InfoFrame({ body: { info: 'SomeDiagnostic' } }), await wait(1)
        yield new MessageFrame({ body: 3 })
        return
      },
    })

    await once(httpServer.listen(), 'listening')
    const { port } = server.wss.address() as AddressInfo

    const ws = new WebSocket(`ws://localhost:${port}`)
    const frames: Frame[] = []
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      new MessageFrame({ body: 1 }),
      new MessageFrame({ body: 2 }),
      new InfoFrame({ body: { info: 'SomeDiagnostic' } }),
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
        yield new ErrorFrame({ body: { error: 'BadOops' } })
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
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
    }

    await wait(5) // Ensure handler hasn't kept running
    expect(proceededAfterError).toEqual(false)

    expect(frames).toEqual([
      new MessageFrame({ body: 1 }),
      new MessageFrame({ body: 2 }),
      new ErrorFrame({ body: { error: 'BadOops' } }),
    ])

    httpServer.close()
  })
})
