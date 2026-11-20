import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { scheduler } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Server, serve } from './nodejs.js'

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

describe('request.signal', () => {
  const urlOf = (server: Server) =>
    `http://localhost:${(server.address() as AddressInfo).port}`

  it('is not aborted once the request body has been read', async () => {
    await using server = await serve(async (request) => {
      const before = request.signal.aborted
      await request.text()
      await scheduler.wait(0) // Let the request's "end" and "close" events fire
      return Response.json({ before, after: request.signal.aborted })
    })

    const res = await fetch(urlOf(server), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    expect(await res.json()).toEqual({ before: false, after: false })
  })

  it('is not aborted after the response has been sent', async () => {
    let signal: AbortSignal | undefined
    await using server = await serve(async (request) => {
      signal = request.signal
      return new Response('ok')
    })

    const res = await fetch(urlOf(server))
    expect(await res.text()).toBe('ok')
    await scheduler.wait(0) // Let the response's "finish" and "close" events fire

    expect(signal?.aborted).toBe(false)
  })

  it('is aborted when the client disconnects before the response is sent', async () => {
    let resolveBodyRead!: (aborted: boolean) => void
    const bodyRead = new Promise<boolean>((resolve) => {
      resolveBodyRead = resolve
    })
    let resolveAborted!: () => void
    const aborted = new Promise<void>((resolve) => {
      resolveAborted = resolve
    })

    await using server = await serve(async (request) => {
      await request.text()
      resolveBodyRead(request.signal.aborted)
      if (!request.signal.aborted) await once(request.signal, 'abort')
      resolveAborted()
      return new Response(null, { status: 204 })
    })

    const controller = new AbortController()
    const res = fetch(urlOf(server), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    })

    // Still live once the body has been read...
    expect(await bodyRead).toBe(false)

    // ...but aborted as soon as the client goes away
    controller.abort()
    await expect(res).rejects.toThrow()
    await aborted
  })

  it('is aborted with the body read error when the client disconnects mid-upload', async () => {
    let resolveStarted!: () => void
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve
    })
    type Result = { aborted: boolean; isReason: boolean }
    let resolveResult!: (result: Result) => void
    const result = new Promise<Result>((resolve) => {
      resolveResult = resolve
    })

    await using server = await serve(async (request) => {
      resolveStarted()
      try {
        await request.text()
      } catch (err) {
        // LexRouter relies on this to answer 499 instead of reporting an error
        resolveResult({
          aborted: request.signal.aborted,
          isReason: err === request.signal.reason,
        })
      }
      return new Response(null, { status: 204 })
    })

    const abortController = new AbortController()
    const res = fetch(urlOf(server), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      signal: abortController.signal,
      // @ts-expect-error
      duplex: 'half',
      body: new ReadableStream({
        async pull(controller) {
          controller.enqueue(new Uint8Array(1024))
          await scheduler.wait(10)
        },
      }),
    })

    await started
    abortController.abort()
    await expect(res).rejects.toThrow()

    expect(await result).toEqual({ aborted: true, isReason: true })
  })
})
