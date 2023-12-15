import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import usersSeed from './seeds/users'

describe('user preferences', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'preferences',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
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
      (store) => store.pref.getPreferences('com.atproto'),
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
})
