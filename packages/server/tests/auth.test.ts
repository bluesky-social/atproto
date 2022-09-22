import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'

const client = AdxApi.service('http://localhost:2583')

describe('auth', () => {
  it('works', async () => {
    const res = await client.todo.adx.createAccount(
      {},
      { username: 'alice.test', did: 'did:test:alice', password: 'test123' },
    )
    const jwt = res.data.jwt
    client.setHeader('Authorization', `Bearer: ${jwt}`)
  })
})
