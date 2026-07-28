import { describe, expect, it, vi } from 'vitest'
import { WebSocketClientBase } from '../src/client.ts'
import { WebSocketClientError } from '../src/lib/errors.ts'
import type { Sender } from '../src/transport/transport.ts'
import type { WebSocketFn, WebSocketOptions } from '../src/websocket.ts'

// A hand-driven stand-in for websocket(): the test controls opens, messages,
// and the terminal.
function harness() {
  let options: WebSocketOptions<'auto'> = {}
  const queue: string[] = []
  let notify: (() => void) | undefined
  let ended = false
  const sent: string[] = []
  let sendImpl: (data: string) => Promise<void> = async (data) => {
    sent.push(data)
  }
  const sender: Sender<'auto'> = { send: (data) => sendImpl(data as string) }

  const websocketFn = ((_url: unknown, opts: WebSocketOptions<'auto'> = {}) => {
    options = opts
    return {
      async next(): Promise<IteratorResult<string, void>> {
        for (;;) {
          const value = queue.shift()
          if (value !== undefined) return { value, done: false }
          if (ended) return { value: undefined, done: true }
          await new Promise<void>((resolve) => (notify = resolve))
        }
      },
      async return(): Promise<IteratorResult<string, void>> {
        if (!ended) {
          ended = true
          options.onClose?.({ code: 1005, reason: '', wasClean: false })
        }
        notify?.()
        return { value: undefined, done: true }
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }) as unknown as WebSocketFn

  return {
    websocketFn,
    sent,
    setSendImpl: (impl: (data: string) => Promise<void>) => (sendImpl = impl),
    push: (m: string) => {
      queue.push(m)
      notify?.()
    },
    open: () => options.onOpen?.(sender),
    reconnect: () => options.onReconnect?.(sender),
    close: () => {
      ended = true
      notify?.()
      options.onClose?.({ code: 1000, reason: '', wasClean: true })
    },
  }
}

describe(WebSocketClientBase, () => {
  it('yields messages from the underlying generator', async () => {
    const h = harness()
    const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
    const iterator = client[Symbol.asyncIterator]()
    const pull = iterator.next()
    h.push('hello')
    expect(await pull).toEqual({ value: 'hello', done: false })
  })

  it('throws on a second iteration', () => {
    const h = harness()
    const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
    client[Symbol.asyncIterator]()
    expect(() => client[Symbol.asyncIterator]()).toThrow(WebSocketClientError)
  })

  it('forwards consumer hooks', () => {
    const h = harness()
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const client = new WebSocketClientBase(h.websocketFn, 'ws://x', {
      onOpen,
      onClose,
    })
    client[Symbol.asyncIterator]()
    h.open()
    h.close()
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('send', () => {
    it('sends immediately once connected', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      client[Symbol.asyncIterator]()
      h.open()
      expect(client.connected).toBe(true)
      await client.send('now')
      expect(h.sent).toEqual(['now'])
    })

    it('propagates a live send failure without queueing it', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      client[Symbol.asyncIterator]()
      h.open()
      const failure = new Error('socket gone')
      h.setSendImpl(async () => {
        throw failure
      })
      await expect(client.send('doomed')).rejects.toBe(failure)
      // Not queued: a later reconnect flushes nothing.
      h.setSendImpl(async (data) => {
        h.sent.push(data)
      })
      h.reconnect()
      expect(h.sent).toEqual([])
    })

    it('queues while disconnected and flushes on open, in order', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      client[Symbol.asyncIterator]()
      expect(client.connected).toBe(false)
      const first = client.send('a')
      const second = client.send('b')
      expect(h.sent).toEqual([])
      h.open()
      await Promise.all([first, second])
      expect(h.sent).toEqual(['a', 'b'])
    })

    it('flushes the queue on reconnect', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      client[Symbol.asyncIterator]()
      const pending = client.send('queued')
      h.reconnect()
      await pending
      expect(h.sent).toEqual(['queued'])
    })

    it('rejects a queued send whose flush fails, without re-queueing', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      client[Symbol.asyncIterator]()
      const failure = new Error('flush failed')
      h.setSendImpl(async () => {
        throw failure
      })
      const pending = client.send('doomed')
      h.open()
      await expect(pending).rejects.toBe(failure)
      h.setSendImpl(async (data) => {
        h.sent.push(data)
      })
      h.reconnect()
      expect(h.sent).toEqual([])
    })

    it('rejects past the queue limit', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x', {
        sendQueueLimit: 1,
      })
      client[Symbol.asyncIterator]()
      const queued = client.send('a')
      await expect(client.send('b')).rejects.toBeInstanceOf(
        WebSocketClientError,
      )
      void queued.catch(() => {})
    })

    it('rejects queued and subsequent sends when the stream ends', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      client[Symbol.asyncIterator]()
      const pending = client.send('never')
      h.close()
      await expect(pending).rejects.toBeInstanceOf(WebSocketClientError)
      await expect(client.send('after')).rejects.toBeInstanceOf(
        WebSocketClientError,
      )
    })

    it('supports a consumer retry loop for at-least-once delivery', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      client[Symbol.asyncIterator]()
      let attempts = 0
      h.setSendImpl(async (data) => {
        if (++attempts === 1) throw new Error('first flush fails')
        h.sent.push(data)
      })
      const delivered = (async () => {
        for (;;) {
          try {
            return await client.send('important')
          } catch {
            // Re-calling send() re-queues for the next connection.
          }
        }
      })()
      h.open() // first flush rejects
      h.reconnect() // retry lands
      await delivered
      expect(h.sent).toEqual(['important'])
    })
  })

  describe('disposal', () => {
    it('ends the stream and is idempotent', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      const iterator = client[Symbol.asyncIterator]()
      await client[Symbol.asyncDispose]()
      await client[Symbol.asyncDispose]()
      expect(await iterator.next()).toEqual({ value: undefined, done: true })
      await expect(client.send('after')).rejects.toBeInstanceOf(
        WebSocketClientError,
      )
    })

    it('is a no-op on a never-iterated client', async () => {
      const h = harness()
      const client = new WebSocketClientBase(h.websocketFn, 'ws://x')
      await expect(client[Symbol.asyncDispose]()).resolves.toBeUndefined()
    })

    it('works with `await using`', async () => {
      const h = harness()
      {
        await using client = new WebSocketClientBase(h.websocketFn, 'ws://x')
        client[Symbol.asyncIterator]()
        h.open()
        await client.send('a')
      }
      expect(h.sent).toEqual(['a'])
    })
  })
})
