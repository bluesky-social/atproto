import {
  SeedClient,
  TestNetwork,
  basicSeed,
  TestOzone,
  RecordRef,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { forSnapshot } from './_util'
import { TAKEDOWN_LABEL } from '../src/mod-service'

describe('admin get starter pack view', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let sc: SeedClient
  let sp1: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_admin_get_starterpack',
    })
    ozone = network.ozone
    AtpAgent.configure({ appLabelers: [ozone.ctx.cfg.service.did] })
    agent = ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
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
    await network.processAll()
  })

  describe('getStarterPack()', () => {
    it('gets a starterpack by uri', async () => {
      const result = await agent.api.app.bsky.graph.getStarterPack(
        { starterPack: sp1.uriStr },
        { headers: await ozone.modHeaders() },
      )
      expect(forSnapshot(result.data)).toMatchSnapshot()
    })

    it('gets a starterpack while taken down', async () => {
      // Validate that appview returns starterpacks before takedown
      const appviewAgent = network.bsky.getClient()
      const beforeTakedownFromAppview =
        await appviewAgent.api.app.bsky.graph.getStarterPack(
          { starterPack: sp1.uriStr },
          { headers: await network.serviceHeaders(sc.dids.alice) },
        )

      expect(
        forSnapshot(beforeTakedownFromAppview.data.starterPack),
      ).toMatchSnapshot()

      await network.bsky.db.db
        .insertInto('label')
        .values({
          src: ozone.ctx.cfg.service.did,
          uri: sp1.uriStr,
          cid: sp1.cidStr,
          val: TAKEDOWN_LABEL,
          neg: false,
          cts: new Date().toISOString(),
        })
        .execute()

      const afterTakedownFromOzone =
        await agent.api.app.bsky.graph.getStarterPack(
          { starterPack: sp1.uriStr },
          { headers: await ozone.modHeaders() },
        )

      // validate that ozone returns starterpacks after takedown
      expect(
        forSnapshot(afterTakedownFromOzone.data.starterPack),
      ).toMatchSnapshot()

      // validate that appview does not return starterpack after takedown
      await expect(
        appviewAgent.api.app.bsky.graph.getStarterPack(
          { starterPack: sp1.uriStr },
          { headers: await network.serviceHeaders(sc.dids.alice) },
        ),
      ).rejects.toThrow('Starter pack not found')
    })
  })
})
