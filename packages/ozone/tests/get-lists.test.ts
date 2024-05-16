import {
  SeedClient,
  TestNetwork,
  TestOzone,
  basicSeed,
  ModeratorClient,
  RecordRef,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { forSnapshot } from './_util'
import { TAKEDOWN_LABEL } from '../src/mod-service'

describe('admin get repo view', () => {
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
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  beforeAll(async () => {
    alicesList = await sc.createList(sc.dids.alice, "Alice's List", 'mod')
  })

  const getAlicesList = async () => {
    const [{ data: fromOzone }, { data: fromAppview }] = await Promise.all([
      agent.api.app.bsky.graph.getLists(
        { actor: sc.dids.alice },
        { headers: await ozone.modHeaders() },
      ),
      appviewAgent.api.app.bsky.graph.getLists({ actor: sc.dids.alice }),
    ])

    return { fromOzone, fromAppview }
  }

  it('returns lists from takendown account', async () => {
    const beforeTakedown = await getAlicesList()
    expect(beforeTakedown.fromOzone.lists[0].uri).toEqual(alicesList.uriStr)
    expect(beforeTakedown.fromAppview.lists[0].uri).toEqual(alicesList.uriStr)

    //     Takedown alice's account
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

    //     Reverse alice's account takedown
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventReverseTakedown' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await network.processAll()
  })

  //   TODO: This should pass but for some reason, the takendown list is returned by the appview too
  //   which is not relevant to the change since all that matters is that ozone returns it but would be good to have that fixed too
  it('returns takendown lists', async () => {
    const beforeTakedown = await getAlicesList()
    expect(beforeTakedown.fromOzone.lists[0].uri).toEqual(alicesList.uriStr)
    expect(beforeTakedown.fromAppview.lists[0].uri).toEqual(alicesList.uriStr)

    //     Takedown alice's list
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
      },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        ...alicesList.raw,
      },
    })
    await network.processAll()

    const afterTakedown = await getAlicesList()

    // Verify that takendown list is shown when queried through ozone but not through appview
    expect(afterTakedown.fromAppview.lists.length).toBe(0)
    expect(afterTakedown.fromOzone.lists[0].uri).toEqual(alicesList.uriStr)
  })
})
