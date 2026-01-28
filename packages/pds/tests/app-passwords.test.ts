import assert from 'node:assert'
import * as jose from 'jose'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { PasswordSession } from '@atproto/lex-password-session'
import { app, chat, com } from '../src'

describe('app_passwords', () => {
  let network: TestNetworkNoAppView
  let accntClient: Client
  let appClient: Client
  let priviClient: Client

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'app_passwords',
    })
  })

  afterAll(async () => {
    await network.close()
  })

  let appPass: string

  it('creates an account', async () => {
    const accntSession = await PasswordSession.createAccount(
      {
        handle: 'alice.test',
        email: 'alice@test.com',
        password: 'alice-pass',
      },
      {
        service: network.pds.url,
      },
    )

    accntClient = new Client(accntSession)
  })

  it('creates an app-specific password', async () => {
    const res = await accntClient.call(com.atproto.server.createAppPassword, {
      name: 'test-pass',
    })
    expect(res.name).toBe('test-pass')
    expect(res.privileged).toBe(false)

    const session = await PasswordSession.login({
      service: network.pds.url,
      identifier: 'alice.test',
      password: res.password,
    })

    expect(session.did).toEqual(accntClient.did)
    const decoded = jose.decodeJwt(session.session.accessJwt)
    expect(decoded?.scope).toEqual('com.atproto.appPass')

    appPass = res.password
    appClient = new Client(session)
  })

  it('creates a privileged app-specific password', async () => {
    const res = await accntClient.call(com.atproto.server.createAppPassword, {
      name: 'privi-pass',
      privileged: true,
    })
    expect(res.name).toBe('privi-pass')
    expect(res.privileged).toBe(true)

    const session = await PasswordSession.login({
      service: network.pds.url,
      identifier: 'alice.test',
      password: res.password,
    })
    const decoded = jose.decodeJwt(session.session.accessJwt)
    expect(decoded?.scope).toEqual('com.atproto.appPassPrivileged')

    expect(session.did).toEqual(accntClient.did)

    priviClient = new Client(session)
  })

  it('allows actions to be performed from app', async () => {
    await appClient.create(app.bsky.feed.post, {
      text: 'Testing testing',
      createdAt: new Date().toISOString(),
    })
    await priviClient.create(app.bsky.feed.post, {
      text: 'testing again',
      createdAt: new Date().toISOString(),
    })
  })

  it('restricts full access actions', async () => {
    const attempt1 = appClient.call(com.atproto.server.createAppPassword, {
      name: 'another-one',
    })
    await expect(attempt1).rejects.toThrow('Bad token scope')
    const attempt2 = priviClient.call(com.atproto.server.createAppPassword, {
      name: 'another-one',
    })
    await expect(attempt2).rejects.toThrow('Bad token scope')
  })

  it('restricts privileged app password actions', async () => {
    const attempt = appClient.call(chat.bsky.convo.listConvos)
    await expect(attempt).rejects.toThrow('Bad token method')
  })

  it('restricts privileged app password actions', async () => {
    const attempt = appClient.call(chat.bsky.convo.listConvos)
    await expect(attempt).rejects.toThrow('Bad token method')
  })

  it('restricts service auth token methods for non-privileged access tokens', async () => {
    const attempt = appClient.call(com.atproto.server.getServiceAuth, {
      aud: 'did:example:test',
      lxm: 'com.atproto.server.createAccount',
    })
    await expect(attempt).rejects.toThrow(
      /insufficient access to request a service auth token for the following method/,
    )
  })

  it('allows privileged service auth token scopes for privileged access tokens', async () => {
    await priviClient.call(com.atproto.server.getServiceAuth, {
      aud: 'did:example:test',
      lxm: 'com.atproto.server.createAccount',
    })
  })

  it('persists scope across refreshes', async () => {
    assert(appClient.agent instanceof PasswordSession)
    await appClient.agent.refresh()

    // allows any access auth
    await appClient.create(app.bsky.feed.post, {
      text: 'Testing testing',
      createdAt: new Date().toISOString(),
    })

    // allows privileged app passwords or higher
    const priviAttempt = appClient.call(com.atproto.server.getServiceAuth, {
      aud: 'did:example:test',
      lxm: 'com.atproto.server.createAccount',
    })
    await expect(priviAttempt).rejects.toThrow(
      /insufficient access to request a service auth token for the following method/,
    )

    // allows only full access auth
    const fullAttempt = appClient.call(com.atproto.server.createAppPassword, {
      name: 'another-one',
    })
    await expect(fullAttempt).rejects.toThrow('Bad token scope')
  })

  it('persists privileged scope across refreshes', async () => {
    assert(priviClient.agent instanceof PasswordSession)
    await priviClient.agent.refresh()

    // allows any access auth
    await priviClient.create(app.bsky.feed.post, {
      text: 'Testing testing',
      createdAt: new Date().toISOString(),
    })

    // allows privileged app passwords or higher
    await priviClient.call(com.atproto.server.getServiceAuth, {
      aud: 'did:example:test',
    })

    // allows only full access auth
    const attempt = priviClient.call(com.atproto.server.createAppPassword, {
      name: 'another-one',
    })
    await expect(attempt).rejects.toThrow('Bad token scope')
  })

  it('lists available app-specific passwords', async () => {
    const res = await appClient.call(com.atproto.server.listAppPasswords)
    expect(res.passwords.length).toBe(2)
    expect(res.passwords[0].name).toEqual('privi-pass')
    expect(res.passwords[0].privileged).toEqual(true)
    expect(res.passwords[1].name).toEqual('test-pass')
    expect(res.passwords[1].privileged).toEqual(false)
  })

  it('revokes an app-specific password', async () => {
    await appClient.call(com.atproto.server.revokeAppPassword, {
      name: 'test-pass',
    })
  })

  it('no longer allows session refresh after revocation', async () => {
    assert(appClient.agent instanceof PasswordSession)
    await expect(appClient.agent.refresh()).rejects.toThrow(
      'Token has been revoked',
    )
  })

  it('no longer allows session creation after revocation', async () => {
    const attempt = PasswordSession.login({
      service: network.pds.url,
      identifier: 'alice.test',
      password: appPass,
    })
    await expect(attempt).rejects.toThrow('Invalid identifier or password')
  })
})
