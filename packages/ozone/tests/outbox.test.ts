import EventEmitter, { getEventListeners, once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { jest } from '@jest/globals'
import express from 'express'
import { WebSocket } from 'ws'
import { createDeferrable } from '@atproto/common'
import { Frame, Server } from '@atproto/xrpc-server'
import subscribeLabels from '../src/api/label/subscribeLabels.js'
import type { AppContext } from '../src/context.js'
import { com } from '../src/lexicons/index.js'
import { Outbox } from '../src/sequencer/outbox.js'
import type { LabelsEvt, Sequencer } from '../src/sequencer/sequencer.js'

function createSequencer() {
  const sequencer = new EventEmitter() as Sequencer
  sequencer.lastSeen = 0
  sequencer.destroyed = false
  sequencer.requestLabelRange = jest
    .fn<Sequencer['requestLabelRange']>()
    .mockResolvedValue([])
  return sequencer
}

function event(seq: number): LabelsEvt {
  return { seq, labels: [] }
}

describe('outbox lifecycle', () => {
  it('bounds a paused consumer without interrupting another subscriber', async () => {
    const sequencer = createSequencer()
    const onOverflow = jest.fn()
    const slow = new Outbox(sequencer, { maxBufferSize: 2, onOverflow })
    const healthy = new Outbox(sequencer, { maxBufferSize: 2 })
    const slowStream = slow.events()
    const healthyStream = healthy.events()
    const firstSlow = slowStream.next()
    const firstHealthy = healthyStream.next()
    sequencer.emit('events', [event(1)])
    await Promise.all([firstSlow, firstHealthy])

    try {
      for (let seq = 2; seq <= 10; seq++) {
        const next = healthyStream.next()
        expect(() => sequencer.emit('events', [event(seq)])).not.toThrow()
        expect(await next).toEqual({ done: false, value: event(seq) })
        expect(slow.outBuffer.size).toBeLessThanOrEqual(2)
      }
      expect(onOverflow).toHaveBeenCalledTimes(1)
      expect(sequencer.listenerCount('events')).toBe(1)
      expect(slow.outBuffer.size).toBe(0)
      await expect(slowStream.next()).rejects.toThrow(
        'Stream consumer too slow',
      )
    } finally {
      await slowStream.return(undefined)
      await healthyStream.return(undefined)
    }
    expect(sequencer.listenerCount('events')).toBe(0)
  })

  it('clears queued events and wakes an idle reader on abort', async () => {
    const sequencer = createSequencer()
    const ac = new AbortController()
    const outbox = new Outbox(sequencer)
    const stream = outbox.events(undefined, ac.signal)
    const next = stream.next()
    ac.abort()
    await expect(next).resolves.toMatchObject({ done: true })
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0)
    sequencer.emit('events', [event(1)])
    expect(outbox.outBuffer.size).toBe(0)
  })

  it('cleans up when a consumer returns while events remain queued', async () => {
    const sequencer = createSequencer()
    const ac = new AbortController()
    const outbox = new Outbox(sequencer)
    const stream = outbox.events(undefined, ac.signal)
    const next = stream.next()
    sequencer.emit('events', [event(1), event(2)])
    await next
    await stream.return(undefined)
    expect(outbox.outBuffer.size).toBe(0)
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0)
  })

  it('does not query or subscribe with an already aborted signal', async () => {
    const sequencer = createSequencer()
    const outbox = new Outbox(sequencer)
    const stream = outbox.events(0, AbortSignal.abort())
    await expect(stream.next()).resolves.toMatchObject({ done: true })
    expect(sequencer.requestLabelRange).not.toHaveBeenCalled()
    expect(sequencer.listenerCount('events')).toBe(0)
  })

  it('ends an idle stream when the sequencer closes', async () => {
    const sequencer = createSequencer()
    const outbox = new Outbox(sequencer)
    const next = outbox.events().next()
    sequencer.emit('close')
    await expect(next).resolves.toMatchObject({ done: true })
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(sequencer.listenerCount('close')).toBe(0)
  })

  it.each([undefined, 0])(
    'does not query or subscribe to a destroyed sequencer with cursor %s',
    async (cursor) => {
      const sequencer = createSequencer()
      sequencer.destroyed = true
      const outbox = new Outbox(sequencer)
      await expect(outbox.events(cursor).next()).resolves.toMatchObject({
        done: true,
      })
      expect(sequencer.requestLabelRange).not.toHaveBeenCalled()
      expect(sequencer.listenerCount('events')).toBe(0)
      expect(sequencer.listenerCount('close')).toBe(0)
    },
  )

  it('stops backfill when the sequencer closes during a query', async () => {
    const sequencer = createSequencer()
    const query = createDeferrable<LabelsEvt[]>()
    using request = jest
      .spyOn(sequencer, 'requestLabelRange')
      .mockReturnValueOnce(query.complete)
    const ac = new AbortController()
    const outbox = new Outbox(sequencer)
    const stream = outbox.events(0, ac.signal)
    const next = stream.next()
    sequencer.destroyed = true
    sequencer.emit('close')
    query.resolve([event(1)])
    try {
      await expect(next).resolves.toMatchObject({ done: true })
      expect(request).toHaveBeenCalledTimes(1)
      expect(sequencer.listenerCount('events')).toBe(0)
      expect(sequencer.listenerCount('close')).toBe(0)
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0)
    } finally {
      await stream.return(undefined)
    }
  })

  it('does not start cutover while sequencer shutdown is waiting to close', async () => {
    const sequencer = createSequencer()
    const query = createDeferrable<LabelsEvt[]>()
    using request = jest
      .spyOn(sequencer, 'requestLabelRange')
      .mockReturnValueOnce(query.complete)
    const ac = new AbortController()
    const outbox = new Outbox(sequencer)
    const stream = outbox.events(0, ac.signal)
    const next = stream.next()
    // @NOTE destroy() marks the sequencer before waiting for its poll to finish.
    sequencer.destroyed = true
    query.resolve([])
    try {
      await new Promise((resolve) => setImmediate(resolve))
      expect(request).toHaveBeenCalledTimes(1)
      await expect(next).resolves.toMatchObject({ done: true })
      expect(sequencer.listenerCount('events')).toBe(0)
      expect(sequencer.listenerCount('close')).toBe(0)
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0)
    } finally {
      ac.abort()
      await stream.return(undefined)
    }
  })

  it('does not fetch another backfill page after cancellation', async () => {
    const sequencer = createSequencer()
    sequencer.lastSeen = 1000
    using request = jest
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValueOnce([event(1)])
    const ac = new AbortController()
    const outbox = new Outbox(sequencer)
    const stream = outbox.events(0, ac.signal)
    expect(await stream.next()).toEqual({ done: false, value: event(1) })
    ac.abort()
    await expect(stream.next()).resolves.toMatchObject({ done: true })
    expect(request).toHaveBeenCalledTimes(1)
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0)
  })

  it('bounds cutover buffering and ignores a query that completes after overflow', async () => {
    const sequencer = createSequencer()
    const started = createDeferrable()
    const query = createDeferrable<LabelsEvt[]>()
    using request = jest
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => {
        started.resolve()
        return query.complete
      })
    const onOverflow = jest.fn()
    const outbox = new Outbox(sequencer, { maxBufferSize: 2, onOverflow })
    const stream = outbox.events(0)
    const next = expect(stream.next()).rejects.toThrow(
      'Stream consumer too slow',
    )
    await started.complete
    sequencer.emit('events', [event(1), event(2)])
    expect(outbox.cutoverBuffer).toHaveLength(2)
    sequencer.emit('events', [event(3)])
    expect(onOverflow).toHaveBeenCalledTimes(1)
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(outbox.cutoverBuffer).toHaveLength(0)
    query.resolve([event(1), event(2)])
    await next
    expect(outbox.outBuffer.size).toBe(0)
    expect(request).toHaveBeenLastCalledWith({ earliestId: 0, limit: 3 })
  })

  it('deduplicates overlapping cutover events before enforcing the limit', async () => {
    const sequencer = createSequencer()
    const started = createDeferrable()
    const query = createDeferrable<LabelsEvt[]>()
    using _request = jest
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => {
        started.resolve()
        return query.complete
      })
    const outbox = new Outbox(sequencer, { maxBufferSize: 2 })
    const stream = outbox.events(0)
    const next = stream.next()
    await started.complete
    sequencer.emit('events', [event(1), event(2)])
    query.resolve([event(1), event(2)])
    try {
      expect(await next).toEqual({ done: false, value: event(1) })
      expect(await stream.next()).toEqual({ done: false, value: event(2) })
    } finally {
      await stream.return(undefined)
    }
  })

  it('rejects a cutover query that exceeds the limit', async () => {
    const sequencer = createSequencer()
    using request = jest
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([event(1), event(2), event(3)])
    const onOverflow = jest.fn()
    const outbox = new Outbox(sequencer, { maxBufferSize: 2, onOverflow })
    await expect(outbox.events(0).next()).rejects.toThrow(
      'Stream consumer too slow',
    )
    expect(onOverflow).toHaveBeenCalledTimes(1)
    expect(outbox.outBuffer.size).toBe(0)
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(request).toHaveBeenLastCalledWith({ earliestId: 0, limit: 3 })
  })

  it('propagates cutover query failures and removes the listener', async () => {
    const sequencer = createSequencer()
    const error = new Error('query failed')
    using _request = jest
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(error)
    const outbox = new Outbox(sequencer)
    await expect(outbox.events(0).next()).rejects.toBe(error)
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(outbox.cutoverBuffer).toHaveLength(0)
  })
})

