import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'

const client = AdxApi.service('http://localhost:2583')

const username = 'alice.test'
const did = 'did:test:alice'
const password = 'test123'

describe('auth', () => {
  it('creates an account', async () => {
    const res = await client.todo.adx.createAccount(
      {},
      { username, did, password },
    )
    expect(typeof res.data.jwt).toBe('string')
  })

  let jwt: string

  it('logs in', async () => {
    const res = await client.todo.adx.createSession({}, { username, password })
    jwt = res.data.jwt
    expect(typeof jwt).toBe('string')
  })

  it('fails on authenticated requests', async () => {
    await expect(client.todo.adx.getSession({}, {})).rejects.toThrow()
  })

  it('can perform authenticated requests', async () => {
    client.setHeader('authorization', `Bearer ${jwt}`)
    const res = await client.todo.adx.getSession({}, {})
    expect(res.data.did).toBe(did)
    expect(res.data.name).toBe(username)
  })
})
