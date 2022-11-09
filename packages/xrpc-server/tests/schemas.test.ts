import * as http from 'http'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'

describe('Schemas', () => {
  let s: http.Server
  const server = xrpcServer.createServer()
  beforeAll(async () => {
    s = await createServer(8888, server)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('accepts valid method schemas', () => {
    server.addSchema({
      lexicon: 1,
      id: 'io.example.query1',
      type: 'query',
    })
    server.addSchema({
      lexicon: 1,
      id: 'io.example.query2',
      type: 'query',
      parameters: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      output: {
        encoding: 'application/json',
        schema: {
          type: 'object',
          required: ['message'],
          properties: { message: { type: 'string' } },
        },
      },
    })
    server.addSchema({
      lexicon: 1,
      id: 'io.example.query3',
      type: 'query',
      parameters: {
        type: 'object',
        properties: {
          strParam: { type: 'string', minLength: 10, maxLength: 100 },
          numParam: { type: 'number', minimum: 10, maximum: 100 },
          intParam: { type: 'integer', minimum: 10, maximum: 100 },
          boolParam: { type: 'boolean' },
        },
      },
      output: {
        encoding: 'text/plain',
      },
    })
    server.addSchema({
      lexicon: 1,
      id: 'io.example.proc1',
      type: 'procedure',
    })
    server.addSchema({
      lexicon: 1,
      id: 'io.example.proc2',
      type: 'procedure',
      input: {
        encoding: 'application/json',
        schema: {
          type: 'object',
          required: ['message'],
          properties: { message: { type: 'string' } },
        },
      },
      output: {
        encoding: 'application/json',
        schema: {
          type: 'object',
          required: ['message'],
          properties: { message: { type: 'string' } },
        },
      },
    })
    server.addSchema({
      lexicon: 1,
      id: 'io.example.query3',
      type: 'procedure',
      parameters: {
        type: 'object',
        properties: {
          strParam: { type: 'string', minLength: 10, maxLength: 100 },
          numParam: { type: 'number', minimum: 10, maximum: 100 },
          intParam: { type: 'integer', minimum: 10, maximum: 100 },
          boolParam: { type: 'boolean' },
        },
      },
      input: {
        encoding: 'text/plain',
      },
      output: {
        encoding: 'text/plain',
      },
    })
  })

  it('rejects invalid method schemas', () => {
    expect(() => {
      server.addSchema(false)
    }).toThrow()
    expect(() => {
      server.addSchema(123)
    }).toThrow()
    expect(() => {
      server.addSchema({})
    }).toThrow()
    expect(() => {
      server.addSchema({
        id: 'io.example.foo',
        type: 'query',
      })
    }).toThrow()
    expect(() => {
      server.addSchema({
        lexicon: 1,
        type: 'query',
      })
    }).toThrow()
    expect(() => {
      server.addSchema({
        lexicon: 1,
        id: 'io.example.foo',
      })
    }).toThrow()
    expect(() => {
      server.addSchema({
        lexicon: 1,
        id: 'io.example.foo',
        type: 'wrong',
      })
    }).toThrow()
    expect(() => {
      server.addSchema({
        lexicon: 1,
        id: 'io.example.foo',
        type: 'query',
        parameters: { message: { type: 'bad' } },
      })
    }).toThrow()
  })
})
