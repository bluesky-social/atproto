import { jest } from '@jest/globals'
import { ids } from '@atproto/api'
import { DAY, HOUR } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import { StrikeExpiryProcessor } from '../src/daemon/strike-expiry-processor.js'
import { StrikeService } from '../src/mod-service/strike.js'
import { SeverityLevelSettingKey } from '../src/setting/constants.js'

describe('managed strike expiry', () => {
  let network: TestNetwork
  const subject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef' as const,
    did,
  })
  const processor = (days?: number) =>
    new StrikeExpiryProcessor(network.ozone.ctx.db, StrikeService.creator(days))
  const drain = async (days?: number) => {
    const job = processor(days)
    while (await job.processPolicyBatch()) {
      /* drain bounded batches */
    }
  }
  const status = async (did: string) =>
    (await network.ozone.getModClient().queryStatuses({ subject: did }))
      .subjectStatuses[0].accountStrike!
  const history = async (did: string) =>
    (
      await network.ozone
        .getModClient()
        .queryEvents({ subject: did, withStrike: true })
    ).events

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_strike_expiry_policy',
      ozone: { strikeExpiryDays: '180' },
    })
    await network.ozone.daemon.ctx.strikeExpiryProcessor.destroy()
    await network.ozone.getAgent().tools.ozone.setting.upsertOption(
      {
        key: SeverityLevelSettingKey,
        scope: 'instance',
        managerRole: 'tools.ozone.team.defs#roleAdmin',
        value: {
          'sev-1': { strikeCount: 1, expiryInDays: 365 },
          permanent: { strikeCount: 4 },
          zero: { expiryInDays: 0 },
        },
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneSettingUpsertOption,
          'admin',
        ),
      },
    )
  })
  afterAll(async () => {
    await network?.close()
  })

  it('supplies expiry for signed adjustments without restricting reversal amounts or linking sources', async () => {
    const did = 'did:plc:signedexpiry'
    const mod = network.ozone.getModClient()
    const positive = await mod.emitEvent({
      subject: subject(did),
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 3,
      },
    })
    const negative = await mod.emitEvent({
      subject: subject(did),
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        severityLevel: 'sev-1',
        strikeCount: -9,
      },
    })
    for (const event of [positive, negative]) {
      expect(event.event).toMatchObject({
        strikeExpiresAt: new Date(
          Date.parse(event.createdAt) + 180 * DAY,
        ).toISOString(),
      })
    }
    expect(await status(did)).toMatchObject({
      activeStrikeCount: -6,
      totalStrikeCount: -6,
    })
    const rows = await network.ozone.ctx.db.db
      .selectFrom('moderation_event')
      .where('subjectDid', '=', did as DidString)
      .select('meta')
      .execute()
    expect(
      rows.every(
        (row) =>
          row.meta?.strikeExpiryDays === 365 &&
          row.meta?.strikeReversalOf === undefined,
      ),
    ).toBe(true)
  })

  it('reconciles 365 to 180 and back, behind the ordinary cursor, without changing lifetime totals', async () => {
    const did = 'did:plc:durationflip'
    const mod = network.ozone.getModClient()
    const event = await mod.emitEvent({
      subject: subject(did),
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 2,
      },
    })
    const old = toDatetimeString(new Date(Date.now() - 200 * DAY))
    await network.ozone.ctx.db.db
      .updateTable('moderation_event')
      .set({ createdAt: old })
      .where('id', '=', event.id)
      .execute()
    await drain(365)
    expect((await status(did)).activeStrikeCount).toBe(2)
    await processor(365).updateCursor(new Date().toISOString())
    await drain(180)
    expect(await status(did)).toMatchObject({
      activeStrikeCount: 0,
      totalStrikeCount: 2,
    })
    expect((await history(did))[0].event).toMatchObject({
      strikeExpiresAt: new Date(Date.parse(old) + 180 * DAY).toISOString(),
    })
    await drain(365)
    expect((await status(did)).activeStrikeCount).toBe(2)
    await drain()
    expect((await status(did)).activeStrikeCount).toBe(2)
  })

  it('retains explicit expiry, permanent levels, zero-strike warnings and unadopted legacy history', async () => {
    const mod = network.ozone.getModClient()
    const explicit = new Date(Date.now() + 10 * DAY).toISOString()
    for (const [suffix, level, count, expiry] of [
      ['explicit', 'sev-1', 2, explicit],
      ['permanent', 'permanent', 4, undefined],
      ['warning', 'sev-1', 0, undefined],
      ['zero', 'zero', 2, undefined],
      ['legacy', 'sev-1', 1, undefined],
    ] as const) {
      const did = `did:plc:retain${suffix}`
      const event = await mod.emitEvent({
        subject: subject(did),
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
          severityLevel: level,
          strikeCount: count,
          strikeExpiresAt: expiry,
        },
      })
      if (suffix === 'legacy')
        await network.ozone.ctx.db.db
          .updateTable('moderation_event')
          .set({ strikeExpiresAt: null, meta: {} })
          .where('id', '=', event.id)
          .execute()
    }
    await drain(180)
    expect((await history('did:plc:retainexplicit'))[0].event).toMatchObject({
      strikeExpiresAt: explicit,
    })
    for (const suffix of ['permanent', 'warning', 'zero', 'legacy'])
      expect(
        (await history(`did:plc:retain${suffix}`))[0].event,
      ).not.toHaveProperty('strikeExpiresAt')
  })

  it('resumes one-account commits and serializes concurrent policy workers', async () => {
    await network.ozone.ctx.db.db
      .insertInto('account_strike')
      .values(
        Array.from({ length: 101 }, (_, i) => ({
          did: `did:plc:aaa${String(i).padStart(3, '0')}` as DidString,
          activeStrikeCount: 0,
          totalStrikeCount: 0,
          firstStrikeAt: null,
          lastStrikeAt: null,
        })),
      )
      .execute()
    const job = processor(181)
    expect(await job.processPolicyBatch()).toBe(true)
    const cursor = async () =>
      JSON.parse(
        (
          await network.ozone.ctx.db.db
            .selectFrom('job_cursor')
            .select('cursor')
            .where('job', '=', 'strike_expiry_policy')
            .executeTakeFirstOrThrow()
        ).cursor!,
      )
    expect((await cursor()).after).toBe('did:plc:aaa049')
    await Promise.all([job.processPolicyBatch(), job.processPolicyBatch()])
    expect((await cursor()).complete).toBe(true)
  })

  it('catches up old-pod writes after a completed sweep', async () => {
    await drain(365)
    const mod = network.ozone.getModClient() // API still uses the old 180-day value.
    const event = await mod.emitEvent({
      subject: subject('did:plc:rollingexpiry'),
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 1,
      },
    })
    expect(event.event).toMatchObject({
      strikeExpiresAt: new Date(
        Date.parse(event.createdAt) + 180 * DAY,
      ).toISOString(),
    })
    const db = network.ozone.ctx.db.db
    const row = await db
      .selectFrom('job_cursor')
      .select('cursor')
      .where('job', '=', 'strike_expiry_policy')
      .executeTakeFirstOrThrow()
    const cursor = JSON.parse(row.cursor!)
    await db
      .updateTable('job_cursor')
      .set({
        cursor: JSON.stringify({ ...cursor, checkedAt: Date.now() - HOUR - 1 }),
      })
      .where('job', '=', 'strike_expiry_policy')
      .execute()
    await drain(365)
    expect((await history('did:plc:rollingexpiry'))[0].event).toMatchObject({
      strikeExpiresAt: new Date(
        Date.parse(event.createdAt) + 365 * DAY,
      ).toISOString(),
    })
  })

  it('continues ordinary expiry when policy processing fails', async () => {
    const did = 'did:plc:ordinaryexpiry'
    await network.ozone.getModClient().emitEvent({
      subject: subject(did),
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        strikeCount: 1,
        strikeExpiresAt: new Date(Date.now() + HOUR).toISOString(),
      },
    })
    const expired = toDatetimeString(new Date(Date.now() - DAY))
    await network.ozone.ctx.db.db
      .updateTable('moderation_event')
      .set({ strikeExpiresAt: expired })
      .where('subjectDid', '=', did as DidString)
      .execute()
    const job = processor(180)
    await job.initializeCursor()
    await job.updateCursor(new Date(Date.now() - 2 * DAY).toISOString())
    using failure = jest
      .spyOn(job, 'processPolicyBatch')
      .mockRejectedValue(new Error('policy unavailable'))
    await job.processExpiredStrikes()
    expect(failure).toHaveBeenCalledTimes(1)
    expect((await status(did)).activeStrikeCount).toBe(0)
  })
})