it('disconnects a stalled label socket before its send callback completes', async () => {
  const sequencer = createSequencer()
  const server = new Server()
  subscribeLabels(server, { sequencer } as AppContext)
  const app = express()
  app.use(server.router)
  await using httpServer = app.listen(0)
  await once(httpServer, 'listening')
  const { port } = httpServer.address() as AddressInfo
  const nsid = com.atproto.label.subscribeLabels.$lxm
  const { wss } = server.subscriptions.get(nsid)!
  const url = `ws://127.0.0.1:${port}/xrpc/${nsid}`
  const connected = once(wss, 'connection')
  const slow = new WebSocket(url)
  await once(slow, 'open')
  const [socket] = (await connected) as [WebSocket]
  const healthy = new WebSocket(url)
  await once(healthy, 'open')
  const sending = createDeferrable()
  let pendingSend: ((error?: Error) => void) | undefined
  using send = jest
    .spyOn(socket, 'send')
    .mockImplementation((_data, _opts, cb) => {
      pendingSend = cb
      sending.resolve()
    })
  const disconnected = once(slow, 'close')
  try {
    for (let seq = 1; seq <= 502; seq++) {
      const received = once(healthy, 'message')
      sequencer.emit('events', [event(seq)])
      const [bytes] = await received
      expect(Frame.fromBytes(bytes).body).toEqual(event(seq))
      if (seq === 1) await sending.complete
    }
    expect(send).toHaveBeenCalledTimes(1)
    expect(pendingSend).toBeDefined()
    expect(sequencer.listenerCount('events')).toBe(1)
    await disconnected
    expect(slow.readyState).toBe(WebSocket.CLOSED)
    expect(healthy.readyState).toBe(WebSocket.OPEN)
  } finally {
    pendingSend?.(new Error('socket closed'))
    slow.terminate()
    healthy.terminate()
    for (const client of wss.clients) client.terminate()
    await new Promise<void>((resolve) => wss.close(() => resolve()))
  }
  expect(sequencer.listenerCount('events')).toBe(0)
})

