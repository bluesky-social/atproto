import { jest } from '@jest/globals'
import { sql } from 'kysely'
import { ComAtprotoModerationDefs } from '@atproto/api'
import { wait } from '@atproto/common'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { DidString } from '@atproto/lex'
import { toDatetimeString } from '@atproto/lex'
import { EventReverser } from '../src/daemon/event-reverser.js'
import { com, tools } from '../src/lexicons/index.js'
import {
  getExpiredTags,
  lockTagSubject,
} from '../src/mod-service/expiring-tags.js'
import { RepoSubject } from '../src/mod-service/subject.js'

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
    await network?.close()
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
    new EventReverser(network.ozone.ctx.db, network.ozone.ctx.modService)

  it('creates expiring_tag rows when durationInHours is set', async () => {
    // Create a report so the subject exists in moderation_subject_status
    await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
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
      .set({ expiresAt: toDatetimeString(Date.now() - 1000) })
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
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      reason: 'test',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol as DidString,
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
        did: sc.dids.carol as DidString,
        recordPath: '',
        convoId: '',
        tag: 'skip-tag',
        expiresAt: toDatetimeString(Date.now() - 1000),
        createdBy: sc.dids.alice as DidString,
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

  const expireTag = async (tag: string) => {
    await network.ozone.ctx.db.db
      .updateTable('expiring_tag')
      .set({ expiresAt: toDatetimeString(Date.now() - 1000) })
      .where('tag', '=', tag)
      .execute()
    const groups = await getExpiredTags(network.ozone.ctx.db)
    const group = groups.find((candidate) => candidate.tags.includes(tag))
    expect(group).toBeDefined()
    return group!
  }

  it.each([24, 1])(
    'replaces a temporary deadline with %ih without stale reversal',
    async (hours) => {
      const tag = `renew-${hours}`
      await emitTagEvent(sc.dids.bob, [tag], [], 12)
      const group = await expireTag(tag)
      await emitTagEvent(sc.dids.bob, [tag], [], hours)
      await createReverser().revertExpiredTags(group)
      expect(await getSubjectTags(sc.dids.bob)).toContain(tag)
      const rows = await network.ozone.ctx.db.db
        .selectFrom('expiring_tag')
        .where('tag', '=', tag)
        .selectAll()
        .execute()
      expect(rows).toHaveLength(1)
      expect(Date.parse(rows[0].expiresAt)).toBeGreaterThan(Date.now())
      const expectedDeadline = Date.now() + hours * 60 * 60 * 1000
      expect(
        Math.abs(Date.parse(rows[0].expiresAt) - expectedDeadline),
      ).toBeLessThan(5000)
    },
  )

  it('clears a temporary deadline on permanent reissue', async () => {
    const tag = 'reissue-permanent'
    await emitTagEvent(sc.dids.bob, [tag], [], 1)
    const group = await expireTag(tag)
    await emitTagEvent(sc.dids.bob, [tag], [])
    await createReverser().revertExpiredTags(group)
    expect(await getSubjectTags(sc.dids.bob)).toContain(tag)
    const rows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('tag', '=', tag)
      .selectAll()
      .execute()
    expect(rows).toHaveLength(0)
  })

  it('expires a permanent tag when reissued with a duration', async () => {
    const tag = 'reissue-temporary'
    await emitTagEvent(sc.dids.bob, [tag], [])
    await emitTagEvent(sc.dids.bob, [tag], [], 1)
    await createReverser().revertExpiredTags(await expireTag(tag))
    expect(await getSubjectTags(sc.dids.bob)).not.toContain(tag)
  })

  it('does not remove a tag readded after a manual removal', async () => {
    const tag = 'remove-readd'
    await emitTagEvent(sc.dids.bob, [tag], [], 1)
    const group = await expireTag(tag)
    await emitTagEvent(sc.dids.bob, [], [tag])
    await emitTagEvent(sc.dids.bob, [tag], [], 24)
    await createReverser().revertExpiredTags(group)
    expect(await getSubjectTags(sc.dids.bob)).toContain(tag)
  })

  it.each([24, undefined])(
    'ignores legacy stale rows after reissue with duration %s',
    async (hours) => {
      const tag = `legacy-reissue-${hours}`
      await emitTagEvent(sc.dids.bob, [tag], [], 1)
      const oldRow = await network.ozone.ctx.db.db
        .selectFrom('expiring_tag')
        .where('tag', '=', tag)
        .selectAll()
        .executeTakeFirstOrThrow()
      await emitTagEvent(sc.dids.bob, [tag], [], hours)
      const { id: _, ...oldValues } = oldRow
      await network.ozone.ctx.db.db
        .insertInto('expiring_tag')
        .values({
          ...oldValues,
          expiresAt: toDatetimeString(Date.now() - 1000),
        })
        .execute()
      await createReverser().revertExpiredTags(
        await expireTagLegacy(tag, oldRow.eventId),
      )
      expect(await getSubjectTags(sc.dids.bob)).toContain(tag)
      const rows = await network.ozone.ctx.db.db
        .selectFrom('expiring_tag')
        .where('tag', '=', tag)
        .selectAll()
        .execute()
      expect(rows).toHaveLength(hours === undefined ? 0 : 1)
    },
  )

  const expireTagLegacy = async (tag: string, eventId: number) => {
    const row = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('tag', '=', tag)
      .where('eventId', '=', eventId)
      .selectAll()
      .executeTakeFirstOrThrow()
    return {
      did: row.did,
      recordPath: row.recordPath,
      convoId: row.convoId,
      createdBy: row.createdBy,
      tags: [tag],
      ids: [row.id],
    }
  }

  it('emits only one removal when two workers process the same snapshot', async () => {
    const tag = 'concurrent-expiry'
    await emitTagEvent(sc.dids.bob, [tag], [], 1)
    const group = await expireTag(tag)
    await Promise.all([
      createReverser().revertExpiredTags(group),
      createReverser().revertExpiredTags(group),
    ])
    expect(await getSubjectTags(sc.dids.bob)).not.toContain(tag)
    const events = await modClient.queryEvents({
      subject: sc.dids.bob,
      types: ['tools.ozone.moderation.defs#modEventTag'],
      removedTags: [tag],
    })
    expect(events.events).toHaveLength(1)
  })

  it('waits for an in-flight renewal before locking the status for expiry', async () => {
    const tag = 'in-flight-renewal'
    await emitTagEvent(sc.dids.bob, [tag], [], 1)
    const group = await expireTag(tag)
    const db = network.ozone.ctx.db
    let reversal: Promise<void> | undefined
    try {
      await db.transaction(async (dbTxn) => {
        await lockTagSubject(dbTxn, group)
        const { rows } = await sql<{ pid: number }>`
          select pg_backend_pid() as pid
        `.execute(dbTxn.db)
        reversal = createReverser().revertExpiredTags(group)

        // @NOTE wait for actual lock contention, not a timing assumption.
        const deadline = performance.now() + 2000
        let blocked = false
        do {
          const { rows: waiters } = await sql<{ blocked: boolean }>`
            select exists (
              select 1 from pg_stat_activity
              where ${rows[0].pid} = any(pg_blocking_pids(pid))
            ) as blocked
          `.execute(db.db)
          blocked = waiters[0].blocked
          if (!blocked) await wait(10)
        } while (!blocked && performance.now() < deadline)
        expect(blocked).toBe(true)

        await network.ozone.ctx.modService(dbTxn).logEvent({
          subject: new RepoSubject(group.did),
          createdBy: group.createdBy,
          createdAt: new Date(),
          event: tools.ozone.moderation.defs.modEventTag.$build({
            add: [tag],
            remove: [],
            durationInHours: 24,
          }),
        })
      })
    } finally {
      await reversal
    }

    expect(await getSubjectTags(sc.dids.bob)).toContain(tag)
    const events = await modClient.queryEvents({
      subject: sc.dids.bob,
      types: ['tools.ozone.moderation.defs#modEventTag'],
      removedTags: [tag],
    })
    expect(events.events).toHaveLength(0)
  })

  it.each(['tag writer', 'expiry worker'])(
    'persists a report and automatic tags while a %s waits for its status',
    async (writer) => {
      const did: DidString = `did:plc:report${writer === 'tag writer' ? 'tag' : 'expiry'}`
      const tag = `report-contention-${writer}`
      await emitTagEvent(did, [tag], [], 1)
      const group = await expireTag(tag)
      const ctx = network.ozone.ctx
      const prototype = Object.getPrototypeOf(
        ctx.modService(ctx.db),
      ) as ReturnType<typeof ctx.modService>
      const originalReport = prototype.report
      let reportHeld!: (pid: number) => void
      const held = new Promise<number>((resolve) => {
        reportHeld = resolve
      })
      let release!: () => void
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      using _reportSpy = jest
        .spyOn(prototype, 'report')
        .mockImplementation(async function (this: typeof prototype, info) {
          const result = await originalReport.call(this, info)
          const { rows } = await sql<{ pid: number }>`
            select pg_backend_pid() as pid
          `.execute(this.db.db)
          reportHeld(rows[0].pid)
          await released
          return result
        })
      const report = sc.createReport({
        reasonType: com.atproto.moderation.defs.ReasonSpam,
        subject: com.atproto.admin.defs.repoRef.$build({ did }),
        reportedBy: sc.dids.alice,
      })
      let competing: Promise<unknown> | undefined
      try {
        const pid = await held
        competing =
          writer === 'tag writer'
            ? emitTagEvent(did, ['concurrent-manual-tag'], [])
            : createReverser().revertExpiredTags(group)
        const deadline = performance.now() + 2000
        let blocked = false
        do {
          const { rows } = await sql<{ blocked: boolean }>`
            select exists (
              select 1 from pg_stat_activity
              where ${pid} = any(pg_blocking_pids(pid))
            ) as blocked
          `.execute(ctx.db.db)
          blocked = rows[0].blocked
          if (!blocked) await wait(10)
        } while (!blocked && performance.now() < deadline)
        expect(blocked).toBe(true)
      } finally {
        release()
        await Promise.all([report, competing])
      }

      const result = await report
      const events = await modClient.queryEvents({ subject: did })
      expect(events.events.some((event) => event.id === result.id)).toBe(true)
      expect(await getSubjectTags(did)).toContain('report:spam')
      if (writer === 'tag writer') {
        expect(await getSubjectTags(did)).toContain('concurrent-manual-tag')
      } else {
        await createReverser().revertExpiredTags(group)
        expect(await getSubjectTags(did)).not.toContain(tag)
      }
    },
  )

  it.each([false, true])(
    'allows reports and renewal during expiry history checks (legacy writer: %s)',
    async (legacy) => {
      const did: DidString = `did:plc:reportduringhistory${legacy ? 'legacy' : 'current'}`
      const tag = `history-contention-${legacy}`
      await emitTagEvent(did, [tag], [], 1)
      const group = await expireTag(tag)
      const originalRow = await network.ozone.ctx.db.db
        .selectFrom('expiring_tag')
        .where('id', '=', group.ids[0])
        .selectAll()
        .executeTakeFirstOrThrow()
      const reverser = createReverser()
      const originalCandidates = reverser.getExpiredTagCandidates.bind(reverser)
      let historyChecked!: () => void
      const checked = new Promise<void>((resolve) => {
        historyChecked = resolve
      })
      let release!: () => void
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      using _candidatesSpy = jest
        .spyOn(reverser, 'getExpiredTagCandidates')
        .mockImplementation(async (candidateGroup) => {
          const candidates = await originalCandidates(candidateGroup)
          historyChecked()
          await released
          return candidates
        })
      const reversal = reverser.revertExpiredTags(group)
      try {
        await checked
        const report = await sc.createReport({
          reasonType: com.atproto.moderation.defs.ReasonSpam,
          subject: com.atproto.admin.defs.repoRef.$build({ did }),
          reportedBy: sc.dids.alice,
        })
        const events = await modClient.queryEvents({ subject: did })
        expect(events.events.some((event) => event.id === report.id)).toBe(true)
        expect(await getSubjectTags(did)).toContain('report:spam')
        await emitTagEvent(did, [tag], [], legacy ? undefined : 24)
        if (legacy) {
          // @NOTE simulate a permanent reissue by a writer that leaves old expiry metadata.
          await network.ozone.ctx.db.db
            .insertInto('expiring_tag')
            .values(originalRow)
            .execute()
        }
      } finally {
        release()
        await reversal
      }
      expect(await getSubjectTags(did)).toContain(tag)
      const removals = await modClient.queryEvents({
        subject: did,
        removedTags: [tag],
      })
      expect(removals.events).toHaveLength(0)
      await reverser.findAndRevertExpiredTags()
      expect(await getSubjectTags(did)).toContain(tag)
    },
  )

  it('serializes concurrent first tag writes on a new subject', async () => {
    const subject = 'did:plc:newtagsubject'
    await Promise.all([
      emitTagEvent(subject, ['first-tag-a'], [], 1),
      emitTagEvent(subject, ['first-tag-b'], [], 1),
    ])
    const tags = await getSubjectTags(subject)
    expect(tags).toEqual(expect.arrayContaining(['first-tag-a', 'first-tag-b']))
    const rows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('did', '=', subject)
      .selectAll()
      .execute()
    expect(rows).toHaveLength(2)
  })

  it.each([false, true])(
    'expires record tags independently of account tags (legacy URI: %s)',
    async (legacy) => {
      const post = await sc.post(sc.dids.alice, `expiry record ${legacy}`)
      const tag = `record-expiry-${legacy}`
      await emitTagEvent(sc.dids.alice, [tag], [], 24)
      await modClient.emitEvent({
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.ref.uriStr,
          cid: post.ref.cidStr,
        },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTag',
          add: [tag],
          remove: [],
          durationInHours: 1,
        },
      })
      const recordPath = post.ref.uriStr.split('/').slice(3).join('/')
      const row = await network.ozone.ctx.db.db
        .selectFrom('expiring_tag')
        .where('tag', '=', tag)
        .where('recordPath', '=', recordPath)
        .selectAll()
        .executeTakeFirstOrThrow()
      await network.ozone.ctx.db.db
        .updateTable('expiring_tag')
        .set({
          recordPath: legacy ? post.ref.uriStr : recordPath,
          expiresAt: toDatetimeString(Date.now() - 1000),
        })
        .where('id', '=', row.id)
        .execute()
      await createReverser().findAndRevertExpiredTags()
      expect(await getSubjectTags(post.ref.uriStr)).not.toContain(tag)
      expect(await getSubjectTags(sc.dids.alice)).toContain(tag)
      const events = await modClient.queryEvents({
        subject: post.ref.uriStr,
        types: ['tools.ozone.moderation.defs#modEventTag'],
        removedTags: [tag],
      })
      expect(events.events).toHaveLength(1)
      expect(events.events[0].createdBy).toBe(row.createdBy)
    },
  )

  it('does not retain expiry work for a tag added and removed in one event', async () => {
    const tag = 'add-and-remove'
    await emitTagEvent(sc.dids.bob, [tag], [tag], 1)
    expect(await getSubjectTags(sc.dids.bob)).not.toContain(tag)
    const rows = await network.ozone.ctx.db.db
      .selectFrom('expiring_tag')
      .where('tag', '=', tag)
      .selectAll()
      .execute()
    expect(rows).toHaveLength(0)
  })

  it('bounds each expiry pass and resumes oldest-first without losing renewals', async () => {
    const tiedTags = Array.from({ length: 1_000 }, (_, i) => `batch-tied-${i}`)
    const oldest = 'batch-oldest'
    const newer = 'batch-newer'
    const future = 'batch-future'
    // @NOTE insert out of expiry order, including more than a batch at one deadline.
    const tags = [newer, ...tiedTags, oldest, future]
    await emitTagEvent(sc.dids.bob, tags, [], 24)
    const db = network.ozone.ctx.db
    const now = Date.now()
    await db.db
      .updateTable('expiring_tag')
      .set({ expiresAt: toDatetimeString(now - 2_000) })
      .where('tag', 'in', tiedTags)
      .execute()
    await db.db
      .updateTable('expiring_tag')
      .set({ expiresAt: toDatetimeString(now - 3_000) })
      .where('tag', '=', oldest)
      .execute()
    await db.db
      .updateTable('expiring_tag')
      .set({ expiresAt: toDatetimeString(now - 1_000) })
      .where('tag', '=', newer)
      .execute()

    const groups = await getExpiredTags(db)
    expect(groups.flatMap((group) => group.ids)).toHaveLength(1_000)
    const selectedTags = groups.flatMap((group) => group.tags)
    expect(selectedTags).toContain(oldest)
    expect(selectedTags).not.toContain(newer)
    expect(selectedTags).not.toContain(future)

    const reverser = createReverser()
    await reverser.findAndRevertExpiredTags()
    const remainingTags = (await getSubjectTags(sc.dids.bob)).filter((tag) =>
      tags.includes(tag),
    )
    expect(remainingTags).toHaveLength(3)
    expect(remainingTags).not.toContain(oldest)
    expect(remainingTags).toEqual(expect.arrayContaining([newer, future]))

    const remainingDue = (await getExpiredTags(db)).flatMap(
      (group) => group.tags,
    )
    expect(remainingDue).toHaveLength(2)
    const renewed = remainingDue.find((tag) => tag !== newer)!
    await emitTagEvent(sc.dids.bob, [renewed], [], 24)
    await reverser.findAndRevertExpiredTags()

    const finalTags = (await getSubjectTags(sc.dids.bob)).filter((tag) =>
      tags.includes(tag),
    )
    expect(finalTags.sort()).toEqual([future, renewed].sort())
    expect(await getExpiredTags(db)).toHaveLength(0)
    const removals = await modClient.queryEvents({
      subject: sc.dids.bob,
      types: [tools.ozone.moderation.defs.modEventTag.$type],
      removedTags: [renewed],
    })
    expect(removals.events).toHaveLength(0)
  })
})
