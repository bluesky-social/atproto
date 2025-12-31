import { AddressInfo } from 'node:net'
import { scheduler } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Server, serve } from './nodejs.js'

describe('Node.js RequestListener', () => {
  let server: Server
  let address: string

  beforeAll(async () => {
    server = await serve(async (request) => {
      const { pathname } = new URL(request.url)
      if (pathname === '/hello') {
        return new Response('Hello, world!', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      } else if (pathname === '/throw') {
        throw new Error('Test error')
      } else if (pathname === '/echo') {
        return new Response(request.body, {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' },
        })
      }
      return new Response('Not Found', { status: 404 })
    })
    const { port } = server.address() as AddressInfo
    address = `http://localhost:${port}`
  })

  afterAll(async () => {
    await server.terminate()
  })

  it('should respond with Hello, world! on /hello', async () => {
    const res = await fetch(new URL(`/hello`, address))
    const text = await res.text()
    expect(res.status).toBe(200)
    expect(text).toBe('Hello, world!')
  })

  it('should respond with Not Found on unknown path', async () => {
    const res = await fetch(new URL(`/unknown`, address))
    const text = await res.text()
    expect(res.status).toBe(404)
    expect(text).toBe('Not Found')
  })

  it('should handle thrown errors and respond with 500', async () => {
    const res = await fetch(new URL(`/throw`, address))
    const text = await res.text()
    expect(res.status).toBe(500)
    expect(text).toBe('Internal Server Error')
  })

  it('should handle streaming bodies', async () => {
    const totalSize = 1024 * 1024
    const consumerSize = 42 * 1024

    let sentBytes = 0
    let receivedBytes = 0

    const res = await fetch(new URL(`/echo`, address), {
      method: 'POST',
      // @ts-expect-error
      duplex: 'half',
      body: new ReadableStream({
        async pull(controller) {
          const chunkSize = Math.min(1024, totalSize - sentBytes)
          controller.enqueue('A'.repeat(chunkSize))
          sentBytes += chunkSize
          await scheduler.wait(0) // Yield to event loop
          if (sentBytes === totalSize) controller.close()
        },
      }),
    })

    const reader = res.body!.getReader()

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await reader.read()
      if (result.done) break
      receivedBytes += Buffer.byteLength(result.value)
      if (receivedBytes >= consumerSize) {
        await reader.cancel()
        break
      }
    }

    expect(receivedBytes).toBeGreaterThanOrEqual(consumerSize)
    expect(sentBytes).toBeGreaterThanOrEqual(consumerSize)
    expect(sentBytes).toBeLessThan(totalSize)
  })

  it('should echo back request body on /echo', async () => {
    const body = `Echo this back`
    const res = await fetch(new URL(`/echo`, address), {
      method: 'POST',
      body,
    })
    const text = await res.text()
    expect(res.status).toBe(200)
    expect(text).toBe(body)
  })
})
