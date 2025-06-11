import * as jose from 'jose'
import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'

describe('app_passwords', () => {
  let network: TestNetworkNoAppView
  let accntAgent: AtpAgent
  let appAgent: AtpAgent
  let priviAgent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'app_passwords',
    })
    accntAgent = network.pds.getClient()
    appAgent = network.pds.getClient()
    priviAgent = network.pds.getClient()

    await accntAgent.createAccount({
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
  })

  afterAll(async () => {
    await network.close()
  })

  let appPass: string
  let privilegedAppPass: string

  it('creates an app-specific password', async () => {
    const res = await accntAgent.api.com.atproto.server.createAppPassword({
      name: 'test-pass',
    })
    expect(res.data.name).toBe('test-pass')
    expect(res.data.privileged).toBe(false)
    appPass = res.data.password
  })

  it('creates a privileged app-specific password', async () => {
    const res = await accntAgent.api.com.atproto.server.createAppPassword({
      name: 'privi-pass',
      privileged: true,
    })
    expect(res.data.name).toBe('privi-pass')
    expect(res.data.privileged).toBe(true)
    privilegedAppPass = res.data.password
  })

  it('creates a session with an app-specific password', async () => {
    const res1 = await appAgent.login({
      identifier: 'alice.test',
      password: appPass,
    })
    expect(res1.data.did).toEqual(accntAgent.session?.did)
    const res2 = await priviAgent.login({
      identifier: 'alice.test',
      password: privilegedAppPass,
    })
    expect(res2.data.did).toEqual(accntAgent.session?.did)
  })

  it('creates an access token for an app with a restricted scope', () => {
    const decoded = jose.decodeJwt(appAgent.session?.accessJwt ?? '')
    expect(decoded?.scope).toEqual('com.atproto.appPass')

    const decodedPrivi = jose.decodeJwt(priviAgent.session?.accessJwt ?? '')
    expect(decodedPrivi?.scope).toEqual('com.atproto.appPassPrivileged')
  })

  it('allows actions to be performed from app', async () => {
    await appAgent.api.app.bsky.feed.post.create(
      {
        repo: appAgent.assertDid,
      },
      {
        text: 'Testing testing',
        createdAt: new Date().toISOString(),
      },
    )
    await priviAgent.api.app.bsky.feed.post.create(
      {
        repo: priviAgent.assertDid,
      },
      {
        text: 'testing again',
        createdAt: new Date().toISOString(),
      },
    )
  })

  it('restricts full access actions', async () => {
    const attempt1 = appAgent.api.com.atproto.server.createAppPassword({
      name: 'another-one',
    })
    await expect(attempt1).rejects.toThrow('Bad token scope')
    const attempt2 = priviAgent.api.com.atproto.server.createAppPassword({
      name: 'another-one',
    })
    await expect(attempt2).rejects.toThrow('Bad token scope')
  })

  it('restricts privileged app password actions', async () => {
    const attempt = appAgent.api.chat.bsky.convo.listConvos({})
    await expect(attempt).rejects.toThrow('Bad token method')
  })

  it('restricts privileged app password actions', async () => {
    const attempt = appAgent.api.chat.bsky.convo.listConvos()
    await expect(attempt).rejects.toThrow('Bad token method')
  })

  it('restricts service auth token methods for non-privileged access tokens', async () => {
    const attempt = appAgent.api.com.atproto.server.getServiceAuth({
      aud: 'did:example:test',
      lxm: 'com.atproto.server.createAccount',
    })
    await expect(attempt).rejects.toThrow(
      /insufficient access to request a service auth token for the following method/,
    )
  })

  it('allows privileged service auth token scopes for privileged access tokens', async () => {
    await priviAgent.api.com.atproto.server.getServiceAuth({
      aud: 'did:example:test',
      lxm: 'com.atproto.server.createAccount',
    })
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

    // allows any access auth
    await appAgent.api.app.bsky.feed.post.create(
      {
        repo: appAgent.assertDid,
      },
      {
        text: 'Testing testing',
        createdAt: new Date().toISOString(),
      },
      {
        authorization: `Bearer ${session.data.accessJwt}`,
      },
    )

    // allows privileged app passwords or higher
    const priviAttempt = appAgent.api.com.atproto.server.getServiceAuth({
      aud: 'did:example:test',
      lxm: 'com.atproto.server.createAccount',
    })
    await expect(priviAttempt).rejects.toThrow(
      /insufficient access to request a service auth token for the following method/,
    )

    // allows only full access auth
    const fullAttempt = appAgent.api.com.atproto.server.createAppPassword(
      {
        name: 'another-one',
      },
      {
        encoding: 'application/json',
        headers: { authorization: `Bearer ${session.data.accessJwt}` },
      },
    )
    await expect(fullAttempt).rejects.toThrow('Bad token scope')
  })

  it('persists privileged scope across refreshes', async () => {
    const session = await priviAgent.api.com.atproto.server.refreshSession(
      undefined,
      {
        headers: {
          authorization: `Bearer ${priviAgent.session?.refreshJwt}`,
        },
      },
    )

    // allows any access auth
    await priviAgent.api.app.bsky.feed.post.create(
      {
        repo: priviAgent.assertDid,
      },
      {
        text: 'Testing testing',
        createdAt: new Date().toISOString(),
      },
      {
        authorization: `Bearer ${session.data.accessJwt}`,
      },
    )

    // allows privileged app passwords or higher
    await priviAgent.api.com.atproto.server.getServiceAuth({
      aud: 'did:example:test',
    })

    // allows only full access auth
    const attempt = priviAgent.api.com.atproto.server.createAppPassword(
      {
        name: 'another-one',
      },
      {
        encoding: 'application/json',
        headers: { authorization: `Bearer ${session.data.accessJwt}` },
      },
    )
    await expect(attempt).rejects.toThrow('Bad token scope')
  })

  it('lists available app-specific passwords', async () => {
    const res = await appAgent.api.com.atproto.server.listAppPasswords()
    expect(res.data.passwords.length).toBe(2)
    expect(res.data.passwords[0].name).toEqual('privi-pass')
    expect(res.data.passwords[0].privileged).toEqual(true)
    expect(res.data.passwords[1].name).toEqual('test-pass')
    expect(res.data.passwords[1].privileged).toEqual(false)
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
    const newAgent = network.pds.getClient()
    const attempt = newAgent.login({
      identifier: 'alice.test',
      password: appPass,
    })
    await expect(attempt).rejects.toThrow('Invalid identifier or password')
  })
})
