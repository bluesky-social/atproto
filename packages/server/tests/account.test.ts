import AdxApi, {
  ServiceClient as AdxServiceClient,
  TodoAdxCreateAccount,
} from '@adxp/api'
import * as util from './_util'

const username = 'alice.test'
const password = 'test123'

describe('account', () => {
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

  it('serves the accounts system config', async () => {
    const res = await client.todo.adx.getAccountsConfig({})
    expect(res.data.availableUserDomains[0]).toBe('test')
    expect(typeof res.data.inviteCodeRequired).toBe('boolean')
  })

  let did: string
  let jwt: string

  it('creates an account', async () => {
    const res = await client.todo.adx.createAccount(
      {},
      { email: 'alice@test.com', username, password },
    )
    did = res.data.did
    jwt = res.data.jwt

    expect(typeof jwt).toBe('string')
    expect(did.startsWith('did:plc:')).toBeTruthy()
    expect(res.data.username).toEqual(username)
  })

  it('fails on invalid usernames', async () => {
    try {
      await client.todo.adx.createAccount(
        {},
        {
          email: 'bad-username@test.com',
          username: 'did:bad-username.test',
          password: 'asdf',
        },
      )
      throw new Error('Didnt throw')
    } catch (e) {
      expect(
        e instanceof TodoAdxCreateAccount.InvalidUsernameError,
      ).toBeTruthy()
    }
  })

  it('fails on authenticated requests', async () => {
    await expect(client.todo.adx.getSession({})).rejects.toThrow()
  })

  it('logs in', async () => {
    const res = await client.todo.adx.createSession({}, { username, password })
    jwt = res.data.jwt
    expect(typeof jwt).toBe('string')
    expect(res.data.name).toBe('alice.test')
    expect(res.data.did).toBe(did)
  })

  it('can perform authenticated requests', async () => {
    client.setHeader('authorization', `Bearer ${jwt}`)
    const res = await client.todo.adx.getSession({})
    expect(res.data.did).toBe(did)
    expect(res.data.name).toBe(username)
  })
})
