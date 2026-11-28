import { getEventListeners } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createDeferrable } from '@atproto/common'
import { createSequencer, event } from './_stub-sequencer.test.js'
import { BackfillRateLimiter } from './backfill-rate-limiter.js'
import { Outbox } from './outbox.js'
import type { LabelsEvt } from './sequencer.js'

describe('outbox lifecycle', () => {
  it('bounds a paused consumer without interrupting another subscriber', async () => {
    const sequencer = createSequencer()
    const onOverflow = vi.fn()
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
    using request = vi
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
    using request = vi
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
    using request = vi
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
    using request = vi
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => {
        started.resolve()
        return query.complete
      })
    const onOverflow = vi.fn()
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
    using _request = vi
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
    using request = vi
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([event(1), event(2), event(3)])
    const onOverflow = vi.fn()
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
    using _request = vi
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(error)
    const outbox = new Outbox(sequencer)
    await expect(outbox.events(0).next()).rejects.toBe(error)
    expect(sequencer.listenerCount('events')).toBe(0)
    expect(outbox.cutoverBuffer).toHaveLength(0)
  })
})

describe('historical label replay budget', () => {
  it('shares the budget across fast subscribers and wakes cancelled waiters', async () => {
    const sequencer = createSequencer()
    sequencer.lastSeen = 10000
    using request = vi
      .spyOn(sequencer, 'requestLabelRange')
      .mockResolvedValue([event(1)])
    const backfillLimiter = new BackfillRateLimiter(500)
    const a = new AbortController()
    const b = new AbortController()
    const first = new Outbox(sequencer, { backfillLimiter }).events(0, a.signal)
    const second = new Outbox(sequencer, { backfillLimiter }).events(
      0,
      b.signal,
    )
    expect(await first.next()).toEqual({ done: false, value: event(1) })
    const nextPage = first.next()
    const otherSubscriber = second.next()
    try {
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(request).toHaveBeenCalledTimes(1)
      a.abort()
      b.abort()
      await expect(nextPage).resolves.toMatchObject({ done: true })
      await expect(otherSubscriber).resolves.toMatchObject({ done: true })
      expect(request).toHaveBeenCalledTimes(1)
      expect(sequencer.listenerCount('close')).toBe(0)
      expect(getEventListeners(a.signal, 'abort')).toHaveLength(0)
      expect(getEventListeners(b.signal, 'abort')).toHaveLength(0)
    } finally {
      a.abort()
      b.abort()
      await first.return(undefined)
      await second.return(undefined)
    }
  })

  it('delivers live events while historical replay waits for its budget', async () => {
    const sequencer = createSequencer()
    const backfillLimiter = new BackfillRateLimiter(500)
    const ac = new AbortController()
    await backfillLimiter.wait(ac.signal)
    const replay = new Outbox(sequencer, { backfillLimiter }).events(
      0,
      ac.signal,
    )
    const live = new Outbox(sequencer, { backfillLimiter }).events(
      undefined,
      ac.signal,
    )
    const waiting = replay.next()
    const nextLive = live.next()
    try {
      sequencer.emit('events', [event(1)])
      expect(await nextLive).toEqual({ done: false, value: event(1) })
      expect(sequencer.requestLabelRange).not.toHaveBeenCalled()
      sequencer.emit('close')
      await expect(waiting).resolves.toMatchObject({ done: true })
      expect(sequencer.listenerCount('close')).toBe(0)
    } finally {
      ac.abort()
      await replay.return(undefined)
      await live.return(undefined)
    }
  })
})
