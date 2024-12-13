import { AtpAgent } from '@atproto/api'
import {
  TestNetwork,
  SeedClient,
  RecordRef,
  basicSeed,
  usersSeed,
} from '@atproto/dev-env'
import { isRecord as isProfile } from '../../src/lexicon/types/app/bsky/actor/profile'
import { forSnapshot } from '../_util'
import assert from 'assert'
import { ids } from '../../src/lexicon/lexicons'

describe('vouches', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_vouches',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    await network.processAll()
  })

  beforeAll(async () => {
    const bobVouch = await sc.vouch(bob, alice, 'verifiedBy')
    await sc.acceptVouch(alice, bobVouch)
    const carolVouch = await sc.vouch(carol, alice, 'friendOf')
    await sc.acceptVouch(alice, carolVouch)
    await sc.vouch(carol, alice, 'colleagueOf')

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('blah', async () => {
    const res = await agent.app.bsky.graph.getVouchesReceived({ actor: alice })
    console.log(res.data)
  })

  // it('gets starter pack used on profile detail', async () => {
  //   const { data: profile } = await agent.api.app.bsky.actor.getProfile({
  //     actor: sc.dids.newskie1,
  //   })
  //   expect(forSnapshot(profile.joinedViaStarterPack)).toMatchSnapshot()
  // })

  // it('gets starter pack details', async () => {
  //   const {
  //     data: { starterPack },
  //   } = await agent.api.app.bsky.graph.getStarterPack({
  //     // resolve w/ handle in uri
  //     starterPack: sp1.uriStr,
  //   })
  //   expect(forSnapshot(starterPack)).toMatchSnapshot()
  // })

  // it('gets starter pack details with handle in uri', async () => {
  //   const {
  //     data: { starterPack },
  //   } = await agent.api.app.bsky.graph.getStarterPack({
  //     // resolve w/ handle in uri
  //     starterPack: sp1.uriStr.replace(
  //       sc.dids.alice,
  //       sc.accounts[sc.dids.alice].handle,
  //     ),
  //   })
  //   expect(starterPack.uri).toBe(sp1.uriStr)
  // })

  // it('gets starter pack details', async () => {
  //   const {
  //     data: { starterPacks },
  //   } = await agent.api.app.bsky.graph.getStarterPacks({
  //     uris: [sp2.uriStr, sp1.uriStr],
  //   })
  //   expect(forSnapshot(starterPacks)).toMatchSnapshot()
  // })

  // it('generates notifications', async () => {
  //   const {
  //     data: { notifications },
  //   } = await agent.api.app.bsky.notification.listNotifications(
  //     { limit: 3 }, // three most recent
  //     {
  //       headers: await network.serviceHeaders(
  //         sc.dids.alice,
  //         ids.AppBskyNotificationListNotifications,
  //       ),
  //     },
  //   )
  //   expect(notifications).toHaveLength(3)
  //   notifications.forEach((notif) => {
  //     expect(notif.reason).toBe('starterpack-joined')
  //     expect(notif.reasonSubject).toBe(sp1.uriStr)
  //     expect(notif.uri).toMatch(/\/app\.bsky\.actor\.profile\/self$/)
  //     assert(isProfile(notif.record), 'record is not profile')
  //     expect(notif.record.joinedViaStarterPack?.uri).toBe(sp1.uriStr)
  //   })
  //   expect(forSnapshot(notifications)).toMatchSnapshot()
  // })

  // it('does not include users with creator block relationship in list sample for non-creator, in-list viewers', async () => {
  //   const view = await agent.api.app.bsky.graph.getStarterPack(
  //     {
  //       starterPack: sp3.uriStr,
  //     },
  //     {
  //       headers: await network.serviceHeaders(
  //         sc.dids.frankie,
  //         ids.AppBskyGraphGetStarterPack,
  //       ),
  //     },
  //   )
  //   expect(view.data.starterPack.listItemsSample?.length).toBe(2)
  //   expect(forSnapshot(view.data.starterPack.listItemsSample)).toMatchSnapshot()
  // })

  // it('does not include users with creator block relationship in list sample for non-creator, not-in-list viewers', async () => {
  //   const view = await agent.api.app.bsky.graph.getStarterPack(
  //     {
  //       starterPack: sp3.uriStr,
  //     },
  //     {
  //       headers: await network.serviceHeaders(
  //         sc.dids.bob,
  //         ids.AppBskyGraphGetStarterPack,
  //       ),
  //     },
  //   )
  //   expect(view.data.starterPack.listItemsSample?.length).toBe(2)
  //   expect(forSnapshot(view.data.starterPack.listItemsSample)).toMatchSnapshot()
  // })

  // it('does not include users with creator block relationship in list sample for signed-out viewers', async () => {
  //   const view = await agent.api.app.bsky.graph.getStarterPack({
  //     starterPack: sp3.uriStr,
  //   })
  //   expect(view.data.starterPack.listItemsSample?.length).toBe(2)
  //   expect(forSnapshot(view.data.starterPack.listItemsSample)).toMatchSnapshot()
  // })

  // it('does include users with creator block relationship in list sample for creator', async () => {
  //   const view = await agent.api.app.bsky.graph.getStarterPack(
  //     { starterPack: sp3.uriStr },
  //     {
  //       headers: await network.serviceHeaders(
  //         sc.dids.alice,
  //         ids.AppBskyGraphGetStarterPack,
  //       ),
  //     },
  //   )
  //   expect(view.data.starterPack.listItemsSample?.length).toBe(3)
  //   expect(forSnapshot(view.data.starterPack.listItemsSample)).toMatchSnapshot()
  // })

  // describe('searchStarterPacks', () => {
  //   it('searches starter packs and returns paginated', async () => {
  //     const { data: page0 } = await agent.app.bsky.graph.searchStarterPacks({
  //       q: 'starter',
  //       limit: 3,
  //     })

  //     expect(page0.starterPacks).toMatchObject([
  //       expect.objectContaining({ uri: sp4.uriStr }),
  //       expect.objectContaining({ uri: sp3.uriStr }),
  //       expect.objectContaining({ uri: sp2.uriStr }),
  //     ])

  //     const { data: page1 } = await agent.api.app.bsky.graph.searchStarterPacks(
  //       {
  //         q: 'starter',
  //         limit: 3,
  //         cursor: page0.cursor,
  //       },
  //     )

  //     expect(page1.starterPacks).toMatchObject([
  //       expect.objectContaining({ uri: sp1.uriStr }),
  //     ])
  //   })

  //   it('filters by the search term', async () => {
  //     const { data } = await agent.app.bsky.graph.searchStarterPacks({
  //       q: 'In CaSe',
  //       limit: 3,
  //     })

  //     expect(data.starterPacks).toMatchObject([
  //       expect.objectContaining({ uri: sp4.uriStr }),
  //     ])
  //   })

  //   it('does not include starter packs with creator block relationship for non-creator viewers', async () => {
  //     const { data } = await agent.app.bsky.graph.searchStarterPacks(
  //       { q: 'starter', limit: 3 },
  //       {
  //         headers: await network.serviceHeaders(
  //           sc.dids.frankie,
  //           ids.AppBskyGraphSearchStarterPacks,
  //         ),
  //       },
  //     )

  //     expect(data.starterPacks).toMatchObject([
  //       expect.objectContaining({ uri: sp4.uriStr }),
  //     ])
  //   })
  // })
})
