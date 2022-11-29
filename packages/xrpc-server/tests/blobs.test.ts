import * as http from 'http'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import xrpc from '@atproto/xrpc'
import { randomBytes } from '@atproto/crypto'

const SCHEMAS = [
  {
    lexicon: 1,
    id: 'io.example.uploadBlob',
    type: 'procedure',
    input: {
      encoding: 'multipart/form-data',
      schema: {
        type: 'object',
        required: ['field', 'file'],
        properties: {
          field: { type: 'string' },
          file: { type: 'blob' },
        },
      },
    },
    output: {
      encoding: 'application/json',
      schema: {},
    },
  },
]

describe('Blobs', () => {
  let s: http.Server
  const server = xrpcServer.createServer(SCHEMAS)
  server.method(
    'io.example.uploadBlob',
    (_params: xrpcServer.Params, _input?: xrpcServer.HandlerInput) => ({
      encoding: 'json',
      body: {},
    }),
  )
  const client = xrpc.service(`http://localhost:8892`)
  xrpc.addSchemas(SCHEMAS)
  beforeAll(async () => {
    s = await createServer(8892, server)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('uploads blobs', async () => {
    const bytes = randomBytes(1000)
    const blob = new Blob([bytes.buffer], { type: 'image/png' })
    const data = new FormData()
    data.append('field', 'blah')
    data.append('file', blob)
    const res = await fetch(
      'http://localhost:8892/xrpc/io.example.uploadBlob',
      {
        method: 'POST',
        body: data,
      },
    )
    console.log(res.status)
    console.log(res.statusText)
    // const res1 = await client.call('io.example.uploadBlob', {}, data, {
    //   // encoding: 'multipart/form-data',
    //   headers: {
    //     'Content-Type': 'multipart/form-data',
    //   },
    // })
    // expect(res1.success).toBeTruthy()
    // expect(res1.data.foo).toBe('hello')
    // expect(res1.data.bar).toBe(123)
  })

  //   await expect(client.call('io.example.validationTest', {})).rejects.toThrow(
  //     `A request body is expected but none was provided`,
  //   )
  //   await expect(
  //     client.call('io.example.validationTest', {}, {}),
  //   ).rejects.toThrow(`input must have required property 'foo'`)
  //   await expect(
  //     client.call('io.example.validationTest', {}, { foo: 123 }),
  //   ).rejects.toThrow(`input/foo must be string`)

  //   // 500 responses don't include details, so we nab details from the logger.
  //   let error: string | undefined
  //   const origError = logger.error
  //   logger.error = (obj, ...args) => {
  //     error = obj.message
  //     logger.error = origError
  //     return logger.error(obj, ...args)
  //   }

  //   await expect(client.call('io.example.validationTest2')).rejects.toThrow(
  //     'Internal Server Error',
  //   )
  //   expect(error).toEqual(`output must have required property 'foo'`)
  // })
})
