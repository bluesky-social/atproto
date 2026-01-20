import { describe, expect, it } from 'vitest'
import { l } from '@atproto/lex'
import {
  CreateEvent,
  DeleteEvent,
  LexIndexer,
  UpdateEvent,
} from '../src/lex-indexer'
import { IdentityEvent, RecordEvent } from '../src/types'
import {
  createIdentityEvent,
  createMockOpts,
  createRecordEvent as baseCreateRecordEvent,
} from './_util'

// Test lexicon definitions
const postNsid = 'com.example.post'
type Post = {
  $type: 'com.example.post'
  text: string
}
const post = {
  main: l.record<'tid', Post>('tid', postNsid, l.object({ text: l.string() })),
}

const likeNsid = 'com.example.like'
type Like = {
  $type: 'com.example.like'
  subject: string
}
const like = {
  main: l.record<'tid', Like>(
    'tid',
    likeNsid,
    l.object({ subject: l.string() }),
  ),
}

const createRecordEvent = (overrides: Partial<RecordEvent> = {}): RecordEvent =>
  baseCreateRecordEvent({
    collection: postNsid,
    record: { $type: postNsid, text: 'hello' },
    ...overrides,
  })

describe('LexIndexer', () => {
  describe('handler registration', () => {
    it('registers create handler', async () => {
      const indexer = new LexIndexer()
      const received: CreateEvent<Post>[] = []

      indexer.create(post, async (evt) => {
        received.push(evt)
      })

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(received).toHaveLength(1)
      expect(received[0].action).toBe('create')
      expect(received[0].record.text).toBe('hello')
      expect(received[0].cid).toBe(
        'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq',
      )
    })

    it('registers update handler', async () => {
      const indexer = new LexIndexer()
      const received: UpdateEvent<Post>[] = []

      indexer.update(post, async (evt) => {
        received.push(evt)
      })

      const opts = createMockOpts()
      await indexer.onEvent(
        createRecordEvent({
          action: 'update',
          record: { $type: postNsid, text: 'updated' },
        }),
        opts,
      )

      expect(received).toHaveLength(1)
      expect(received[0].action).toBe('update')
      expect(received[0].record.text).toBe('updated')
    })

    it('registers delete handler', async () => {
      const indexer = new LexIndexer()
      const received: DeleteEvent[] = []

      indexer.delete(post, async (evt) => {
        received.push(evt)
      })

      const opts = createMockOpts()
      await indexer.onEvent(
        createRecordEvent({
          action: 'delete',
          record: undefined,
          cid: undefined,
        }),
        opts,
      )

      expect(received).toHaveLength(1)
      expect(received[0].action).toBe('delete')
    })

    it('registers put handler for both create and update', async () => {
      const indexer = new LexIndexer()
      const received: Array<{ action: string; text: string }> = []

      indexer.put(post, async (evt) => {
        received.push({ action: evt.action, text: evt.record.text })
      })

      const opts1 = createMockOpts()
      await indexer.onEvent(createRecordEvent({ action: 'create' }), opts1)

      const opts2 = createMockOpts()
      await indexer.onEvent(
        createRecordEvent({
          action: 'update',
          record: { $type: postNsid, text: 'updated' },
        }),
        opts2,
      )

      expect(received).toHaveLength(2)
      expect(received[0].action).toBe('create')
      expect(received[1].action).toBe('update')
    })
  })

  describe('handler routing', () => {
    it('routes to correct handler by collection', async () => {
      const indexer = new LexIndexer()
      const postEvents: CreateEvent<Post>[] = []
      const likeEvents: CreateEvent<Like>[] = []

      indexer.create(post, async (evt) => {
        postEvents.push(evt)
      })
      indexer.create(like, async (evt) => {
        likeEvents.push(evt)
      })

      const opts1 = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts1)

      const opts2 = createMockOpts()
      await indexer.onEvent(
        createRecordEvent({
          collection: likeNsid,
          record: { $type: likeNsid, subject: 'at://did:example:bob/post/123' },
        }),
        opts2,
      )

      expect(postEvents).toHaveLength(1)
      expect(likeEvents).toHaveLength(1)
    })

    it('routes to other handler for unregistered collections', async () => {
      const indexer = new LexIndexer()
      const otherEvents: RecordEvent[] = []

      indexer.create(post, async () => {})
      indexer.other(async (evt) => {
        otherEvents.push(evt)
      })

      const opts = createMockOpts()
      await indexer.onEvent(
        createRecordEvent({ collection: 'com.example.unknown' }),
        opts,
      )

      expect(otherEvents).toHaveLength(1)
      expect(otherEvents[0].collection).toBe('com.example.unknown')
    })

    it('routes to other handler for unregistered actions', async () => {
      const indexer = new LexIndexer()
      const otherEvents: RecordEvent[] = []

      indexer.create(post, async () => {})
      indexer.other(async (evt) => {
        otherEvents.push(evt)
      })

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent({ action: 'delete' }), opts)

      expect(otherEvents).toHaveLength(1)
      expect(otherEvents[0].action).toBe('delete')
    })

    it('routes identity events to identity handler', async () => {
      const indexer = new LexIndexer()
      const received: IdentityEvent[] = []

      indexer.identity(async (evt) => {
        received.push(evt)
      })

      const opts = createMockOpts()
      await indexer.onEvent(createIdentityEvent(), opts)

      expect(received).toHaveLength(1)
      expect(received[0].handle).toBe('alice.test')
    })
  })

  describe('duplicate registration', () => {
    it('throws on duplicate create handler', () => {
      const indexer = new LexIndexer()
      indexer.create(post, async () => {})

      expect(() => indexer.create(post, async () => {})).toThrow(
        'Handler already registered',
      )
    })

    it('throws on duplicate update handler', () => {
      const indexer = new LexIndexer()
      indexer.update(post, async () => {})

      expect(() => indexer.update(post, async () => {})).toThrow(
        'Handler already registered',
      )
    })

    it('throws on duplicate delete handler', () => {
      const indexer = new LexIndexer()
      indexer.delete(post, async () => {})

      expect(() => indexer.delete(post, async () => {})).toThrow(
        'Handler already registered',
      )
    })

    it('throws when put conflicts with create', () => {
      const indexer = new LexIndexer()
      indexer.create(post, async () => {})

      expect(() => indexer.put(post, async () => {})).toThrow(
        'Handler already registered',
      )
    })

    it('throws when create conflicts with put', () => {
      const indexer = new LexIndexer()
      indexer.put(post, async () => {})

      expect(() => indexer.create(post, async () => {})).toThrow(
        'Handler already registered',
      )
    })
  })

  describe('schema validation', () => {
    it('validates record on create', async () => {
      const indexer = new LexIndexer()
      indexer.create(post, async () => {})

      const opts = createMockOpts()
      await expect(
        indexer.onEvent(createRecordEvent({ record: { text: 123 } }), opts),
      ).rejects.toThrow('Record validation failed')
    })

    it('validates record on update', async () => {
      const indexer = new LexIndexer()
      indexer.update(post, async () => {})

      const opts = createMockOpts()
      await expect(
        indexer.onEvent(
          createRecordEvent({ action: 'update', record: { invalid: true } }),
          opts,
        ),
      ).rejects.toThrow('Record validation failed')
    })
  })

  describe('ack behavior', () => {
    it('calls ack after handler completes', async () => {
      const indexer = new LexIndexer()
      indexer.create(post, async () => {})

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(opts.acked).toBe(true)
    })

    it('calls ack when routed to other handler', async () => {
      const indexer = new LexIndexer()
      indexer.other(async () => {})

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(opts.acked).toBe(true)
    })

    it('calls ack even when no handler matches', async () => {
      const indexer = new LexIndexer()

      const opts = createMockOpts()
      await indexer.onEvent(createRecordEvent(), opts)

      expect(opts.acked).toBe(true)
    })
  })

  describe('error handling', () => {
    it('calls error handler when provided', () => {
      const indexer = new LexIndexer()
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
      const indexer = new LexIndexer()
      const testError = new Error('test error')

      expect(() => indexer.onError(testError)).toThrow('test error')
    })
  })
})
