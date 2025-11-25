import assert from 'node:assert'
import {
  AtpAgent,
  ComAtprotoAdminDefs,
  ToolsOzoneModerationDefs,
} from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'

describe('moderation', () => {
  let network: TestNetwork

  let sc: SeedClient
  let modClient: ModeratorClient
  let pdsAgent: AtpAgent
  let bskyAgent: AtpAgent

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_takedown',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    pdsAgent = network.pds.getClient()
    bskyAgent = network.bsky.getClient()
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
    const { events: eventViews } = await modClient.queryEvents({
      subject: sc.dids.bob,
      types: ['tools.ozone.moderation.defs#modEventTakedown'],
    })

    const { event } = eventViews[0]

    assert(ToolsOzoneModerationDefs.isModEventTakedown(event))
    expect(event.policies?.[0]).toEqual('trolling')

    // Verify that event stream can be filtered by policy
    const { events: filteredEvents } = await modClient.queryEvents({
      subject: sc.dids.bob,
      policies: ['trolling'],
    })

    const { subject } = filteredEvents[0]

    assert(ComAtprotoAdminDefs.isRepoRef(subject))
    expect(subject.did).toEqual(sc.dids.bob)
  })

  it('applies takedown only to specified service when targetServices is set', async () => {
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        targetServices: ['appview'],
      },
      subject: repoSubject(sc.dids.carol),
    })

    await network.processAll()

    const [pdsStatus, appviewStatus, carolsEvents] = await Promise.all([
      pdsAgent.com.atproto.admin.getSubjectStatus(
        { did: sc.dids.carol },
        { headers: network.pds.adminAuthHeaders() },
      ),
      bskyAgent.com.atproto.admin.getSubjectStatus(
        { did: sc.dids.carol },
        { headers: network.bsky.adminAuthHeaders() },
      ),
      modClient.queryEvents({
        subject: sc.dids.carol,
        types: ['tools.ozone.moderation.defs#modEventTakedown'],
      }),
    ])

    expect(pdsStatus.data.takedown?.applied).toBe(false)
    expect(appviewStatus.data.takedown?.applied).toBe(true)

    const event = carolsEvents.events[0].event
    assert(ToolsOzoneModerationDefs.isModEventTakedown(event))
    expect(event.targetServices).toEqual(['appview'])
  })
})