it.each(['live', 'backfill'])(
  'times out a stalled %s send while healthy subscribers remain connected',
  async (phase) => {
    const sequencer = createSequencer()
    sequencer.curr = jest.fn<Sequencer['curr']>().mockResolvedValue(1)
    const backfill = createDeferrable<LabelsEvt[]>()
    using request = jest
      .spyOn(sequencer, 'requestLabelRange')
      .mockReturnValueOnce(backfill.complete)
    const server = new Server()
    subscribeLabels(server, { sequencer } as AppContext)
    const app = express()
    app.use(server.router)
    await using httpServer = app.listen(0)
    await once(httpServer, 'listening')
    const { port } = httpServer.address() as AddressInfo
    const nsid = com.atproto.label.subscribeLabels.$lxm
    const { wss } = server.subscriptions.get(nsid)!
    const url = `ws://127.0.0.1:${port}/xrpc/${nsid}`
    const connected = once(wss, 'connection')
    const slow = new WebSocket(phase === 'backfill' ? `${url}?cursor=0` : url)
    await once(slow, 'open')
    const [socket] = (await connected) as [WebSocket]
    const healthy = new WebSocket(url)
    await once(healthy, 'open')
    const sending = createDeferrable()
    let pendingSend: ((error?: Error) => void) | undefined
    using send = jest
      .spyOn(socket, 'send')
      .mockImplementation((_data, _opts, cb) => {
        pendingSend = cb
        sending.resolve()
      })
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    try {
      await jest.advanceTimersByTimeAsync(60_000)
      expect(slow.readyState).toBe(WebSocket.OPEN)
      expect(healthy.readyState).toBe(WebSocket.OPEN)

      if (phase === 'backfill') {
        backfill.resolve([event(1)])
      } else {
        const received = once(healthy, 'message')
        sequencer.emit('events', [event(1)])
        await received
      }
      await sending.complete
      const disconnected = once(slow, 'close')
      await jest.advanceTimersByTimeAsync(29_999)
      expect(slow.readyState).toBe(WebSocket.OPEN)
      await jest.advanceTimersByTimeAsync(1)
      await disconnected
      expect(send).toHaveBeenCalledTimes(1)
      expect(healthy.readyState).toBe(WebSocket.OPEN)
      expect(sequencer.listenerCount('events')).toBe(1)
      expect(request).toHaveBeenCalledTimes(phase === 'backfill' ? 1 : 0)

      const received = once(healthy, 'message')
      sequencer.emit('events', [event(2)])
      const [bytes] = await received
      expect(Frame.fromBytes(bytes).body).toEqual(event(2))
      await jest.advanceTimersByTimeAsync(60_000)
      expect(healthy.readyState).toBe(WebSocket.OPEN)
      expect(jest.getTimerCount()).toBe(0)
    } finally {
      pendingSend?.(new Error('socket closed'))
      jest.useRealTimers()
      slow.terminate()
      healthy.terminate()
      for (const client of wss.clients) client.terminate()
      await new Promise<void>((resolve) => wss.close(() => resolve()))
    }
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(sequencer.listenerCount('close')).toBe(0)
  },
)
