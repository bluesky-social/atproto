import { describe, expect, it } from 'vitest'
import { integer } from './integer.js'
import { ObjectSchema, object } from './object.js'
import { optional } from './optional.js'
import { ParamsSchema, params } from './params.js'
import { Payload, payload } from './payload.js'
import { Query, query } from './query.js'
import { string } from './string.js'
import { withDefault } from './with-default.js'

describe('Query', () => {
  describe('constructor', () => {
    it('creates a Query instance with all parameters', () => {
      const nsid = 'app.bsky.feed.getFeedSkeleton'
      const parameters = params({
        feed: string({ format: 'at-uri' }),
        limit: optional(integer({ minimum: 1, maximum: 100 })),
      })
      const output = payload(
        'application/json',
        object({
          feed: string({ format: 'at-uri' }),
        }),
      )
      const errors = ['NotFound', 'RateLimitExceeded'] as const

      const myQuery = query(nsid, parameters, output, errors)

      expect(myQuery).toBeInstanceOf(Query)
      expect(myQuery.nsid).toBe(nsid)
      expect(myQuery.parameters).toBe(parameters)
      expect(myQuery.output).toBe(output)
      expect(myQuery.errors).toBe(errors)
    })

    it('creates a Query instance without errors', () => {
      const nsid = 'app.bsky.feed.getFeedSkeleton'
      const parameters = params({
        feed: string({ format: 'at-uri' }),
      })
      const output = payload(
        'application/json',
        object({
          feed: string({ format: 'at-uri' }),
        }),
      )

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery).toBeInstanceOf(Query)
      expect(myQuery.nsid).toBe(nsid)
      expect(myQuery.parameters).toBe(parameters)
      expect(myQuery.output).toBe(output)
      expect(myQuery.errors).toBeUndefined()
    })

    it('creates a Query instance with empty parameters', () => {
      const nsid = 'app.bsky.actor.getProfile'
      const parameters = params()
      const output = payload(
        'application/json',
        object({
          did: string({ format: 'did' }),
        }),
      )

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery).toBeInstanceOf(Query)
      expect(myQuery.parameters).toBe(parameters)
    })
  })

  describe('properties', () => {
    it('has nsid property', () => {
      const nsid = 'app.bsky.feed.getFeedSkeleton'
      const parameters = params()
      const output = payload('application/json', undefined)

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery.nsid).toBe(nsid)
      expect(myQuery.nsid).toBe('app.bsky.feed.getFeedSkeleton')
    })

    it('has parameters property', () => {
      const nsid = 'app.bsky.feed.getFeedSkeleton'
      const parameters = params({
        feed: string({ format: 'at-uri' }),
      })
      const output = payload('application/json', undefined)

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery.parameters).toBe(parameters)
      expect(myQuery.parameters).toBeInstanceOf(ParamsSchema)
    })

    it('has output property', () => {
      const nsid = 'app.bsky.feed.getFeedSkeleton'
      const parameters = params()
      const output = payload('application/json', undefined)

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery.output).toBe(output)
      expect(myQuery.output).toBeInstanceOf(Payload)
    })

    it('has errors property', () => {
      const nsid = 'app.bsky.feed.getFeedSkeleton'
      const parameters = params()
      const output = payload('application/json', undefined)
      const errors = ['NotFound', 'RateLimitExceeded'] as const

      const myQuery = query(nsid, parameters, output, errors)

      expect(myQuery.errors).toBe(errors)
      expect(myQuery.errors).toEqual(['NotFound', 'RateLimitExceeded'])
    })
  })

  describe('with complex parameters', () => {
    it('creates a Query with multiple parameter types', () => {
      const nsid = 'app.bsky.feed.searchPosts'
      const parameters = params({
        q: string({ minLength: 1 }),
        limit: optional(integer({ minimum: 1, maximum: 100 })),
        cursor: optional(string()),
        author: optional(string({ format: 'did' })),
      })
      const output = payload(
        'application/json',
        object({
          cursor: optional(string()),
          posts: object({}),
        }),
      )
      const errors = ['BadRequest', 'RateLimitExceeded'] as const

      const myQuery = query(nsid, parameters, output, errors)

      expect(myQuery).toBeInstanceOf(Query)
      expect(myQuery.parameters).toBe(parameters)
      expect(myQuery.errors).toEqual(['BadRequest', 'RateLimitExceeded'])
    })
  })

  describe('with various output payloads', () => {
    it('creates a Query with undefined output payload', () => {
      const nsid = 'app.bsky.actor.getProfile'
      const parameters = params({
        actor: string({ format: 'at-identifier' }),
      })
      const output = payload(undefined, undefined)

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery).toBeInstanceOf(Query)
      expect(myQuery.output.encoding).toBeUndefined()
      expect(myQuery.output.schema).toBeUndefined()
    })

    it('creates a Query with JSON payload', () => {
      const nsid = 'app.bsky.actor.getProfile'
      const parameters = params({
        actor: string({ format: 'at-identifier' }),
      })
      const output = payload(
        'application/json',
        object({
          did: string({ format: 'did' }),
          handle: string({ format: 'handle' }),
        }),
      )

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery).toBeInstanceOf(Query)
      expect(myQuery.output.encoding).toBe('application/json')
      expect(myQuery.output.schema).toBeInstanceOf(ObjectSchema)
    })

    it('creates a Query with text payload', () => {
      const nsid = 'app.bsky.feed.getPost'
      const parameters = params({
        uri: string({ format: 'at-uri' }),
      })
      const output = payload('text/plain', undefined)

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery).toBeInstanceOf(Query)
      expect(myQuery.output.encoding).toBe('text/plain')
    })
  })

  describe('with different error configurations', () => {
    it('creates a Query with a single error', () => {
      const nsid = 'app.bsky.feed.getPost'
      const parameters = params()
      const output = payload('application/json', undefined)
      const errors = ['NotFound'] as const

      const myQuery = query(nsid, parameters, output, errors)

      expect(myQuery.errors).toEqual(['NotFound'])
    })

    it('creates a Query with multiple errors', () => {
      const nsid = 'app.bsky.feed.getPost'
      const parameters = params()
      const output = payload('application/json', undefined)
      const errors = ['NotFound', 'Unauthorized', 'RateLimitExceeded'] as const

      const myQuery = query(nsid, parameters, output, errors)

      expect(myQuery.errors).toEqual([
        'NotFound',
        'Unauthorized',
        'RateLimitExceeded',
      ])
    })

    it('creates a Query with empty errors array', () => {
      const nsid = 'app.bsky.feed.getPost'
      const parameters = params()
      const output = payload('application/json', undefined)
      const errors = [] as const

      const myQuery = query(nsid, parameters, output, errors)

      expect(myQuery.errors).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('handles very long NSID', () => {
      const nsid = 'com.example.very.long.namespace.identifier.method.name'
      const parameters = params()
      const output = payload('application/json', undefined)

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery.nsid).toBe(nsid)
    })

    it('handles myQuery with all optional parameters', () => {
      const nsid = 'app.bsky.feed.search'
      const parameters = params({
        q: optional(string()),
        limit: optional(integer()),
        cursor: optional(string()),
      })
      const output = payload('application/json', undefined)

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery.parameters).toBe(parameters)
    })

    it('handles myQuery with complex nested output schema', () => {
      const nsid = 'app.bsky.feed.getTimeline'
      const parameters = params()
      const output = payload(
        'application/json',
        object({
          cursor: optional(string()),
          feed: object({
            post: object({
              uri: string({ format: 'at-uri' }),
              cid: string({ format: 'cid' }),
            }),
          }),
        }),
      )

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery.output.schema).toBeInstanceOf(ObjectSchema)
    })
  })

  describe('real-world myQuery examples', () => {
    it('creates a getFeedSkeleton myQuery', () => {
      const nsid = 'app.bsky.feed.getFeedSkeleton'
      const parameters = params({
        feed: string({ format: 'at-uri' }),
        limit: optional(withDefault(integer({ minimum: 1, maximum: 100 }), 50)),
        cursor: optional(string()),
      })
      const output = payload(
        'application/json',
        object({
          cursor: optional(string()),
          feed: object({}),
        }),
      )

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery.nsid).toBe('app.bsky.feed.getFeedSkeleton')
    })

    it('creates a searchPosts myQuery', () => {
      const nsid = 'app.bsky.feed.searchPosts'
      const parameters = params({
        q: string({ minLength: 1, maxLength: 300 }),
        limit: optional(withDefault(integer({ minimum: 1, maximum: 100 }), 25)),
        cursor: optional(string()),
      })
      const output = payload(
        'application/json',
        object({
          cursor: optional(string()),
          hitsTotal: optional(integer()),
          posts: object({}),
        }),
      )
      const errors = ['BadRequest'] as const

      const myQuery = query(nsid, parameters, output, errors)

      expect(myQuery.nsid).toBe('app.bsky.feed.searchPosts')
      expect(myQuery.errors).toEqual(['BadRequest'])
    })

    it('creates a getProfile myQuery', () => {
      const nsid = 'app.bsky.actor.getProfile'
      const parameters = params({
        actor: string({ format: 'at-identifier' }),
      })
      const output = payload(
        'application/json',
        object({
          did: string({ format: 'did' }),
          handle: string({ format: 'handle' }),
          displayName: optional(string({ maxGraphemes: 64 })),
          description: optional(string({ maxGraphemes: 256 })),
        }),
      )

      const myQuery = query(nsid, parameters, output, undefined)

      expect(myQuery.nsid).toBe('app.bsky.actor.getProfile')
    })
  })
})
