import { Code } from '@connectrpc/connect'
import { describe, expect, test } from 'vitest'
import { Service } from '../proto/bsync_connect.js'
import { createTestClient, isConnectError } from './_test-client.test.js'

type Method = keyof typeof Service.methods

// @NOTE Every method but ping requires an api key.
const methods = (Object.keys(Service.methods) as Method[]).filter(
  (method) => method !== 'ping',
)

describe('api key auth', () => {
  test.each(methods)('%s rejects a request without an api key', (method) => {
    const client = createTestClient({ apiKey: null })
    return expect(client[method]({})).rejects.toSatisfy(
      isConnectError('missing auth', Code.Unauthenticated),
    )
  })

  test.each(methods)('%s rejects an unknown api key', (method) => {
    const client = createTestClient({ apiKey: 'key-bad' })
    return expect(client[method]({})).rejects.toSatisfy(
      isConnectError('invalid api key', Code.Unauthenticated),
    )
  })
})
