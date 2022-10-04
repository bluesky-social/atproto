import AdxApi, {
  ServiceClient as AdxServiceClient,
  TodoAdxCreateAccount,
} from '@adxp/api'
import * as util from './_util'

const email = 'alice@test.com'
const username = 'alice.test'
const password = 'test123'

describe('account', () => {
  let serverUrl: string
  let client: AdxServiceClient
  let close: util.CloseFn

  beforeAll(async () => {
    const server = await util.runTestServer({ inviteRequired: true })
    close = server.close
    serverUrl = server.url
    client = AdxApi.service(serverUrl)
  })

  afterAll(async () => {
    if (close) {
      await close()
    }
  })

  let inviteCode: string

  it('creates an invite code', async () => {
    const res = await client.todo.adx.createInviteCode(
      {},
      { useCount: 1 },
      {
        headers: { authorization: util.adminAuth() },
        encoding: 'application/json',
      },
    )
    inviteCode = res.data.code
    const [host, code] = inviteCode.split('-')
    expect(host).toBe(new URL(serverUrl).hostname)
    expect(code.length).toBe(5)
  })

  it('serves the accounts system config', async () => {
    const res = await client.todo.adx.getAccountsConfig({})
    expect(res.data.inviteCodeRequired).toBe(true)
    expect(res.data.availableUserDomains[0]).toBe('test')
    expect(typeof res.data.inviteCodeRequired).toBe('boolean')
  })

  it('fails on invalid usernames', async () => {
    const promise = client.todo.adx.createAccount(
      {},
      {
        email: 'bad-username@test.com',
        username: 'did:bad-username.test',
        password: 'asdf',
        inviteCode,
      },
    )
    await expect(promise).rejects.toThrow(
      TodoAdxCreateAccount.InvalidUsernameError,
    )
  })

  it('fails on bad invite code', async () => {
    const promise = client.todo.adx.createAccount(
      {},
      {
        email,
        username,
        password,
        inviteCode: 'fake-invite',
      },
    )
    await expect(promise).rejects.toThrow(
      TodoAdxCreateAccount.InvalidInviteCodeError,
    )
  })

  let did: string
  let jwt: string

  it('creates an account', async () => {
    const res = await client.todo.adx.createAccount(
      {},
      { email, username, password, inviteCode },
    )
    did = res.data.did
    jwt = res.data.jwt

    expect(typeof jwt).toBe('string')
    expect(did.startsWith('did:plc:')).toBeTruthy()
    expect(res.data.username).toEqual(username)
  })

  it('fails on used up invite code', async () => {
    const promise = client.todo.adx.createAccount(
      {},
      {
        email: 'bob@test.com',
        username: 'bob.test',
        password: 'asdf',
        inviteCode,
      },
    )
    await expect(promise).rejects.toThrow(
      TodoAdxCreateAccount.InvalidInviteCodeError,
    )
  })

  it('fails on unauthenticated requests', async () => {
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
