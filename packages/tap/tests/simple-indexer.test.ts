import { describe, expect, it } from 'vitest'
import { HandlerOpts } from '../src/channel'
import { SimpleIndexer } from '../src/simple-indexer'
import { IdentityEvent, RecordEvent } from '../src/types'
import { createIdentityEvent, createMockOpts, createRecordEvent } from './_util'

describe('SimpleIndexer', () => {
  describe('event routing', () => {
    it('routes record events to record handler', async () => {
      const indexer = new SimpleIndexer()
      const receivedEvents: RecordEvent[] = []

      indexer.record(async (evt) => {
        receivedEvents.push(evt)
      })

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(receivedEvents).toHaveLength(1)
      expect(receivedEvents[0].type).toBe('record')
      expect(receivedEvents[0].collection).toBe('com.example.post')
    })

    it('routes identity events to identity handler', async () => {
      const indexer = new SimpleIndexer()
      const receivedEvents: IdentityEvent[] = []

      indexer.identity(async (evt) => {
        receivedEvents.push(evt)
      })

      const opts = createMockOpts()
      await indexer.onEvent(createIdentityEvent(), opts)

      expect(receivedEvents).toHaveLength(1)
      expect(receivedEvents[0].type).toBe('identity')
      expect(receivedEvents[0].handle).toBe('alice.test')
    })

    it('does not call identity handler for record events', async () => {
      const indexer = new SimpleIndexer()
      let identityCalled = false
      let recordCalled = false

      indexer.identity(async () => {
        identityCalled = true
      })
      indexer.record(async () => {
        recordCalled = true
      })

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(recordCalled).toBe(true)
      expect(identityCalled).toBe(false)
    })

    it('does not call record handler for identity events', async () => {
      const indexer = new SimpleIndexer()
      let identityCalled = false
      let recordCalled = false

      indexer.identity(async () => {
        identityCalled = true
      })
      indexer.record(async () => {
        recordCalled = true
      })

      const opts = createMockOpts()
      await indexer.onEvent(createIdentityEvent(), opts)

      expect(identityCalled).toBe(true)
      expect(recordCalled).toBe(false)
    })
  })

  describe('ack behavior', () => {
    it('calls ack after handler completes', async () => {
      const indexer = new SimpleIndexer()
      indexer.record(async () => {})

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(opts.acked).toBe(true)
    })

    it('calls ack even when no handler is registered', async () => {
      const indexer = new SimpleIndexer()
      // No handlers registered

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(opts.acked).toBe(true)
    })
  })

  describe('error handling', () => {
    it('calls error handler when provided', () => {
      const indexer = new SimpleIndexer()
      const errors: Error[] = []

      indexer.error((err) => {
        errors.push(err)
      })

      const testError = new Error('test error')
      indexer.onError(testError)

      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe(testError)
    })

    it('throws when no error handler is registered', () => {
      const indexer = new SimpleIndexer()
      const testError = new Error('test error')

      expect(() => indexer.onError(testError)).toThrow('test error')
    })
  })

  describe('handler opts passthrough', () => {
    it('passes opts to record handler', async () => {
      const indexer = new SimpleIndexer()
      let receivedOpts: HandlerOpts | undefined

      indexer.record(async (_evt, opts) => {
        receivedOpts = opts
      })

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(receivedOpts).toBeDefined()
      expect(receivedOpts?.signal).toBe(opts.signal)
    })

    it('passes opts to identity handler', async () => {
      const indexer = new SimpleIndexer()
      let receivedOpts: HandlerOpts | undefined

      indexer.identity(async (_evt, opts) => {
        receivedOpts = opts
      })

      const opts = createMockOpts()
      await indexer.onEvent(createIdentityEvent(), opts)

      expect(receivedOpts).toBeDefined()
      expect(receivedOpts?.signal).toBe(opts.signal)
    })
  })
})
