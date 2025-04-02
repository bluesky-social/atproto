import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, vouchesSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { constantDate, forSnapshot, paginateAll } from '../_util'

describe('vouch views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string
  let eve: string
  let verifier: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_vouches',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await vouchesSeed(sc)
    await network.processAll()

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    eve = sc.dids.eve
    verifier = sc.dids.verifier

    const res = await network.bsky.db.db
      .updateTable('actor')
      .set({ trustedVoucher: true })
      .where('did', '=', verifier)
      .execute()

    console.log('### res', res[0].numUpdatedRows)
    console.log('### sc.dids', sc.dids)

    const resAll = await network.bsky.db.db
      .selectFrom('actor')
      .selectAll()
      .execute()
    console.log('### resAll', resAll)
  })

  afterAll(async () => {
    await network.close()
  })

  const getCursors = (items: { createdAt?: string }[]) =>
    items.map((item) => item.createdAt ?? constantDate)

  const getSortedCursors = (items: { createdAt?: string }[]) =>
    getCursors(items).sort((a, b) => tstamp(b) - tstamp(a))

  const tstamp = (x: string) => new Date(x).getTime()

  describe('getVouchesIssued', () => {
    it('fetches vouches', async () => {
      const aliceVouches = await agent.app.bsky.graph.getVouchesIssued(
        { issuer: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphGetVouchesIssued,
          ),
        },
      )

      expect(aliceVouches.data.vouches).toStrictEqual([
        expect.objectContaining({ did: eve }),
        expect.objectContaining({ did: dan }),
        expect.objectContaining({ did: carol }),
        expect.objectContaining({ did: bob }),
      ])
      expect(forSnapshot(aliceVouches.data)).toMatchSnapshot()
      expect(getCursors(aliceVouches.data.vouches)).toEqual(
        getSortedCursors(aliceVouches.data.vouches),
      )
    })

    it('paginates', async () => {
      const results = (results) => results.flatMap((res) => res.likes)
      const paginator = async (cursor?: string) => {
        const res = await agent.app.bsky.graph.getVouchesIssued(
          {
            issuer: alice,
            cursor,
            limit: 2,
          },
          {
            headers: await network.serviceHeaders(
              alice,
              ids.AppBskyGraphGetVouchesIssued,
            ),
          },
        )
        return res.data
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.vouches.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.app.bsky.graph.getVouchesIssued(
        { issuer: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphGetVouchesIssued,
          ),
        },
      )

      expect(full.data.vouches.length).toEqual(4)
      expect(results(paginatedAll)).toEqual(results([full.data]))
    })
  })

  describe('getVouchesReceived', () => {
    it('fetches vouchers', async () => {
      const aliceVouches = await agent.app.bsky.graph.getVouchesReceived(
        { receiver: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphGetVouchesReceived,
          ),
        },
      )

      expect(aliceVouches.data.vouchers).toStrictEqual([
        expect.objectContaining({ did: carol }),
        expect.objectContaining({ did: bob }),
      ])
      expect(forSnapshot(aliceVouches.data)).toMatchSnapshot()
      expect(getCursors(aliceVouches.data.vouchers)).toEqual(
        getSortedCursors(aliceVouches.data.vouchers),
      )
    })

    it('paginates', async () => {
      const results = (results) => results.flatMap((res) => res.likes)
      const paginator = async (cursor?: string) => {
        const res = await agent.app.bsky.graph.getVouchesReceived(
          {
            receiver: alice,
            cursor,
            limit: 1,
          },
          {
            headers: await network.serviceHeaders(
              alice,
              ids.AppBskyGraphGetVouchesReceived,
            ),
          },
        )
        return res.data
      }

      const paginatedAll = await paginateAll(paginator)
      paginatedAll.forEach((res) =>
        expect(res.vouchers.length).toBeLessThanOrEqual(2),
      )

      const full = await agent.app.bsky.graph.getVouchesReceived(
        { receiver: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyGraphGetVouchesReceived,
          ),
        },
      )

      expect(full.data.vouchers.length).toEqual(2)
      expect(results(paginatedAll)).toEqual(results([full.data]))
    })
  })

  describe('getKnownVouchesReceived', () => {
    it('fetches who viewer vouched for that vouched for receiver', async () => {
      const aliceKnownVouchers =
        await agent.app.bsky.graph.getKnownVouchesReceived(
          { receiver: bob },
          {
            headers: await network.serviceHeaders(
              alice,
              ids.AppBskyGraphGetKnownVouchesReceived,
            ),
          },
        )

      expect(aliceKnownVouchers.data.vouchers).toStrictEqual([
        expect.objectContaining({ did: eve }),
        expect.objectContaining({ did: carol }),
      ])
      expect(forSnapshot(aliceKnownVouchers.data)).toMatchSnapshot()
    })
  })

  describe('profile views', () => {
    describe('profileViewDetailed', () => {
      it.only('shows verification level for verifier user', async () => {
        const verifierRes = await agent.api.app.bsky.actor.getProfile(
          { actor: verifier },
          {
            headers: await network.serviceHeaders(
              alice,
              ids.AppBskyActorGetProfile,
            ),
          },
        )

        console.log('### verifierRes', verifierRes)
        // expect(aliceKnownVouchers.data.vouchers).toStrictEqual([
        //   expect.objectContaining({ did: eve }),
        //   expect.objectContaining({ did: carol }),
        // ])
        // expect(forSnapshot(aliceKnownVouchers.data)).toMatchSnapshot()
      })
    })
  })
})
