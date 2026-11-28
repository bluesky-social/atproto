import { describe, expect, it } from 'vitest'
import { xrpcError, xrpcFetch } from './_xrpc-fetch.test.js'
import { AtpAgent } from './atp-agent.js'
import { ComAtprotoServerCreateAccount } from './client/index.js'

describe('errors', () => {
  it('constructs the correct error instance', async () => {
    using fetch = xrpcFetch({
      'com.atproto.server.createAccount': () =>
        xrpcError(400, 'UnsupportedDomain', 'Not a supported handle domain'),
    })
    const client = new AtpAgent({ service: 'https://pds.test', fetch })

    const res = client.com.atproto.server.createAccount({
      handle: 'admin.blah',
      email: 'admin@test.com',
      password: 'password',
    })
    await expect(res).rejects.toThrow(
      ComAtprotoServerCreateAccount.UnsupportedDomainError,
    )
  })
})
