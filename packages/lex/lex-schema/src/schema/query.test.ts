import { describe, expect, it } from 'vitest'
import { asNsidString } from '../core.js'
import { IntegerSchema } from './integer.js'
import { ObjectSchema } from './object.js'
import { OptionalSchema } from './optional.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'
import { Query } from './query.js'
import { StringSchema } from './string.js'

describe('Query', () => {
  describe('constructor', () => {
    it('creates a Query instance with all parameters', () => {
      const nsid = asNsidString('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({
        feed: new StringSchema({ format: 'at-uri' }),
        limit: new OptionalSchema(
          new IntegerSchema({ minimum: 1, maximum: 100 }),
        ),
      })
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          feed: new StringSchema({ format: 'at-uri' }),
        }),
      )
      const errors = ['NotFound', 'RateLimitExceeded'] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query).toBeInstanceOf(Query)
      expect(query.nsid).toBe(nsid)
      expect(query.parameters).toBe(parameters)
      expect(query.output).toBe(output)
      expect(query.errors).toBe(errors)
    })

    it('creates a Query instance without errors', () => {
      const nsid = asNsidString('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({
        feed: new StringSchema({ format: 'at-uri' }),
      })
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          feed: new StringSchema({ format: 'at-uri' }),
        }),
      )

      const query = new Query(nsid, parameters, output, undefined)

      expect(query).toBeInstanceOf(Query)
      expect(query.nsid).toBe(nsid)
      expect(query.parameters).toBe(parameters)
      expect(query.output).toBe(output)
      expect(query.errors).toBeUndefined()
    })

    it('creates a Query instance with empty parameters', () => {
      const nsid = asNsidString('app.bsky.actor.getProfile')
      const parameters = new ParamsSchema({})
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          did: new StringSchema({ format: 'did' }),
        }),
      )

      const query = new Query(nsid, parameters, output, undefined)

      expect(query).toBeInstanceOf(Query)
      expect(query.parameters).toBe(parameters)
    })
  })

  describe('properties', () => {
    it('has nsid property', () => {
      const nsid = asNsidString('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.nsid).toBe(nsid)
      expect(query.nsid).toBe('app.bsky.feed.getFeedSkeleton')
    })

    it('has parameters property', () => {
      const nsid = asNsidString('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({
        feed: new StringSchema({ format: 'at-uri' }),
      })
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.parameters).toBe(parameters)
      expect(query.parameters).toBeInstanceOf(ParamsSchema)
    })

    it('has output property', () => {
      const nsid = asNsidString('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.output).toBe(output)
      expect(query.output).toBeInstanceOf(Payload)
    })

    it('has errors property', () => {
      const nsid = asNsidString('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)
      const errors = ['NotFound', 'RateLimitExceeded'] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query.errors).toBe(errors)
      expect(query.errors).toEqual(['NotFound', 'RateLimitExceeded'])
    })
  })

  describe('with complex parameters', () => {
    it('creates a Query with multiple parameter types', () => {
      const nsid = asNsidString('app.bsky.feed.searchPosts')
      const parameters = new ParamsSchema({
        q: new StringSchema({ minLength: 1 }),
        limit: new OptionalSchema(
          new IntegerSchema({ minimum: 1, maximum: 100 }),
        ),
        cursor: new OptionalSchema(new StringSchema({})),
        author: new OptionalSchema(new StringSchema({ format: 'did' })),
      })
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          cursor: new OptionalSchema(new StringSchema({})),
          posts: new ObjectSchema({}),
        }),
      )
      const errors = ['BadRequest', 'RateLimitExceeded'] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query).toBeInstanceOf(Query)
      expect(query.parameters).toBe(parameters)
      expect(query.errors).toEqual(['BadRequest', 'RateLimitExceeded'])
    })
  })

  describe('with various output payloads', () => {
    it('creates a Query with undefined output payload', () => {
      const nsid = asNsidString('app.bsky.actor.getProfile')
      const parameters = new ParamsSchema({
        actor: new StringSchema({ format: 'at-identifier' }),
      })
      const output = new Payload(undefined, undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query).toBeInstanceOf(Query)
      expect(query.output.encoding).toBeUndefined()
      expect(query.output.schema).toBeUndefined()
    })

    it('creates a Query with JSON payload', () => {
      const nsid = asNsidString('app.bsky.actor.getProfile')
      const parameters = new ParamsSchema({
        actor: new StringSchema({ format: 'at-identifier' }),
      })
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          did: new StringSchema({ format: 'did' }),
          handle: new StringSchema({ format: 'handle' }),
        }),
      )

      const query = new Query(nsid, parameters, output, undefined)

      expect(query).toBeInstanceOf(Query)
      expect(query.output.encoding).toBe('application/json')
      expect(query.output.schema).toBeInstanceOf(ObjectSchema)
    })

    it('creates a Query with text payload', () => {
      const nsid = asNsidString('app.bsky.feed.getPost')
      const parameters = new ParamsSchema({
        uri: new StringSchema({ format: 'at-uri' }),
      })
      const output = new Payload('text/plain', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query).toBeInstanceOf(Query)
      expect(query.output.encoding).toBe('text/plain')
    })
  })

  describe('with different error configurations', () => {
    it('creates a Query with a single error', () => {
      const nsid = asNsidString('app.bsky.feed.getPost')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)
      const errors = ['NotFound'] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query.errors).toEqual(['NotFound'])
    })

    it('creates a Query with multiple errors', () => {
      const nsid = asNsidString('app.bsky.feed.getPost')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)
      const errors = ['NotFound', 'Unauthorized', 'RateLimitExceeded'] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query.errors).toEqual([
        'NotFound',
        'Unauthorized',
        'RateLimitExceeded',
      ])
    })

    it('creates a Query with empty errors array', () => {
      const nsid = asNsidString('app.bsky.feed.getPost')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)
      const errors = [] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query.errors).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('handles very long NSID', () => {
      const nsid = asNsidString(
        'com.example.very.long.namespace.identifier.method.name',
      )
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.nsid).toBe(nsid)
    })

    it('handles query with all optional parameters', () => {
      const nsid = asNsidString('app.bsky.feed.search')
      const parameters = new ParamsSchema({
        q: new OptionalSchema(new StringSchema({})),
        limit: new OptionalSchema(new IntegerSchema({})),
        cursor: new OptionalSchema(new StringSchema({})),
      })
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.parameters).toBe(parameters)
    })

    it('handles query with complex nested output schema', () => {
      const nsid = asNsidString('app.bsky.feed.getTimeline')
      const parameters = new ParamsSchema({})
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          cursor: new OptionalSchema(new StringSchema({})),
          feed: new ObjectSchema({
            post: new ObjectSchema({
              uri: new StringSchema({ format: 'at-uri' }),
              cid: new StringSchema({ format: 'cid' }),
            }),
          }),
        }),
      )

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.output.schema).toBeInstanceOf(ObjectSchema)
    })
  })

  describe('real-world query examples', () => {
    it('creates a getFeedSkeleton query', () => {
      const nsid = asNsidString('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({
        feed: new StringSchema({ format: 'at-uri' }),
        limit: new OptionalSchema(
          new IntegerSchema({ minimum: 1, maximum: 100, default: 50 }),
        ),
        cursor: new OptionalSchema(new StringSchema({})),
      })
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          cursor: new OptionalSchema(new StringSchema({})),
          feed: new ObjectSchema({}),
        }),
      )

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.nsid).toBe('app.bsky.feed.getFeedSkeleton')
    })

    it('creates a searchPosts query', () => {
      const nsid = asNsidString('app.bsky.feed.searchPosts')
      const parameters = new ParamsSchema({
        q: new StringSchema({ minLength: 1, maxLength: 300 }),
        limit: new OptionalSchema(
          new IntegerSchema({ minimum: 1, maximum: 100, default: 25 }),
        ),
        cursor: new OptionalSchema(new StringSchema({})),
      })
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          cursor: new OptionalSchema(new StringSchema({})),
          hitsTotal: new OptionalSchema(new IntegerSchema({})),
          posts: new ObjectSchema({}),
        }),
      )
      const errors = ['BadRequest'] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query.nsid).toBe('app.bsky.feed.searchPosts')
      expect(query.errors).toEqual(['BadRequest'])
    })

    it('creates a getProfile query', () => {
      const nsid = asNsidString('app.bsky.actor.getProfile')
      const parameters = new ParamsSchema({
        actor: new StringSchema({ format: 'at-identifier' }),
      })
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          did: new StringSchema({ format: 'did' }),
          handle: new StringSchema({ format: 'handle' }),
          displayName: new OptionalSchema(
            new StringSchema({ maxGraphemes: 64 }),
          ),
          description: new OptionalSchema(
            new StringSchema({ maxGraphemes: 256 }),
          ),
        }),
      )

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.nsid).toBe('app.bsky.actor.getProfile')
    })
  })
})
