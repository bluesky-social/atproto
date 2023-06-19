import AtpAgent from '@atproto/api'
import { CloseFn, runTestServer, TestServerInfo } from './_util'
import { SeedClient } from './seeds/client'
import usersSeed from './seeds/users'

describe('user preferences', () => {
  let server: TestServerInfo
  let close: CloseFn
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'preferences',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await usersSeed(sc)
  })

  afterAll(async () => {
    await close()
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
    const { db, services } = server.ctx
    await db.transaction(async (tx) => {
      await services
        .account(tx)
        .putPreferences(
          sc.dids.alice,
          [{ $type: 'com.atproto.server.defs#unknown' }],
          'com.atproto',
        )
    })
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
    const { db, services } = server.ctx
    const otherPrefs = await services
      .account(db)
      .getPreferences(sc.dids.alice, 'com.atproto')
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
