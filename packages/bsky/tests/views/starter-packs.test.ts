import assert from 'node:assert'
import { AtpAgent, asPredicate } from '@atproto/api'
import { RecordRef, SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { validateRecord as validateProfileRecord } from '../../src/lexicon/types/app/bsky/actor/profile'
import {
  OutputSchema as GetStarterPacksWithMembershipOutputSchema,
  StarterPackWithMembership,
} from '../../src/lexicon/types/app/bsky/graph/getStarterPacksWithMembership'
import { forSnapshot, paginateAll } from '../_util'

const isValidProfile = asPredicate(validateProfileRecord)

describe('starter packs', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let sp1: RecordRef
  let sp2: RecordRef
  let sp3: RecordRef
  let sp4: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_starter_packs',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

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

    await sc.createAccount('frankie', {
      handle: 'frankie.test',
      email: 'frankie@frankie.com',
      password: 'password',
    })
    await sc.createAccount('greta', {
      handle: 'greta.test',
      email: 'greta@greta.com',
      password: 'password',
    })
    sp3 = await sc.createStarterPack(
      sc.dids.alice,
      "alice's about to get blocked starter pack",
      [sc.dids.alice, sc.dids.frankie, sc.dids.greta],
      [],
    )
    await sc.block(sc.dids.frankie, sc.dids.alice)

    sp4 = await sc.createStarterPack(
      sc.dids.bob,
      "bob's starter pack in case you block alice",
      [sc.dids.alice, sc.dids.frankie],
      [],
    )

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('gets actor starter packs.', async () => {
    const { data } = await agent.api.app.bsky.graph.getActorStarterPacks({
      actor: sc.dids.alice,
    })
    expect(data.starterPacks).toHaveLength(3)
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
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(notifications).toHaveLength(3)
    notifications.forEach((notif) => {
      expect(notif.reason).toBe('starterpack-joined')
      expect(notif.reasonSubject).toBe(sp1.uriStr)
      expect(notif.uri).toMatch(/\/app\.bsky\.actor\.profile\/self$/)
      assert(isValidProfile(notif.record), 'record is not profile')
      expect(notif.record.joinedViaStarterPack?.uri).toBe(sp1.uriStr)
    })
    expect(forSnapshot(notifications)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in list sample for non-creator, in-list viewers', async () => {
    const view = await agent.api.app.bsky.graph.getStarterPack(
      {
        starterPack: sp3.uriStr,
      },
      {
        headers: await network.serviceHeaders(
          sc.dids.frankie,
          ids.AppBskyGraphGetStarterPack,
        ),
      },
    )
    expect(view.data.starterPack.listItemsSample?.length).toBe(2)
    expect(forSnapshot(view.data.starterPack.listItemsSample)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in list sample for non-creator, not-in-list viewers', async () => {
    const view = await agent.api.app.bsky.graph.getStarterPack(
      {
        starterPack: sp3.uriStr,
      },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyGraphGetStarterPack,
        ),
      },
    )
    expect(view.data.starterPack.listItemsSample?.length).toBe(2)
    expect(forSnapshot(view.data.starterPack.listItemsSample)).toMatchSnapshot()
  })

  it('does not include users with creator block relationship in list sample for signed-out viewers', async () => {
    const view = await agent.api.app.bsky.graph.getStarterPack({
      starterPack: sp3.uriStr,
    })
    expect(view.data.starterPack.listItemsSample?.length).toBe(2)
    expect(forSnapshot(view.data.starterPack.listItemsSample)).toMatchSnapshot()
  })

  it('does include users with creator block relationship in list sample for creator', async () => {
    const view = await agent.api.app.bsky.graph.getStarterPack(
      { starterPack: sp3.uriStr },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyGraphGetStarterPack,
        ),
      },
    )
    expect(view.data.starterPack.listItemsSample?.length).toBe(3)
    expect(forSnapshot(view.data.starterPack.listItemsSample)).toMatchSnapshot()
  })

  describe('searchStarterPacks', () => {
    it('searches starter packs and returns paginated', async () => {
      const { data: page0 } = await agent.app.bsky.graph.searchStarterPacks({
        q: 'starter',
        limit: 3,
      })

      expect(page0.starterPacks).toMatchObject([
        expect.objectContaining({ uri: sp4.uriStr }),
        expect.objectContaining({ uri: sp3.uriStr }),
        expect.objectContaining({ uri: sp2.uriStr }),
      ])

      const { data: page1 } = await agent.api.app.bsky.graph.searchStarterPacks(
        {
          q: 'starter',
          limit: 3,
          cursor: page0.cursor,
        },
      )

      expect(page1.starterPacks).toMatchObject([
        expect.objectContaining({ uri: sp1.uriStr }),
      ])
    })

    it('filters by the search term', async () => {
      const { data } = await agent.app.bsky.graph.searchStarterPacks({
        q: 'In CaSe',
        limit: 3,
      })

      expect(data.starterPacks).toMatchObject([
        expect.objectContaining({ uri: sp4.uriStr }),
      ])
    })

    it('does not include starter packs with creator block relationship for non-creator viewers', async () => {
      const { data } = await agent.app.bsky.graph.searchStarterPacks(
        { q: 'starter', limit: 3 },
        {
          headers: await network.serviceHeaders(
            sc.dids.frankie,
            ids.AppBskyGraphSearchStarterPacks,
          ),
        },
      )

      expect(data.starterPacks).toMatchObject([
        expect.objectContaining({ uri: sp4.uriStr }),
      ])
    })
  })

  describe('starter pack membership', () => {
    const membershipsUris = (lwms: StarterPackWithMembership[]): string[] =>
      lwms
        .map((spwm) => spwm.listItem?.uri)
        .filter((li): li is string => typeof li === 'string')

    it('returns all SPs by the user', async () => {
      const view = await agent.app.bsky.graph.getStarterPacksWithMembership(
        { actor: sc.dids.bob },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyGraphGetStarterPacksWithMembership,
          ),
        },
      )
      expect(view.data.starterPacksWithMembership.length).toBe(3)
    })

    it('finds self membership', async () => {
      const view = await agent.app.bsky.graph.getStarterPacksWithMembership(
        { actor: sc.dids.alice },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyGraphGetStarterPacksWithMembership,
          ),
        },
      )

      expect(view.data.starterPacksWithMembership.length).toBe(3)
      const memberships = membershipsUris(view.data.starterPacksWithMembership)
      expect(memberships.length).toBe(1)
    })

    it(`finds other user's membership`, async () => {
      const view = await agent.app.bsky.graph.getStarterPacksWithMembership(
        { actor: sc.dids.bob },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyGraphGetStarterPacksWithMembership,
          ),
        },
      )

      expect(view.data.starterPacksWithMembership.length).toBe(3)
      const memberships = membershipsUris(view.data.starterPacksWithMembership)
      expect(memberships.length).toBe(1)
    })

    it('finds that user has no memberships', async () => {
      // @NOTE: dan is not in bob's SP.
      const view = await agent.app.bsky.graph.getStarterPacksWithMembership(
        { actor: sc.dids.dan },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyGraphGetStarterPacksWithMembership,
          ),
        },
      )

      expect(view.data.starterPacksWithMembership.length).toBe(1)
      const memberships = membershipsUris(view.data.starterPacksWithMembership)
      expect(memberships.length).toBe(0)
    })

    it('finds empty list of SPs if user has none', async () => {
      const view = await agent.app.bsky.graph.getStarterPacksWithMembership(
        { actor: sc.dids.bob },
        {
          headers: await network.serviceHeaders(
            sc.dids.carol,
            ids.AppBskyGraphGetStarterPacksWithMembership,
          ),
        },
      )

      expect(view.data.starterPacksWithMembership.length).toBe(0)
    })

    it('paginates SPs with memberships', async () => {
      const viewer = sc.dids.alice
      const actor = sc.dids.bob

      const results = (out: GetStarterPacksWithMembershipOutputSchema[]) =>
        out.flatMap((res) => res.starterPacksWithMembership)
      const paginator = async (cursor?: string) => {
        const res = await agent.app.bsky.graph.getStarterPacksWithMembership(
          { actor, limit: 2, cursor },
          {
            headers: await network.serviceHeaders(
              viewer,
              ids.AppBskyGraphGetStarterPacksWithMembership,
            ),
          },
        )
        return res.data
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.starterPacksWithMembership.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.app.bsky.graph.getStarterPacksWithMembership(
        { actor },
        {
          headers: await network.serviceHeaders(
            viewer,
            ids.AppBskyGraphGetStarterPacksWithMembership,
          ),
        },
      )
      expect(full.data.starterPacksWithMembership.length).toBe(3)

      const sortedFull = results([full.data]).sort((a, b) =>
        a.starterPack.uri > b.starterPack.uri ? 1 : -1,
      )
      const sortedPaginated = results(paginatedAll).sort((a, b) =>
        a.starterPack.uri > b.starterPack.uri ? 1 : -1,
      )
      expect(sortedPaginated).toEqual(sortedFull)
    })
  })
})
