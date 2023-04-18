import AtpAgent from '@atproto/api'
import * as jwt from 'jsonwebtoken'
import { CloseFn, runTestServer, TestServerInfo } from './_util'

describe('app_passwords', () => {
  let server: TestServerInfo
  let accntAgent: AtpAgent
  let appAgent: AtpAgent
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'app_passwords',
    })
    accntAgent = new AtpAgent({ service: server.url })
    appAgent = new AtpAgent({ service: server.url })
    close = server.close

    await accntAgent.createAccount({
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
  })

  afterAll(async () => {
    await close()
  })

  let appPass: string

  it('creates an app-specific password', async () => {
    const res = await accntAgent.api.com.atproto.server.createAppPassword({
      name: 'test-pass',
    })
    expect(res.data.name).toBe('test-pass')
    appPass = res.data.password
  })

  it('creates a session with an app-specific password', async () => {
    const res = await appAgent.login({
      identifier: 'alice.test',
      password: appPass,
    })
    expect(res.data.did).toEqual(accntAgent.session?.did)
  })

  it('creates an access token for an app with a restricted scope', () => {
    const decoded = jwt.decode(appAgent.session?.accessJwt ?? '', {
      json: true,
    })
    expect(decoded?.scope).toEqual('com.atproto.appPass')
  })

  it('allows actions to be performed from app', async () => {
    await appAgent.api.app.bsky.feed.post.create(
      {
        repo: appAgent.session?.did,
      },
      {
        text: 'Testing testing',
        createdAt: new Date().toISOString(),
      },
    )
  })

  it('restricts certain actions', async () => {
    const attempt = appAgent.api.com.atproto.server.createAppPassword({
      name: 'another-one',
    })
    await expect(attempt).rejects.toThrow('Token could not be verified')
  })

  it('persists scope across refreshes', async () => {
    const session = await appAgent.api.com.atproto.server.refreshSession(
      undefined,
      {
        headers: {
          authorization: `Bearer ${appAgent.session?.refreshJwt}`,
        },
      },
    )

    await appAgent.api.app.bsky.feed.post.create(
      {
        repo: appAgent.session?.did,
      },
      {
        text: 'Testing testing',
        createdAt: new Date().toISOString(),
      },
      {
        authorization: `Bearer ${session.data.accessJwt}`,
      },
    )

    const attempt = appAgent.api.com.atproto.server.createAppPassword(
      {
        name: 'another-one',
      },
      {
        encoding: 'application/json',
        headers: { authorization: `Bearer ${session.data.accessJwt}` },
      },
    )
    await expect(attempt).rejects.toThrow('Token could not be verified')
  })

  it('lists available app-specific passwords', async () => {
    const res = await appAgent.api.com.atproto.server.listAppPasswords()
    expect(res.data.passwords.length).toBe(1)
    expect(res.data.passwords[0].name).toEqual('test-pass')
  })

  it('revokes an app-specific password', async () => {
    await appAgent.api.com.atproto.server.revokeAppPassword({
      name: 'test-pass',
    })
  })

  it('no longer allows session refresh after revocation', async () => {
    const attempt = appAgent.api.com.atproto.server.refreshSession(undefined, {
      headers: {
        authorization: `Bearer ${appAgent.session?.refreshJwt}`,
      },
    })
    await expect(attempt).rejects.toThrow('Token has been revoked')
  })

  it('no longer allows session creation after revocation', async () => {
    const newAgent = new AtpAgent({ service: server.url })
    const attempt = newAgent.login({
      identifier: 'alice.test',
      password: appPass,
    })
    await expect(attempt).rejects.toThrow('Invalid identifier or password')
  })
})
