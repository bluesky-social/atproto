import {
  TestNetwork,
  TestOzone,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import { AtpAgent } from '@atproto/api'

describe('moderation', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let bskyAgent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_takedown',
    })
    ozone = network.ozone
    agent = network.ozone.getClient()
    bskyAgent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('allows specifying policy for takedown actions.', async () => {
    await modClient.performTakedown({
      subject: repoSubject(sc.dids.bob),
      policies: ['trolling'],
    })

    // Verify that that the takedown even exposes the policy specified for it
    const { events } = await modClient.queryEvents({
      subject: sc.dids.bob,
      types: ['tools.ozone.moderation.defs#modEventTakedown'],
    })

    expect(events[0].event.policies?.[0]).toEqual('trolling')

    // Verify that event stream can be filtered by policy
    const { events: filteredEvents } = await modClient.queryEvents({
      subject: sc.dids.bob,
      policies: ['trolling'],
    })

    expect(filteredEvents[0].subject.did).toEqual(sc.dids.bob)
  })
})
