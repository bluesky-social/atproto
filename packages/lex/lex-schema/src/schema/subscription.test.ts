import { describe, expect, it } from 'vitest'
import { asNsidString } from '../core.js'
import { IntegerSchema } from './integer.js'
import { ObjectSchema } from './object.js'
import { OptionalSchema } from './optional.js'
import { ParamsSchema } from './params.js'
import { RefSchema } from './ref.js'
import { StringSchema } from './string.js'
import {
  InferSubscriptionMessage,
  InferSubscriptionParameters,
  Subscription,
} from './subscription.js'

describe('Subscription', () => {
  describe('constructor', () => {
    it('creates a Subscription instance with all parameters', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({
        cursor: new OptionalSchema(new IntegerSchema({})),
      })
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
        data: new StringSchema({}),
      })
      const errors = ['ConsumerTooSlow', 'FutureCursor'] as const

      const subscription = new Subscription(nsid, parameters, message, errors)

      expect(subscription).toBeInstanceOf(Subscription)
      expect(subscription.nsid).toBe(nsid)
      expect(subscription.parameters).toBe(parameters)
      expect(subscription.message).toBe(message)
      expect(subscription.errors).toBe(errors)
    })

    it('creates a Subscription instance without errors', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({
        cursor: new OptionalSchema(new IntegerSchema({})),
      })
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription).toBeInstanceOf(Subscription)
      expect(subscription.nsid).toBe(nsid)
      expect(subscription.parameters).toBe(parameters)
      expect(subscription.message).toBe(message)
      expect(subscription.errors).toBeUndefined()
    })

    it('creates a Subscription instance with empty parameters', () => {
      const nsid = asNsidString('app.bsky.notification.subscribe')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        type: new StringSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription).toBeInstanceOf(Subscription)
      expect(subscription.parameters).toBe(parameters)
    })
  })

  describe('type property', () => {
    it('has type set to "subscription"', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.type).toBe('subscription')
    })

    it('type is a constant value', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.type).toBe('subscription')
      // TypeScript enforces readonly at compile time
      expect(typeof subscription.type).toBe('string')
    })
  })

  describe('properties', () => {
    it('has nsid property', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.nsid).toBe(nsid)
      expect(typeof subscription.nsid).toBe('string')
    })

    it('has parameters property', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.parameters).toBe(parameters)
      expect(subscription.parameters).toBeInstanceOf(ParamsSchema)
    })

    it('has message property', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.message).toBe(message)
      expect(subscription.message).toBeInstanceOf(ObjectSchema)
    })

    it('has errors property', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
      })
      const errors = ['ConsumerTooSlow'] as const

      const subscription = new Subscription(nsid, parameters, message, errors)

      expect(subscription.errors).toBe(errors)
      expect(Array.isArray(subscription.errors)).toBe(true)
    })
  })

  describe('with complex parameters', () => {
    it('creates a Subscription with multiple parameter types', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({
        cursor: new OptionalSchema(new IntegerSchema({ minimum: 0 })),
        includeDeletes: new OptionalSchema(
          new IntegerSchema({ minimum: 0, maximum: 1 }),
        ),
      })
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
        data: new StringSchema({}),
      })
      const errors = ['ConsumerTooSlow', 'FutureCursor'] as const

      const subscription = new Subscription(nsid, parameters, message, errors)

      expect(subscription).toBeInstanceOf(Subscription)
      expect(subscription.parameters).toBe(parameters)
      expect(subscription.errors).toEqual(['ConsumerTooSlow', 'FutureCursor'])
    })
  })

  describe('with various message types', () => {
    it('creates a Subscription with ObjectSchema message', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
        data: new StringSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription).toBeInstanceOf(Subscription)
      expect(subscription.message).toBeInstanceOf(ObjectSchema)
    })

    it('creates a Subscription with RefSchema message', () => {
      const nsid = asNsidString('app.bsky.feed.subscribe')
      const parameters = new ParamsSchema({})
      const message = new RefSchema(() => new StringSchema({}))

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription).toBeInstanceOf(Subscription)
      expect(subscription.message).toBeInstanceOf(RefSchema)
    })
  })

  describe('with different error configurations', () => {
    it('creates a Subscription with a single error', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({})
      const errors = ['ConsumerTooSlow'] as const

      const subscription = new Subscription(nsid, parameters, message, errors)

      expect(subscription.errors).toEqual(['ConsumerTooSlow'])
    })

    it('creates a Subscription with multiple errors', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({})
      const errors = [
        'ConsumerTooSlow',
        'FutureCursor',
        'InvalidCursor',
      ] as const

      const subscription = new Subscription(nsid, parameters, message, errors)

      expect(subscription.errors).toEqual([
        'ConsumerTooSlow',
        'FutureCursor',
        'InvalidCursor',
      ])
    })

    it('creates a Subscription with empty errors array', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({})
      const errors = [] as const

      const subscription = new Subscription(nsid, parameters, message, errors)

      expect(subscription.errors).toEqual([])
    })
  })

  describe('type inference', () => {
    it('InferSubscriptionParameters correctly infers parameter types', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({
        cursor: new OptionalSchema(new IntegerSchema({})),
      })
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      type Params = InferSubscriptionParameters<typeof subscription>

      // Type-level test - this should compile without errors
      const params: Params = {
        cursor: 12345,
      }

      expect(params.cursor).toBeDefined()
    })

    it('InferSubscriptionMessage correctly infers message type', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
        data: new StringSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      type Message = InferSubscriptionMessage<typeof subscription>

      // Type-level test - this should compile without errors
      const msg: Message = {
        seq: 12345,
        data: 'test data',
      }

      expect(msg.seq).toBeDefined()
      expect(msg.data).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('handles very long NSID', () => {
      const nsid = asNsidString(
        'com.example.very.long.namespace.identifier.subscription.name',
      )
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({})

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.nsid).toBe(nsid)
    })

    it('handles subscription with all optional parameters', () => {
      const nsid = asNsidString('app.bsky.feed.subscribe')
      const parameters = new ParamsSchema({
        cursor: new OptionalSchema(new IntegerSchema({})),
        includeDeletes: new OptionalSchema(new IntegerSchema({})),
        includeEdits: new OptionalSchema(new IntegerSchema({})),
      })
      const message = new ObjectSchema({})

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.parameters).toBe(parameters)
    })

    it('handles subscription with complex nested message schema', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
        blocks: new ObjectSchema({
          cid: new StringSchema({ format: 'cid' }),
          data: new ObjectSchema({
            uri: new StringSchema({ format: 'at-uri' }),
            content: new StringSchema({}),
          }),
        }),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.message).toBeInstanceOf(ObjectSchema)
    })
  })

  describe('real-world subscription examples', () => {
    it('creates a subscribeLabels subscription', () => {
      const nsid = asNsidString('com.atproto.label.subscribeLabels')
      const parameters = new ParamsSchema({
        cursor: new OptionalSchema(new IntegerSchema({ minimum: 0 })),
      })
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
        labels: new ObjectSchema({
          uri: new StringSchema({ format: 'uri' }),
          val: new StringSchema({}),
        }),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.type).toBe('subscription')
      expect(subscription.nsid).toBe('com.atproto.label.subscribeLabels')
      expect(subscription.parameters.matches({ cursor: 10 })).toBe(true)
      expect(subscription.parameters.matches({ cursor: -10 })).toBe(false)
      expect(
        subscription.message.matches({
          seq: 1,
          labels: { uri: 'http://foo.com', val: 'test' },
        }),
      ).toBe(true)
      expect(
        subscription.message.matches({
          seq: 1,
          labels: { uri: 'http://foo.com', val: 3 },
        }),
      ).toBe(false)
    })

    it('creates a notification subscription', () => {
      const nsid = asNsidString('app.bsky.notification.subscribe')
      const parameters = new ParamsSchema({
        cursor: new OptionalSchema(new StringSchema({})),
      })
      const message = new ObjectSchema({
        type: new StringSchema({}),
        uri: new StringSchema({ format: 'at-uri' }),
        cid: new StringSchema({ format: 'cid' }),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.type).toBe('subscription')
      expect(subscription.nsid).toBe('app.bsky.notification.subscribe')
    })
  })

  describe('with mixed parameter and message types', () => {
    it('handles required and optional parameters with complex message', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({
        cursor: new OptionalSchema(new IntegerSchema({ minimum: 0 })),
        includeDeletes: new OptionalSchema(
          new IntegerSchema({ minimum: 0, maximum: 1 }),
        ),
      })
      const message = new ObjectSchema({
        seq: new IntegerSchema({}),
        rebase: new OptionalSchema(
          new IntegerSchema({ minimum: 0, maximum: 1 }),
        ),
        tooBig: new OptionalSchema(
          new IntegerSchema({ minimum: 0, maximum: 1 }),
        ),
        repo: new StringSchema({ format: 'did' }),
        commit: new StringSchema({ format: 'cid' }),
        blocks: new StringSchema({}),
        ops: new ObjectSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.type).toBe('subscription')
      expect(subscription.parameters).toBe(parameters)
      expect(subscription.message).toBe(message)
    })
  })

  describe('validation through nested schemas', () => {
    it('parameters can validate input through ParamsSchema', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({
        cursor: new IntegerSchema({ minimum: 0 }),
      })
      const message = new ObjectSchema({})

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      // Test that the parameters schema can validate
      const validResult = subscription.parameters.safeParse({ cursor: 100 })
      expect(validResult.success).toBe(true)

      const invalidResult = subscription.parameters.safeParse({ cursor: -1 })
      expect(invalidResult.success).toBe(false)
    })

    it('message can validate input through ObjectSchema', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        seq: new IntegerSchema({ minimum: 0 }),
        data: new StringSchema({ minLength: 1 }),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      // Test that the message schema can validate
      const validResult = subscription.message.safeParse({
        seq: 100,
        data: 'test',
      })
      expect(validResult.success).toBe(true)

      const invalidResult = subscription.message.safeParse({
        seq: -1,
        data: '',
      })
      expect(invalidResult.success).toBe(false)
    })
  })

  describe('property access', () => {
    it('can access nsid after construction', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({})

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.nsid).toBe(nsid)
      expect(subscription.nsid).toBe('com.atproto.sync.subscribeRepos')
    })

    it('can access type after construction', () => {
      const nsid = asNsidString('com.atproto.sync.subscribeRepos')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({})

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.type).toBe('subscription')
      expect(typeof subscription.type).toBe('string')
    })
  })

  describe('different message schema types', () => {
    it('constructs with ObjectSchema message', () => {
      const nsid = asNsidString('app.bsky.test')
      const parameters = new ParamsSchema({})
      const message = new ObjectSchema({
        field: new StringSchema({}),
      })

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.message).toBeInstanceOf(ObjectSchema)
      expect(subscription.message).toBe(message)
    })

    it('constructs with RefSchema message', () => {
      const nsid = asNsidString('app.bsky.test')
      const parameters = new ParamsSchema({})
      const message = new RefSchema(() => new ObjectSchema({}))

      const subscription = new Subscription(
        nsid,
        parameters,
        message,
        undefined,
      )

      expect(subscription.message).toBeInstanceOf(RefSchema)
      expect(subscription.message).toBe(message)
    })
  })
})
