import { AtpAgent, BSKY_LABELER_DID } from '@atproto/api'
import {
  ModeratorClient,
  RecordRef,
  SeedClient,
  TestNetwork,
  TestOzone,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { TAKEDOWN_LABEL } from '../src/mod-service'

describe('admin get lists', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let appviewAgent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient
  let alicesList: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_admin_get_lists',
    })
    ozone = network.ozone
    agent = ozone.getClient()
    appviewAgent = network.bsky.getClient()
    sc = network.getSeedClient()
    modClient = ozone.getModClient()
    await basicSeed(sc)
    alicesList = await sc.createList(sc.dids.alice, "Alice's List", 'mod')
    AtpAgent.configure({ appLabelers: [ozone.ctx.cfg.service.did] })
    await network.processAll()
  })

  afterAll(async () => {
    AtpAgent.configure({ appLabelers: [BSKY_LABELER_DID] })
    await network.close()
  })

  const getAlicesList = async () => {
    const [{ data: fromOzone }, { data: fromAppview }] = await Promise.all([
      agent.api.app.bsky.graph.getLists(
        { actor: sc.dids.alice },
        { headers: await ozone.modHeaders(ids.AppBskyGraphGetLists) },
      ),
      appviewAgent.api.app.bsky.graph.getLists({ actor: sc.dids.alice }),
    ])

    return { fromOzone, fromAppview }
  }

  it('returns lists from takendown account', async () => {
    const beforeTakedown = await getAlicesList()
    expect(beforeTakedown.fromOzone.lists[0].uri).toEqual(alicesList.uriStr)
    expect(beforeTakedown.fromAppview.lists[0].uri).toEqual(alicesList.uriStr)

    // Takedown alice's account
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await network.processAll()

    const afterTakedown = await getAlicesList()

    // Verify that takendown list is shown when queried through ozone but not through appview
    expect(afterTakedown.fromAppview.lists.length).toBe(0)
    expect(afterTakedown.fromOzone.lists[0].uri).toEqual(alicesList.uriStr)

    // Reverse alice's account takedown
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventReverseTakedown' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await network.processAll()
  })

  it('returns takendown lists', async () => {
    const beforeTakedown = await getAlicesList()
    expect(beforeTakedown.fromOzone.lists[0].uri).toEqual(alicesList.uriStr)
    expect(beforeTakedown.fromAppview.lists[0].uri).toEqual(alicesList.uriStr)

    // Takedown alice's list using a !takedown label
    await network.bsky.db.db
      .insertInto('label')
      .values({
        src: ozone.ctx.cfg.service.did,
        uri: alicesList.uriStr,
        cid: alicesList.cidStr,
        val: TAKEDOWN_LABEL,
        neg: false,
        cts: new Date().toISOString(),
      })
      .execute()

    const afterTakedown = await getAlicesList()

    // Verify that takendown list is shown when queried through ozone but not through appview
    expect(afterTakedown.fromAppview.lists.length).toBe(0)
    expect(afterTakedown.fromOzone.lists[0].uri).toEqual(alicesList.uriStr)
  })
})
