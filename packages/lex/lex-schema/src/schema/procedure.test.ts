import { describe, expect, it } from 'vitest'
import { ObjectSchema } from './object.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'
import { Procedure } from './procedure.js'
import { StringSchema } from './string.js'

describe('Procedure', () => {
  describe('basic construction', () => {
    it('creates a procedure with all parameters', () => {
      const nsid = 'com.example.createPost'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/json', undefined)
      const output = new Payload('application/json', undefined)
      const errors = ['InvalidRequest', 'Unauthorized'] as const

      const procedure = new Procedure(nsid, parameters, input, output, errors)

      expect(procedure.nsid).toBe(nsid)
      expect(procedure.parameters).toBe(parameters)
      expect(procedure.input).toBe(input)
      expect(procedure.output).toBe(output)
      expect(procedure.errors).toBe(errors)
    })

    it('creates a procedure without errors', () => {
      const nsid = 'com.example.doSomething'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/json', undefined)
      const output = new Payload('application/json', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.nsid).toBe(nsid)
      expect(procedure.parameters).toBe(parameters)
      expect(procedure.input).toBe(input)
      expect(procedure.output).toBe(output)
      expect(procedure.errors).toBeUndefined()
    })

    it('creates a procedure with empty errors array', () => {
      const nsid = 'com.example.action'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/json', undefined)
      const output = new Payload('application/json', undefined)
      const errors = [] as const

      const procedure = new Procedure(nsid, parameters, input, output, errors)

      expect(procedure.errors).toEqual([])
    })
  })

  describe('with parameters schema', () => {
    it('creates a procedure with query parameters', () => {
      const nsid = 'com.example.listPosts'
      const parameters = new ParamsSchema({
        limit: new StringSchema({}),
        cursor: new StringSchema({}),
      })
      const input = new Payload(undefined, undefined)
      const output = new Payload('application/json', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.parameters).toBe(parameters)
      expect(procedure.parameters.validators).toHaveProperty('limit')
      expect(procedure.parameters.validators).toHaveProperty('cursor')
    })

    it('creates a procedure with empty parameters', () => {
      const nsid = 'com.example.action'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/json', undefined)
      const output = new Payload('application/json', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.parameters).toBe(parameters)
      expect(Object.keys(procedure.parameters.validators)).toHaveLength(0)
    })
  })

  describe('with input payload', () => {
    it('creates a procedure with JSON input', () => {
      const nsid = 'com.example.createPost'
      const parameters = new ParamsSchema({})
      const inputSchema = new ObjectSchema({
        text: new StringSchema({}),
      })
      const input = new Payload('application/json', inputSchema)
      const output = new Payload('application/json', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.input.encoding).toBe('application/json')
      expect(procedure.input.schema).toBe(inputSchema)
    })

    it('creates a procedure with text input', () => {
      const nsid = 'com.example.uploadText'
      const parameters = new ParamsSchema({})
      const input = new Payload('text/plain', undefined)
      const output = new Payload('application/json', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.input.encoding).toBe('text/plain')
      expect(procedure.input.schema).toBeUndefined()
    })

    it('creates a procedure with binary input', () => {
      const nsid = 'com.example.uploadBlob'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/octet-stream', undefined)
      const output = new Payload('application/json', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.input.encoding).toBe('application/octet-stream')
    })

    it('creates a procedure with no input', () => {
      const nsid = 'com.example.action'
      const parameters = new ParamsSchema({})
      const input = new Payload(undefined, undefined)
      const output = new Payload('application/json', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.input.encoding).toBeUndefined()
      expect(procedure.input.schema).toBeUndefined()
    })
  })

  describe('with output payload', () => {
    it('creates a procedure with JSON output', () => {
      const nsid = 'com.example.getPost'
      const parameters = new ParamsSchema({})
      const input = new Payload(undefined, undefined)
      const outputSchema = new ObjectSchema({
        uri: new StringSchema({}),
        cid: new StringSchema({}),
      })
      const output = new Payload('application/json', outputSchema)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.output.encoding).toBe('application/json')
      expect(procedure.output.schema).toBe(outputSchema)
    })

    it('creates a procedure with text output', () => {
      const nsid = 'com.example.export'
      const parameters = new ParamsSchema({})
      const input = new Payload(undefined, undefined)
      const output = new Payload('text/plain', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.output.encoding).toBe('text/plain')
    })

    it('creates a procedure with binary output', () => {
      const nsid = 'com.example.download'
      const parameters = new ParamsSchema({})
      const input = new Payload(undefined, undefined)
      const output = new Payload('application/octet-stream', undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.output.encoding).toBe('application/octet-stream')
    })

    it('creates a procedure with no output', () => {
      const nsid = 'com.example.deletePost'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/json', undefined)
      const output = new Payload(undefined, undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.output.encoding).toBeUndefined()
      expect(procedure.output.schema).toBeUndefined()
    })
  })

  describe('with error definitions', () => {
    it('creates a procedure with single error', () => {
      const nsid = 'com.example.action'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/json', undefined)
      const output = new Payload('application/json', undefined)
      const errors = ['InvalidRequest'] as const

      const procedure = new Procedure(nsid, parameters, input, output, errors)

      expect(procedure.errors).toEqual(['InvalidRequest'])
    })

    it('creates a procedure with multiple errors', () => {
      const nsid = 'com.example.createPost'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/json', undefined)
      const output = new Payload('application/json', undefined)
      const errors = [
        'InvalidRequest',
        'Unauthorized',
        'RateLimitExceeded',
      ] as const

      const procedure = new Procedure(nsid, parameters, input, output, errors)

      expect(procedure.errors).toHaveLength(3)
      expect(procedure.errors).toContain('InvalidRequest')
      expect(procedure.errors).toContain('Unauthorized')
      expect(procedure.errors).toContain('RateLimitExceeded')
    })
  })

  describe('property access', () => {
    it('provides access to all properties', () => {
      const nsid = 'com.example.test'
      const parameters = new ParamsSchema({})
      const input = new Payload('application/json', undefined)
      const output = new Payload('application/json', undefined)
      const errors = ['Error1', 'Error2'] as const

      const procedure = new Procedure(nsid, parameters, input, output, errors)

      // Verify all properties are accessible
      expect(procedure.nsid).toBe(nsid)
      expect(procedure.parameters).toBe(parameters)
      expect(procedure.input).toBe(input)
      expect(procedure.output).toBe(output)
      expect(procedure.errors).toBe(errors)
    })

    it('maintains reference equality for complex properties', () => {
      const parameters = new ParamsSchema({ test: new StringSchema({}) })
      const inputSchema = new ObjectSchema({ field: new StringSchema({}) })
      const outputSchema = new ObjectSchema({ result: new StringSchema({}) })
      const input = new Payload('application/json', inputSchema)
      const output = new Payload('application/json', outputSchema)

      const procedure = new Procedure(
        'com.example.test',
        parameters,
        input,
        output,
        undefined,
      )

      // Verify references are maintained
      expect(procedure.parameters).toBe(parameters)
      expect(procedure.input).toBe(input)
      expect(procedure.output).toBe(output)
      expect(procedure.input.schema).toBe(inputSchema)
      expect(procedure.output.schema).toBe(outputSchema)
    })
  })

  describe('complex scenarios', () => {
    it('creates a fully-featured procedure', () => {
      const nsid = 'com.example.chat.sendMessage'
      const parameters = new ParamsSchema({
        conversationId: new StringSchema({}),
      })
      const inputSchema = new ObjectSchema({
        text: new StringSchema({}),
        mentions: new StringSchema({}),
      })
      const outputSchema = new ObjectSchema({
        messageId: new StringSchema({}),
        timestamp: new StringSchema({}),
      })
      const input = new Payload('application/json', inputSchema)
      const output = new Payload('application/json', outputSchema)
      const errors = [
        'ConversationNotFound',
        'MessageTooLong',
        'RateLimitExceeded',
      ] as const

      const procedure = new Procedure(nsid, parameters, input, output, errors)

      expect(procedure.nsid).toBe(nsid)
      expect(procedure.parameters.validators).toHaveProperty('conversationId')
      expect(procedure.input.encoding).toBe('application/json')
      expect(procedure.input.schema).toBe(inputSchema)
      expect(procedure.output.encoding).toBe('application/json')
      expect(procedure.output.schema).toBe(outputSchema)
      expect(procedure.errors).toEqual(errors)
    })

    it('creates a minimal procedure', () => {
      const nsid = 'com.example.ping'
      const parameters = new ParamsSchema({})
      const input = new Payload(undefined, undefined)
      const output = new Payload(undefined, undefined)

      const procedure = new Procedure(
        nsid,
        parameters,
        input,
        output,
        undefined,
      )

      expect(procedure.nsid).toBe(nsid)
      expect(Object.keys(procedure.parameters.validators)).toHaveLength(0)
      expect(procedure.input.encoding).toBeUndefined()
      expect(procedure.output.encoding).toBeUndefined()
      expect(procedure.errors).toBeUndefined()
    })
  })
})
