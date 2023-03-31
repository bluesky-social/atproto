import * as http from 'http'
import { once } from 'events'
import { AddressInfo } from 'net'
import { WebSocket } from 'ws'
import { XRPCError } from '@atproto/xrpc'
import {
  ErrorFrame,
  Frame,
  MessageFrame,
  XrpcStreamServer,
  byFrame,
  byMessage,
} from '../src'

describe('Stream', () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms))
  it('streams message and info frames.', async () => {
    const httpServer = http.createServer()
    const server = new XrpcStreamServer({
      server: httpServer,
      handler: async function* () {
        await wait(1)
        yield new MessageFrame(1)
        await wait(1)
        yield new MessageFrame(2)
        await wait(1)
        yield new MessageFrame(3)
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
      new MessageFrame(1),
      new MessageFrame(2),
      new MessageFrame(3),
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
        yield new MessageFrame(1)
        await wait(1)
        yield new MessageFrame(2)
        await wait(1)
        yield new ErrorFrame({ error: 'BadOops' })
        proceededAfterError = true
        await wait(1)
        yield new MessageFrame(3)
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
      new MessageFrame(1),
      new MessageFrame(2),
      new ErrorFrame({ error: 'BadOops' }),
    ])

    httpServer.close()
  })

  it('kills handler and closes client disconnect.', async () => {
    const httpServer = http.createServer()
    let i = 1
    const server = new XrpcStreamServer({
      server: httpServer,
      handler: async function* () {
        while (true) {
          await wait(0)
          yield new MessageFrame(i++)
        }
      },
    })

    await once(httpServer.listen(), 'listening')
    const { port } = server.wss.address() as AddressInfo

    const ws = new WebSocket(`ws://localhost:${port}`)
    const frames: Frame[] = []
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
      if (frame.body === 3) ws.terminate()
    }

    // Grace period to let close take place on the server
    await wait(5)
    // Ensure handler hasn't kept running
    const currentCount = i
    await wait(5)
    expect(i).toBe(currentCount)

    httpServer.close()
  })

  describe('byMessage()', () => {
    it('kills handler and closes client disconnect on error frame.', async () => {
      const httpServer = http.createServer()
      const server = new XrpcStreamServer({
        server: httpServer,
        handler: async function* () {
          await wait(1)
          yield new MessageFrame(1)
          await wait(1)
          yield new MessageFrame(2)
          await wait(1)
          yield new ErrorFrame({
            error: 'BadOops',
            message: 'That was a bad one',
          })
          await wait(1)
          yield new MessageFrame(3)
          return
        },
      })
      await once(httpServer.listen(), 'listening')
      const { port } = server.wss.address() as AddressInfo

      const ws = new WebSocket(`ws://localhost:${port}`)
      const frames: Frame[] = []

      let error
      try {
        for await (const frame of byMessage(ws)) {
          frames.push(frame)
        }
      } catch (err) {
        error = err
      }

      expect(ws.readyState).toEqual(ws.CLOSING)
      expect(frames).toEqual([new MessageFrame(1), new MessageFrame(2)])
      expect(error).toBeInstanceOf(XRPCError)
      if (error instanceof XRPCError) {
        expect(error.error).toEqual('BadOops')
        expect(error.message).toEqual('That was a bad one')
      }

      httpServer.close()
    })
  })
})
