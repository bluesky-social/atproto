import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { EventReverser } from '../src/daemon/event-reverser'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'

describe('expiring tags', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_expiring_tags',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const emitTagEvent = (
    did: string,
    add: string[],
    remove: string[],
    durationInHours?: number,
  ) =>
    modClient.emitEvent({
      subject: { $type: 'com.atproto.admin.defs#repoRef', did },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTag',
        add,
        remove,
        ...(durationInHours !== undefined ? { durationInHours } : {}),
      },
    })

  const getSubjectTags = async (did: string): Promise<string[]> => {
    const result = await modClient.queryStatuses({ subject: did })
    return result.subjectStatuses[0]?.tags ?? []
  }

  const createReverser = () =>
    new EventReverser(
      network.ozone.ctx.db,
      // @ts-expect-error Error due to circular dependency with the dev-env package
      network.ozone.ctx.modService,
    )

  it('creates expiring_tag rows when durationInHours is set', async () => {
    // Create a report so the subject exists in moderation_subject_status
    await sc.createReport({
      reasonType: REASONSPAM,
      reason: 'test',
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob },
      reportedBy: sc.dids.alice,
    })

    await emitTagEvent(sc.dids.bob, ['temp-tag-1', 'temp-tag-2'], [], 1)

    const tags = await getSubjectTags(sc.dids.bob)
    expect(tags).toContain('temp-tag-1')
    expect(tags).toContain('temp-tag-2')

    // Verify expiring_tag rows were created
    const expiringRows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('did', '=', sc.dids.bob)
      .selectAll()
      .execute()

    expect(expiringRows).toHaveLength(2)
    expect(expiringRows.map((r) => r.tag).sort()).toEqual([
      'temp-tag-1',
      'temp-tag-2',
    ])
    expect(expiringRows[0].expiresAt).toBeTruthy()
  })

  it('does not create expiring_tag rows without durationInHours', async () => {
    await emitTagEvent(sc.dids.bob, ['permanent-tag'], [])

    const tags = await getSubjectTags(sc.dids.bob)
    expect(tags).toContain('permanent-tag')

    const expiringRows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('did', '=', sc.dids.bob)
      .where('tag', '=', 'permanent-tag')
      .selectAll()
      .execute()

    expect(expiringRows).toHaveLength(0)
  })

  it('daemon reverts expired tags', async () => {
    // Manually expire the tags in the DB
    await network.ozone.ctx.db.db
      .updateTable('expiring_tag')
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where('did', '=', sc.dids.bob)
      .execute()

    const reverser = createReverser()
    await reverser.findAndRevertDueActions()

    const tags = await getSubjectTags(sc.dids.bob)
    expect(tags).not.toContain('temp-tag-1')
    expect(tags).not.toContain('temp-tag-2')
    // Permanent tag should still be there
    expect(tags).toContain('permanent-tag')

    // Verify expiring_tag rows are cleaned up
    const remainingRows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('did', '=', sc.dids.bob)
      .selectAll()
      .execute()

    expect(remainingRows).toHaveLength(0)
  })

  it('daemon emits a modEventTag removal event', async () => {
    const events = await modClient.queryEvents({
      subject: sc.dids.bob,
      types: ['tools.ozone.moderation.defs#modEventTag'],
    })

    const lastTagEvent = events.events[0]
    expect(lastTagEvent.event).toMatchObject({
      $type: 'tools.ozone.moderation.defs#modEventTag',
      add: [],
      remove: expect.arrayContaining(['temp-tag-1', 'temp-tag-2']),
      comment:
        '[SCHEDULED_REVERSAL] Reverting temporary tags as originally scheduled',
    })
  })

  it('cleans up expiring_tag rows when tags are manually removed', async () => {
    await sc.createReport({
      reasonType: REASONSPAM,
      reason: 'test',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol,
      },
      reportedBy: sc.dids.alice,
    })

    await emitTagEvent(sc.dids.carol, ['auto-remove-tag'], [], 24)

    // Verify the expiring_tag row exists
    let expiringRows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('did', '=', sc.dids.carol)
      .where('tag', '=', 'auto-remove-tag')
      .selectAll()
      .execute()
    expect(expiringRows).toHaveLength(1)

    // Manually remove the tag
    await emitTagEvent(sc.dids.carol, [], ['auto-remove-tag'])

    // Verify the expiring_tag row is cleaned up
    expiringRows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('did', '=', sc.dids.carol)
      .where('tag', '=', 'auto-remove-tag')
      .selectAll()
      .execute()
    expect(expiringRows).toHaveLength(0)
  })

  it('daemon skips tags already manually removed', async () => {
    await emitTagEvent(sc.dids.carol, ['skip-tag'], [], 1)

    // Manually remove the tag first
    await emitTagEvent(sc.dids.carol, [], ['skip-tag'])

    // Re-insert an expiring_tag row to simulate the race condition
    // (row wasn't cleaned up for some reason)
    await network.ozone.ctx.db.db
      .insertInto('expiring_tag')
      .values({
        eventId: 0,
        did: sc.dids.carol,
        recordPath: '',
        tag: 'skip-tag',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        createdBy: sc.dids.alice,
      })
      .execute()

    const tagsBefore = await getSubjectTags(sc.dids.carol)
    expect(tagsBefore).not.toContain('skip-tag')

    const reverser = createReverser()
    await reverser.findAndRevertDueActions()

    // Verify no removal event was emitted for a tag that's already gone
    const events = await modClient.queryEvents({
      subject: sc.dids.carol,
      types: ['tools.ozone.moderation.defs#modEventTag'],
    })

    // The last tag event should be the manual removal, not a scheduled reversal
    const lastEvent = events.events[0]
    expect(lastEvent.event).toMatchObject({
      $type: 'tools.ozone.moderation.defs#modEventTag',
      remove: ['skip-tag'],
    })
    const comment = (lastEvent.event as { comment?: string }).comment ?? ''
    expect(comment).not.toContain('SCHEDULED_REVERSAL')

    // Verify the expiring_tag row is still cleaned up
    const remainingRows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('did', '=', sc.dids.carol)
      .where('tag', '=', 'skip-tag')
      .selectAll()
      .execute()
    expect(remainingRows).toHaveLength(0)
  })
})
