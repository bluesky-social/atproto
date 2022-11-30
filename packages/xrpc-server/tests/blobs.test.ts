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
    expect(res.status).toBe(200)
  })
})
