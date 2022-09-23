import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from './_util'

const username = 'alice.test'
const did = 'did:test:alice'
const password = 'test123'

describe('auth', () => {
  let client: AdxServiceClient
  let close: util.CloseFn

  beforeAll(async () => {
    const server = await util.runTestServer()
    close = server.close
    client = AdxApi.service(server.url)
  })

  afterAll(async () => {
    await close()
  })

  it('creates an account', async () => {
    const res = await client.todo.adx.createAccount(
      {},
      { username, did, password },
    )
    expect(typeof res.data.jwt).toBe('string')
  })

  it('fails on authenticated requests', async () => {
    await expect(client.todo.adx.getSession({}, {})).rejects.toThrow()
  })

  let jwt: string

  it('logs in', async () => {
    const res = await client.todo.adx.createSession({}, { username, password })
    jwt = res.data.jwt
    expect(typeof jwt).toBe('string')
  })

  it('can perform authenticated requests', async () => {
    client.setHeader('authorization', `Bearer ${jwt}`)
    const res = await client.todo.adx.getSession({}, {})
    expect(res.data.did).toBe(did)
    expect(res.data.name).toBe(username)
  })
})
