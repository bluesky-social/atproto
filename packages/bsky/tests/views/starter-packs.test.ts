import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed, RecordRef } from '@atproto/dev-env'
import { isRecord as isProfile } from '../../src/lexicon/types/app/bsky/actor/profile'
import { forSnapshot } from '../_util'
import assert from 'assert'

describe('starter packs', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let sp1: RecordRef
  let sp2: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_starter_packs',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeAll(async () => {
    const feedgen = await sc.createFeedGen(
      sc.dids.alice,
      'did:web:example.com',
      "alice's feedgen",
    )
    sp1 = await sc.createStarterPack(
      sc.dids.alice,
      "alice's starter pack",
      [sc.dids.bob, sc.dids.carol, sc.dids.dan],
      [feedgen.uriStr],
    )
    sp2 = await sc.createStarterPack(
      sc.dids.alice,
      "alice's empty starter pack",
      [],
      [],
    )
    for (const n of [1, 2, 3]) {
      const { did } = await sc.createAccount(`newskie${n}`, {
        handle: `newskie${n}.test`,
        email: `newskie${n}@test.com`,
        password: `newskie${n}-pass`,
      })
      await sc.createProfile(did, `Newskie ${n}`, 'New here', [], sp1)
    }
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('gets actor starter packs.', async () => {
    const { data } = await agent.api.app.bsky.graph.getActorStarterPacks({
      actor: sc.dids.alice,
    })
    expect(data.starterPacks).toHaveLength(2)
    expect(forSnapshot(data.starterPacks)).toMatchSnapshot()
  })

  it('gets starter pack used on profile detail', async () => {
    const { data: profile } = await agent.api.app.bsky.actor.getProfile({
      actor: sc.dids.newskie1,
    })
    expect(forSnapshot(profile.joinedViaStarterPack)).toMatchSnapshot()
  })

  it('gets starter pack details', async () => {
    const {
      data: { starterPack },
    } = await agent.api.app.bsky.graph.getStarterPack({
      // resolve w/ handle in uri
      starterPack: sp1.uriStr,
    })
    expect(forSnapshot(starterPack)).toMatchSnapshot()
  })

  it('gets starter pack details with handle in uri', async () => {
    const {
      data: { starterPack },
    } = await agent.api.app.bsky.graph.getStarterPack({
      // resolve w/ handle in uri
      starterPack: sp1.uriStr.replace(
        sc.dids.alice,
        sc.accounts[sc.dids.alice].handle,
      ),
    })
    expect(starterPack.uri).toBe(sp1.uriStr)
  })

  it('gets starter pack details', async () => {
    const {
      data: { starterPacks },
    } = await agent.api.app.bsky.graph.getStarterPacks({
      uris: [sp2.uriStr, sp1.uriStr],
    })
    expect(forSnapshot(starterPacks)).toMatchSnapshot()
  })

  it('generates notifications', async () => {
    const {
      data: { notifications },
    } = await agent.api.app.bsky.notification.listNotifications(
      { limit: 3 }, // three most recent
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    expect(notifications).toHaveLength(3)
    notifications.forEach((notif) => {
      expect(notif.reason).toBe('starterpack-joined')
      expect(notif.reasonSubject).toBe(sp1.uriStr)
      expect(notif.uri).toMatch(/\/app\.bsky\.actor\.profile\/self$/)
      assert(isProfile(notif.record), 'record is not profile')
      expect(notif.record.joinedViaStarterPack?.uri).toBe(sp1.uriStr)
    })
    expect(forSnapshot(notifications)).toMatchSnapshot()
  })
})
