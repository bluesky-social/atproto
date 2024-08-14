import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
import usersSeed from './seeds/users'
import { AuthScope } from '../dist/auth-verifier'

describe('user preferences', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let appPassHeaders: { authorization: string }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'preferences',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    const appPass = await network.pds.ctx.accountManager.createAppPassword(
      sc.dids.alice,
      'test app pass',
      false,
    )
    const res = await agent.com.atproto.server.createSession({
      identifier: sc.dids.alice,
      password: appPass.password,
    })
    appPassHeaders = { authorization: `Bearer ${res.data.accessJwt}` }
  })

  afterAll(async () => {
    await network.close()
  })

  it('requires auth to set or put preferences.', async () => {
    const tryPut = agent.api.app.bsky.actor.putPreferences({
      preferences: [
        { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
      ],
    })
    await expect(tryPut).rejects.toThrow('Authentication Required')
    const tryGet = agent.api.app.bsky.actor.getPreferences()
    await expect(tryGet).rejects.toThrow('Authentication Required')
  })

  it('gets preferences, before any are set.', async () => {
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({
      preferences: [],
    })
  })

  it('only gets preferences in app.bsky namespace.', async () => {
    await network.pds.ctx.actorStore.transact(sc.dids.alice, (store) =>
      store.pref.putPreferences(
        [{ $type: 'com.atproto.server.defs#unknown' }],
        'com.atproto',
        AuthScope.Access,
      ),
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({ preferences: [] })
  })

  it('puts preferences, all creates.', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'dogs',
            visibility: 'show',
          },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'cats',
            visibility: 'warn',
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({
      preferences: [
        { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'dogs',
          visibility: 'show',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'cats',
          visibility: 'warn',
        },
      ],
    })
    // Ensure other prefs were not clobbered
    const otherPrefs = await network.pds.ctx.actorStore.read(
      sc.dids.alice,
      (store) => store.pref.getPreferences('com.atproto', AuthScope.Access),
    )
    expect(otherPrefs).toEqual([{ $type: 'com.atproto.server.defs#unknown' }])
  })

  it('puts preferences, updates and removals.', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: true },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'dogs',
            visibility: 'warn',
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({
      preferences: [
        { $type: 'app.bsky.actor.defs#adultContentPref', enabled: true },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'dogs',
          visibility: 'warn',
        },
      ],
    })
  })

  it('puts preferences, clearing them.', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      { preferences: [] },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({ preferences: [] })
  })

  it('fails putting preferences outside namespace.', async () => {
    const tryPut = agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
          {
            $type: 'com.atproto.server.defs#unknown',
            hello: 'world',
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    await expect(tryPut).rejects.toThrow(
      'Some preferences are not in the app.bsky namespace',
    )
  })

  it('fails putting preferences without $type.', async () => {
    const tryPut = agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
          {
            label: 'dogs',
            visibility: 'warn',
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    await expect(tryPut).rejects.toThrow(
      'Input/preferences/1 must be an object which includes the "$type" property',
    )
  })

  it('does not read permissioned preferences with an app password', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          {
            $type: 'app.bsky.actor.defs#personalDetailsPref',
            birthDate: new Date().toISOString(),
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const res = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: appPassHeaders },
    )
    expect(res.data.preferences).toEqual([])
  })

  it('does not write permissioned preferences with an app password', async () => {
    const tryPut = agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          {
            $type: 'app.bsky.actor.defs#personalDetailsPref',
            birthDate: new Date().toISOString(),
          },
        ],
      },
      { headers: appPassHeaders, encoding: 'application/json' },
    )
    await expect(tryPut).rejects.toThrow(
      /Do not have authorization to set preferences/,
    )
  })

  it('does not remove permissioned preferences with an app password', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [],
      },
      { headers: appPassHeaders, encoding: 'application/json' },
    )
    const res = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    const scopedPref = res.data.preferences.find(
      (pref) => pref.$type === 'app.bsky.actor.defs#personalDetailsPref',
    )
    expect(scopedPref).toBeDefined()
  })
})
