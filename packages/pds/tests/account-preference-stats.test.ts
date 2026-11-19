import type { AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import type { Unknown$Type } from '@atproto/lex'
import type { DidString } from '@atproto/syntax'
import { app } from '../src/lexicons/index.js'
import usersSeed from './seeds/users.js'

describe('admin account preference stats', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let alice: DidString
  let bob: DidString
  let carol: DidString

  const feedUri = (rkey: string) =>
    `at://did:plc:secretfeedauthor/app.bsky.feed.generator/${rkey}`
  const listUri = `at://did:plc:secretlistauthor/app.bsky.graph.list/secretlist`
  // multi-byte characters make UTF-8 and UTF-16 lengths differ
  const mutedWordValues = ['secret-word-one', 'sécrèt-wörd-two', '秘密の言葉🙈']
  const birthDate = '1990-06-15T00:00:00.000Z'

  const alicePrefs = [
    { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
    {
      $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
      items: [
        { id: 'item-1', type: 'timeline', value: 'following', pinned: true },
        { id: 'item-2', type: 'feed', value: feedUri('one'), pinned: true },
        { id: 'item-3', type: 'feed', value: feedUri('two'), pinned: false },
        { id: 'item-4', type: 'list', value: listUri, pinned: false },
      ],
    },
    {
      $type: 'app.bsky.actor.defs#savedFeedsPref',
      saved: [feedUri('one'), feedUri('two'), feedUri('three')],
      pinned: [feedUri('one')],
    },
    {
      $type: 'app.bsky.actor.defs#mutedWordsPref',
      items: mutedWordValues.map((value) => ({
        value,
        targets: ['content', 'tag'],
      })),
    },
    { $type: 'app.bsky.actor.defs#personalDetailsPref', birthDate },
  ]

  const getStats = (
    did: string,
    headers: Record<string, string> = network.pds.adminAuthHeaders(),
  ) => agent.com.atproto.admin.getAccountPreferenceStats({ did }, { headers })

  const insertRawPref = (did: DidString, name: string, valueJson: string) =>
    network.pds.ctx.actorStore.transact(did, (store) =>
      store.pref.db.db
        .insertInto('account_pref')
        .values({ name, valueJson })
        .execute(),
    )

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_preference_stats',
    })
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol

    await agent.app.bsky.actor.putPreferences(
      { preferences: alicePrefs },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    // outside the app.bsky namespace, so not part of the putPreferences body
    await network.pds.ctx.actorStore.transact(alice, (store) =>
      store.pref.putPreferences(
        [{ $type: 'com.atproto.server.defs#unknown' as Unknown$Type }],
        'com.atproto',
        { hasAccessFull: true },
      ),
    )
  }, 20_000) // @NOTE seeding can take a while

  afterAll(async () => {
    await network?.close()
  })

  it('counts saved feeds, legacy saved feeds and muted words.', async () => {
    const { data } = await getStats(alice)
    expect(data.did).toBe(alice)
    expect(data.preferenceCount).toBe(alicePrefs.length)
    expect(data.savedFeeds).toEqual({ items: 4, pinned: 2 })
    expect(data.legacySavedFeeds).toEqual({ saved: 3, pinned: 1 })
    expect(data.mutedWords).toEqual({ items: 3 })
    expect(data.byType.map((t) => t.type).sort()).toEqual(
      alicePrefs.map((p) => p.$type).sort(),
    )
    for (const typeStats of data.byType) {
      expect(typeStats.count).toBe(1)
    }
  })

  it('measures the putPreferences body in UTF-8 bytes.', async () => {
    // What a client gets back and would send to putPreferences, less the
    // preference the server derives from personalDetailsPref.
    const { data: stored } = await agent.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(alice) },
    )
    const preferences = stored.preferences.filter(
      (p) => p.$type !== app.bsky.actor.defs.declaredAgePref.$type,
    )
    expect(preferences).toHaveLength(alicePrefs.length)
    const body = JSON.stringify({ preferences })
    expect(Buffer.byteLength(body)).toBeGreaterThan(body.length)

    const { data } = await getStats(alice)
    expect(data.bodyBytes).toBe(Buffer.byteLength(body))

    const expectedByType = preferences
      .map((pref) => ({
        type: pref.$type,
        count: 1,
        bytes: Buffer.byteLength(JSON.stringify(pref)),
      }))
      .sort((a, b) => b.bytes - a.bytes)
    expect(data.byType).toEqual(expectedByType)
  })

  it('returns no preference contents.', async () => {
    const { data } = await getStats(alice)
    const serialized = JSON.stringify(data)
    for (const secret of [
      'following',
      'secretfeedauthor',
      'secretlistauthor',
      'item-1',
      birthDate,
      ...mutedWordValues,
    ]) {
      expect(serialized).not.toContain(secret)
    }

    // the only strings are the did and the preference types
    const strings: string[] = []
    const collect = (value: unknown) => {
      if (typeof value === 'string') strings.push(value)
      else if (value && typeof value === 'object') {
        Object.values(value).forEach(collect)
      }
    }
    collect(data)
    expect(strings.sort()).toEqual(
      [alice, ...alicePrefs.map((p) => p.$type)].sort(),
    )
  })

  it('returns zeros for an account without preferences.', async () => {
    const { data } = await getStats(carol)
    expect(data).toEqual({
      did: carol,
      bodyBytes: Buffer.byteLength(JSON.stringify({ preferences: [] })),
      preferenceCount: 0,
      byType: [],
      savedFeeds: { items: 0, pinned: 0 },
      legacySavedFeeds: { saved: 0, pinned: 0 },
      mutedWords: { items: 0 },
    })
  })

  it('counts what it can of malformed preferences.', async () => {
    const rows: [string, string][] = [
      [
        'app.bsky.actor.defs#savedFeedsPrefV2',
        JSON.stringify({
          $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
          items: [1, 'two', null, { pinned: 'yes' }, { pinned: true }],
        }),
      ],
      [
        'app.bsky.actor.defs#savedFeedsPrefV2',
        JSON.stringify({ $type: 'app.bsky.actor.defs#savedFeedsPrefV2' }),
      ],
      [
        'app.bsky.actor.defs#savedFeedsPref',
        JSON.stringify({ saved: { length: 5 }, pinned: [feedUri('x')] }),
      ],
      ['app.bsky.actor.defs#mutedWordsPref', '{"items": [1, 2'],
      ['app.bsky.actor.defs#mutedWordsPref', 'null'],
      ['app.bsky.actor.defs#hiddenPostsPref', '"not an object"'],
    ]
    for (const [name, valueJson] of rows) {
      await insertRawPref(bob, name, valueJson)
    }

    const { data } = await getStats(bob)
    expect(data.preferenceCount).toBe(rows.length)
    expect(data.savedFeeds).toEqual({ items: 5, pinned: 1 })
    expect(data.legacySavedFeeds).toEqual({ saved: 0, pinned: 1 })
    expect(data.mutedWords).toEqual({ items: 0 })
    expect(data.bodyBytes).toBe(
      Buffer.byteLength(`{"preferences":[${rows.map((r) => r[1]).join(',')}]}`),
    )
    expect(data.byType.find((t) => t.type === rows[0][0])).toEqual({
      type: rows[0][0],
      count: 2,
      bytes: Buffer.byteLength(rows[0][1]) + Buffer.byteLength(rows[1][1]),
    })
    const sizes = data.byType.map((t) => t.bytes)
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
  })

  it('fails for an unknown account.', async () => {
    await expect(getStats('did:plc:unknownaccount')).rejects.toMatchObject({
      error: 'NotFound',
      message: 'Account not found',
    })
  })

  it('requires admin auth.', async () => {
    await expect(getStats(alice, {})).rejects.toThrow('Authentication Required')
    await expect(getStats(alice, sc.getHeaders(alice))).rejects.toThrow(
      'Authentication Required',
    )
    await expect(
      getStats(alice, {
        authorization: `Basic ${Buffer.from('admin:wrong').toString('base64')}`,
      }),
    ).rejects.toThrow('Authentication Required')
  })
})
