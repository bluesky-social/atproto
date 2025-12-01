import { asNsid } from '../core.js'
import { IntegerSchema } from './integer.js'
import { ObjectSchema } from './object.js'
import { OptionalSchema } from './optional.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'
import { InferQueryOutputBody, InferQueryParameters, Query } from './query.js'
import { StringSchema } from './string.js'

describe('Query', () => {
  describe('constructor', () => {
    it('creates a Query instance with all parameters', () => {
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
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
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
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
      const nsid = asNsid('app.bsky.actor.getProfile')
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
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.nsid).toBe(nsid)
      expect(query.nsid).toBe('app.bsky.feed.getFeedSkeleton')
    })

    it('has parameters property', () => {
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({
        feed: new StringSchema({ format: 'at-uri' }),
      })
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.parameters).toBe(parameters)
      expect(query.parameters).toBeInstanceOf(ParamsSchema)
    })

    it('has output property', () => {
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.output).toBe(output)
      expect(query.output).toBeInstanceOf(Payload)
    })

    it('has errors property', () => {
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
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
      const nsid = asNsid('app.bsky.feed.searchPosts')
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
      const nsid = asNsid('app.bsky.actor.getProfile')
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
      const nsid = asNsid('app.bsky.actor.getProfile')
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
      const nsid = asNsid('app.bsky.feed.getPost')
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
      const nsid = asNsid('app.bsky.feed.getPost')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)
      const errors = ['NotFound'] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query.errors).toEqual(['NotFound'])
    })

    it('creates a Query with multiple errors', () => {
      const nsid = asNsid('app.bsky.feed.getPost')
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
      const nsid = asNsid('app.bsky.feed.getPost')
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)
      const errors = [] as const

      const query = new Query(nsid, parameters, output, errors)

      expect(query.errors).toEqual([])
    })
  })

  describe('type inference', () => {
    it('InferQueryParameters correctly infers parameter types', () => {
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({
        feed: new StringSchema({ format: 'at-uri' }),
        limit: new OptionalSchema(new IntegerSchema({})),
      })
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      type Params = InferQueryParameters<typeof query>

      // Type-level test - this should compile without errors
      const params: Params = {
        feed: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
        limit: 50,
      }

      expect(params.feed).toBeDefined()
    })

    it('InferQueryOutputBody correctly infers output body type', () => {
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
      const parameters = new ParamsSchema({})
      const output = new Payload(
        'application/json',
        new ObjectSchema({
          cursor: new OptionalSchema(new StringSchema({})),
          feed: new StringSchema({ format: 'at-uri' }),
        }),
      )

      const query = new Query(nsid, parameters, output, undefined)

      type OutputBody = InferQueryOutputBody<typeof query>

      // Type-level test - this should compile without errors
      const outputBody: OutputBody = {
        cursor: 'abc123',
        feed: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
      }

      expect(outputBody.feed).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('handles very long NSID', () => {
      const nsid = asNsid(
        'com.example.very.long.namespace.identifier.method.name',
      )
      const parameters = new ParamsSchema({})
      const output = new Payload('application/json', undefined)

      const query = new Query(nsid, parameters, output, undefined)

      expect(query.nsid).toBe(nsid)
    })

    it('handles query with all optional parameters', () => {
      const nsid = asNsid('app.bsky.feed.search')
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
      const nsid = asNsid('app.bsky.feed.getTimeline')
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
      const nsid = asNsid('app.bsky.feed.getFeedSkeleton')
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
      const nsid = asNsid('app.bsky.feed.searchPosts')
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
      const nsid = asNsid('app.bsky.actor.getProfile')
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
