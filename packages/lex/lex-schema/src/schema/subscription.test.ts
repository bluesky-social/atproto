import { describe, expect, expectTypeOf, it } from 'vitest'
import { integer } from './integer.js'
import { ObjectSchema, object } from './object.js'
import { optional } from './optional.js'
import { ParamsSchema, params } from './params.js'
import { RefSchema, ref } from './ref.js'
import { string } from './string.js'
import {
  InferSubscriptionMessage,
  InferSubscriptionParameters,
  Subscription,
  subscription,
} from './subscription.js'

describe('Subscription', () => {
  describe('constructor', () => {
    it('creates a Subscription instance with all parameters', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params({
        cursor: optional(integer()),
      })
      const message = object({
        seq: integer(),
        data: string(),
      })
      const errors = ['ConsumerTooSlow', 'FutureCursor'] as const

      const mySub = subscription(nsid, parameters, message, errors)

      expect(mySub).toBeInstanceOf(Subscription)
      expect(mySub.nsid).toBe(nsid)
      expect(mySub.parameters).toBe(parameters)
      expect(mySub.message).toBe(message)
      expect(mySub.errors).toBe(errors)
    })

    it('creates a Subscription instance without errors', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params({
        cursor: optional(integer()),
      })
      const message = object({
        seq: integer(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub).toBeInstanceOf(Subscription)
      expect(mySub.nsid).toBe(nsid)
      expect(mySub.parameters).toBe(parameters)
      expect(mySub.message).toBe(message)
      expect(mySub.errors).toBeUndefined()
    })

    it('creates a Subscription instance with empty parameters', () => {
      const nsid = 'app.bsky.notification.subscribe'
      const parameters = params()
      const message = object({
        type: string(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub).toBeInstanceOf(Subscription)
      expect(mySub.parameters).toBe(parameters)
    })
  })

  describe('type property', () => {
    it('has type set to "subscription"', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.type).toBe('subscription')
    })

    it('type is a constant value', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.type).toBe('subscription')
      // TypeScript enforces readonly at compile time
      expect(typeof mySub.type).toBe('string')
    })
  })

  describe('properties', () => {
    it('has nsid property', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.nsid).toBe(nsid)
      expect(typeof mySub.nsid).toBe('string')
    })

    it('has parameters property', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.parameters).toBe(parameters)
      expect(mySub.parameters).toBeInstanceOf(ParamsSchema)
    })

    it('has message property', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.message).toBe(message)
      expect(mySub.message).toBeInstanceOf(ObjectSchema)
    })

    it('has errors property', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer(),
      })
      const errors = ['ConsumerTooSlow'] as const

      const mySub = subscription(nsid, parameters, message, errors)

      expect(mySub.errors).toBe(errors)
      expect(Array.isArray(mySub.errors)).toBe(true)
    })
  })

  describe('with complex parameters', () => {
    it('creates a Subscription with multiple parameter types', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params({
        cursor: optional(integer({ minimum: 0 })),
        includeDeletes: optional(integer({ minimum: 0, maximum: 1 })),
      })
      const message = object({
        seq: integer(),
        data: string(),
      })
      const errors = ['ConsumerTooSlow', 'FutureCursor'] as const

      const mySub = subscription(nsid, parameters, message, errors)

      expect(mySub).toBeInstanceOf(Subscription)
      expect(mySub.parameters).toBe(parameters)
      expect(mySub.errors).toEqual(['ConsumerTooSlow', 'FutureCursor'])
    })
  })

  describe('with various message types', () => {
    it('creates a Subscription with ObjectSchema message', () => {
      const mySub = subscription(
        'com.atproto.sync.subscribeRepos',
        params(),
        object({
          seq: integer(),
          data: string(),
        }),
        undefined,
      )

      expect(mySub).toBeInstanceOf(Subscription)
      expect(mySub.message).toBeInstanceOf(ObjectSchema)
    })

    it('creates a Subscription with RefSchema message', () => {
      const message = string()
      const mySub = subscription(
        'app.bsky.feed.subscribe',
        params(),
        ref(() => message),
        undefined,
      )

      expect(mySub).toBeInstanceOf(Subscription)
      expect(mySub.message).toBeInstanceOf(RefSchema)
    })
  })

  describe('with different error configurations', () => {
    it('creates a Subscription with a single error', () => {
      const mySub = subscription(
        'com.atproto.sync.subscribeRepos',
        params(),
        object({}),
        ['ConsumerTooSlow'],
      )

      expect(mySub.errors).toEqual(['ConsumerTooSlow'])
    })

    it('creates a Subscription with multiple errors', () => {
      const mySub = subscription(
        'com.atproto.sync.subscribeRepos',
        params(),
        object({}),
        ['ConsumerTooSlow', 'FutureCursor', 'InvalidCursor'],
      )

      expectTypeOf<
        readonly ['ConsumerTooSlow', 'FutureCursor', 'InvalidCursor']
      >(mySub.errors)

      expect(mySub.errors).toEqual([
        'ConsumerTooSlow',
        'FutureCursor',
        'InvalidCursor',
      ])
    })

    it('creates a Subscription with empty errors array', () => {
      const mySub = subscription(
        'com.atproto.sync.subscribeRepos',
        params(),
        object({}),
        [],
      )

      expect(mySub.errors).toEqual([])
    })
  })

  describe('type inference', () => {
    it('InferSubscriptionParameters correctly infers parameter types', () => {
      const mySub = subscription(
        'com.atproto.sync.subscribeRepos',
        params({
          cursor: optional(integer()),
        }),
        object({
          seq: integer(),
        }),
      )

      type Params = InferSubscriptionParameters<typeof mySub>

      expectTypeOf<Params>({
        cursor: 12345,
      })
    })

    it('InferSubscriptionMessage correctly infers message type', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer(),
        data: string(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      type Message = InferSubscriptionMessage<typeof mySub>

      expectTypeOf<Message>({
        seq: 12345,
        data: 'test data',
      })
    })
  })

  describe('edge cases', () => {
    it('handles very long NSID', () => {
      const nsid =
        'com.example.very.long.namespace.identifier.subscription.name'
      const parameters = params()
      const message = object({})

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.nsid).toBe(nsid)
    })

    it('handles subscription with all optional parameters', () => {
      const nsid = 'app.bsky.feed.subscribe'
      const parameters = params({
        cursor: optional(integer()),
        includeDeletes: optional(integer()),
        includeEdits: optional(integer()),
      })
      const message = object({})

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.parameters).toBe(parameters)
    })

    it('handles subscription with complex nested message schema', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer(),
        blocks: object({
          cid: string({ format: 'cid' }),
          data: object({
            uri: string({ format: 'at-uri' }),
            content: string(),
          }),
        }),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.message).toBeInstanceOf(ObjectSchema)
    })
  })

  describe('real-world subscription examples', () => {
    it('creates a subscribeLabels subscription', () => {
      const nsid = 'com.atproto.label.subscribeLabels'
      const parameters = params({
        cursor: optional(integer({ minimum: 0 })),
      })
      const message = object({
        seq: integer(),
        labels: object({
          uri: string({ format: 'uri' }),
          val: string(),
        }),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.type).toBe('subscription')
      expect(mySub.nsid).toBe('com.atproto.label.subscribeLabels')
      expect(mySub.parameters.matches({ cursor: 10 })).toBe(true)
      expect(mySub.parameters.matches({ cursor: -10 })).toBe(false)
      expect(
        mySub.message.matches({
          seq: 1,
          labels: { uri: 'http://foo.com', val: 'test' },
        }),
      ).toBe(true)
      expect(
        mySub.message.matches({
          seq: 1,
          labels: { uri: 'http://foo.com', val: 3 },
        }),
      ).toBe(false)
    })

    it('creates a notification subscription', () => {
      const nsid = 'app.bsky.notification.subscribe'
      const parameters = params({
        cursor: optional(string()),
      })
      const message = object({
        type: string(),
        uri: string({ format: 'at-uri' }),
        cid: string({ format: 'cid' }),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.type).toBe('subscription')
      expect(mySub.nsid).toBe('app.bsky.notification.subscribe')
    })
  })

  describe('with mixed parameter and message types', () => {
    it('handles required and optional parameters with complex message', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params({
        cursor: optional(integer({ minimum: 0 })),
        includeDeletes: optional(integer({ minimum: 0, maximum: 1 })),
      })
      const message = object({
        seq: integer(),
        rebase: optional(integer({ minimum: 0, maximum: 1 })),
        tooBig: optional(integer({ minimum: 0, maximum: 1 })),
        repo: string({ format: 'did' }),
        commit: string({ format: 'cid' }),
        blocks: string(),
        ops: object({}),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.type).toBe('subscription')
      expect(mySub.parameters).toBe(parameters)
      expect(mySub.message).toBe(message)
    })
  })

  describe('validation through nested schemas', () => {
    it('parameters can validate input through ParamsSchema', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params({
        cursor: integer({ minimum: 0 }),
      })
      const message = object({})

      const mySub = subscription(nsid, parameters, message, undefined)

      // Test that the parameters schema can validate
      const validResult = mySub.parameters.safeParse({ cursor: 100 })
      expect(validResult.success).toBe(true)

      const invalidResult = mySub.parameters.safeParse({ cursor: -1 })
      expect(invalidResult.success).toBe(false)
    })

    it('message can validate input through ObjectSchema', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({
        seq: integer({ minimum: 0 }),
        data: string({ minLength: 1 }),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      // Test that the message schema can validate
      const validResult = mySub.message.safeParse({
        seq: 100,
        data: 'test',
      })
      expect(validResult.success).toBe(true)

      const invalidResult = mySub.message.safeParse({
        seq: -1,
        data: '',
      })
      expect(invalidResult.success).toBe(false)
    })
  })

  describe('property access', () => {
    it('can access nsid after construction', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({})

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.nsid).toBe(nsid)
      expect(mySub.nsid).toBe('com.atproto.sync.subscribeRepos')
    })

    it('can access type after construction', () => {
      const nsid = 'com.atproto.sync.subscribeRepos'
      const parameters = params()
      const message = object({})

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.type).toBe('subscription')
      expect(typeof mySub.type).toBe('string')
    })
  })

  describe('different message schema types', () => {
    it('constructs with ObjectSchema message', () => {
      const nsid = 'app.bsky.test'
      const parameters = params()
      const message = object({
        field: string(),
      })

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.message).toBeInstanceOf(ObjectSchema)
      expect(mySub.message).toBe(message)
    })

    it('constructs with RefSchema message', () => {
      const nsid = 'app.bsky.test'
      const parameters = params()
      const message = ref(() => object({}))

      const mySub = subscription(nsid, parameters, message, undefined)

      expect(mySub.message).toBeInstanceOf(RefSchema)
      expect(mySub.message).toBe(message)
    })
  })
})
