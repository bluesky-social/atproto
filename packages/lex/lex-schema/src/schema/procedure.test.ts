import { describe, expect, it } from 'vitest'
import { object } from './object.js'
import { params } from './params.js'
import { payload } from './payload.js'
import { procedure } from './procedure.js'
import { string } from './string.js'

describe('Procedure', () => {
  describe('basic construction', () => {
    it('creates a procedure with all parameters', () => {
      const errors = ['InvalidRequest', 'Unauthorized'] as const

      const createPost = procedure(
        'com.example.createPost',
        params(),
        payload('application/json', undefined),
        payload('application/json', undefined),
        errors,
      )

      expect(createPost.nsid).toBe('com.example.createPost')
      expect(createPost.parameters).toEqual(params())
      expect(createPost.input).toEqual(payload('application/json', undefined))
      expect(createPost.output).toEqual(payload('application/json', undefined))
      expect(createPost.errors).toBe(errors)
    })

    it('creates a procedure without errors', () => {
      const doSomething = procedure(
        'com.example.doSomething',
        params(),
        payload('application/json', undefined),
        payload('application/json', undefined),
        undefined,
      )

      expect(doSomething.nsid).toBe('com.example.doSomething')
      expect(doSomething.parameters).toEqual(params())
      expect(doSomething.input).toEqual(payload('application/json', undefined))
      expect(doSomething.output).toEqual(payload('application/json', undefined))
      expect(doSomething.errors).toBeUndefined()
    })

    it('creates a procedure with empty errors array', () => {
      const performAction = procedure(
        'com.example.performAction',
        params(),
        payload('application/json', undefined),
        payload('application/json', undefined),
        [] as const,
      )

      expect(performAction.errors).toEqual([])
    })
  })

  describe('with parameters schema', () => {
    it('creates a procedure with query parameters', () => {
      const listPosts = procedure(
        'com.example.listPosts',
        params({
          limit: string(),
          cursor: string(),
        }),
        payload(undefined, undefined),
        payload('application/json', undefined),
        undefined,
      )

      expect(listPosts.parameters.shape).toHaveProperty('limit')
      expect(listPosts.parameters.shape).toHaveProperty('cursor')
    })

    it('creates a procedure with empty parameters', () => {
      const myProcedure = procedure(
        'com.example.action',
        params(),
        payload('application/json', undefined),
        payload('application/json', undefined),
        undefined,
      )

      expect(Object.keys(myProcedure.parameters.shape)).toHaveLength(0)
    })
  })

  describe('with input payload', () => {
    it('creates a procedure with JSON input', () => {
      const inputSchema = object({
        text: string(),
      })

      const myProcedure = procedure(
        'com.example.createPost',
        params(),
        payload('application/json', inputSchema),
        payload('application/json', undefined),
        undefined,
      )

      expect(myProcedure.input.encoding).toBe('application/json')
      expect(myProcedure.input.schema).toBe(inputSchema)
    })

    it('creates a procedure with text input', () => {
      const myProcedure = procedure(
        'com.example.uploadText',
        params(),
        payload('text/plain', undefined),
        payload('application/json', undefined),
        undefined,
      )

      expect(myProcedure.input.encoding).toBe('text/plain')
      expect(myProcedure.input.schema).toBeUndefined()
    })

    it('creates a procedure with binary input', () => {
      const myProcedure = procedure(
        'com.example.uploadBlob',
        params(),
        payload('application/octet-stream', undefined),
        payload('application/json', undefined),
        undefined,
      )

      expect(myProcedure.input.encoding).toBe('application/octet-stream')
    })

    it('creates a procedure with no input', () => {
      const myProcedure = procedure(
        'com.example.action',
        params(),
        payload(undefined, undefined),
        payload('application/json', undefined),
        undefined,
      )

      expect(myProcedure.input.encoding).toBeUndefined()
      expect(myProcedure.input.schema).toBeUndefined()
    })
  })

  describe('with output payload', () => {
    it('creates a procedure with JSON output', () => {
      const outputSchema = object({
        uri: string(),
        cid: string(),
      })

      const myProcedure = procedure(
        'com.example.getPost',
        params(),
        payload(undefined, undefined),
        payload('application/json', outputSchema),
        undefined,
      )

      expect(myProcedure.output.encoding).toBe('application/json')
      expect(myProcedure.output.schema).toBe(outputSchema)
    })

    it('creates a procedure with text output', () => {
      const myProcedure = procedure(
        'com.example.export',
        params(),
        payload(undefined, undefined),
        payload('text/plain', undefined),
        undefined,
      )

      expect(myProcedure.output.encoding).toBe('text/plain')
    })

    it('creates a procedure with binary output', () => {
      const myProcedure = procedure(
        'com.example.download',
        params(),
        payload(undefined, undefined),
        payload('application/octet-stream', undefined),
        undefined,
      )

      expect(myProcedure.output.encoding).toBe('application/octet-stream')
    })

    it('creates a procedure with no output', () => {
      const myProcedure = procedure(
        'com.example.deletePost',
        params(),
        payload('application/json', undefined),
        payload(undefined, undefined),
        undefined,
      )

      expect(myProcedure.output.encoding).toBeUndefined()
      expect(myProcedure.output.schema).toBeUndefined()
    })
  })

  describe('with error definitions', () => {
    it('creates a procedure with single error', () => {
      const myProcedure = procedure(
        'com.example.action',
        params(),
        payload('application/json', undefined),
        payload('application/json', undefined),
        ['InvalidRequest'] as const,
      )

      expect(myProcedure.errors).toEqual(['InvalidRequest'])
    })

    it('creates a procedure with multiple errors', () => {
      const myProcedure = procedure(
        'com.example.createPost',
        params(),
        payload('application/json', undefined),
        payload('application/json', undefined),
        ['InvalidRequest', 'Unauthorized', 'RateLimitExceeded'] as const,
      )

      expect(myProcedure.errors).toHaveLength(3)
      expect(myProcedure.errors).toContain('InvalidRequest')
      expect(myProcedure.errors).toContain('Unauthorized')
      expect(myProcedure.errors).toContain('RateLimitExceeded')
    })
  })

  describe('property access', () => {
    it('provides access to all properties', () => {
      const errors = ['Error1', 'Error2'] as const

      const myProcedure = procedure(
        'com.example.test',
        params(),
        payload('application/json', undefined),
        payload('application/json', undefined),
        errors,
      )

      expect(myProcedure.nsid).toBe('com.example.test')
      expect(myProcedure.parameters).toEqual(params())
      expect(myProcedure.input).toEqual(payload('application/json', undefined))
      expect(myProcedure.output).toEqual(payload('application/json', undefined))
      expect(myProcedure.errors).toBe(errors)
    })

    it('maintains reference equality for complex properties', () => {
      const parameters = params({ test: string() })
      const inputSchema = object({ field: string() })
      const outputSchema = object({ result: string() })
      const input = payload('application/json', inputSchema)
      const output = payload('application/json', outputSchema)

      const myProcedure = procedure(
        'com.example.test',
        parameters,
        input,
        output,
        undefined,
      )

      // Verify references are maintained
      expect(myProcedure.parameters).toBe(parameters)
      expect(myProcedure.input).toBe(input)
      expect(myProcedure.output).toBe(output)
      expect(myProcedure.input.schema).toBe(inputSchema)
      expect(myProcedure.output.schema).toBe(outputSchema)
    })
  })

  describe('complex scenarios', () => {
    it('creates a fully-featured procedure', () => {
      const inputSchema = object({
        text: string(),
        mentions: string(),
      })
      const outputSchema = object({
        messageId: string(),
        timestamp: string(),
      })
      const errors = [
        'ConversationNotFound',
        'MessageTooLong',
        'RateLimitExceeded',
      ] as const

      const myProcedure = procedure(
        'com.example.chat.sendMessage',
        params({
          conversationId: string(),
        }),
        payload('application/json', inputSchema),
        payload('application/json', outputSchema),
        errors,
      )

      expect(myProcedure.nsid).toBe('com.example.chat.sendMessage')
      expect(myProcedure.parameters.shape).toHaveProperty('conversationId')
      expect(myProcedure.input.encoding).toBe('application/json')
      expect(myProcedure.input.schema).toBe(inputSchema)
      expect(myProcedure.output.encoding).toBe('application/json')
      expect(myProcedure.output.schema).toBe(outputSchema)
      expect(myProcedure.errors).toEqual(errors)
    })

    it('creates a minimal procedure', () => {
      const myProcedure = procedure(
        'com.example.ping',
        params(),
        payload(undefined, undefined),
        payload(undefined, undefined),
        undefined,
      )

      expect(myProcedure.nsid).toBe('com.example.ping')
      expect(Object.keys(myProcedure.parameters.shape)).toHaveLength(0)
      expect(myProcedure.input.encoding).toBeUndefined()
      expect(myProcedure.output.encoding).toBeUndefined()
      expect(myProcedure.errors).toBeUndefined()
    })
  })
})
