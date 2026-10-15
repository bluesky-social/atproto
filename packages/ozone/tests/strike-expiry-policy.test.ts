import { ids } from '@atproto/api'
import { DAY } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import { StrikeService } from '../src/mod-service/strike.js'
import { SeverityLevelSettingKey } from '../src/setting/constants.js'

describe('strike expiry policy reconciliation', () => {
  let network: TestNetwork
  const did = 'did:plc:expirytest' as DidString
  const subject = { $type: 'com.atproto.admin.defs#repoRef' as const, did }
  const configure = async (days: number) => {
    await network.ozone.getAgent().tools.ozone.setting.upsertOption(
      {
        key: SeverityLevelSettingKey,
        scope: 'instance',
        value: {
          'sev-1': { strikeCount: 1, expiryInDays: days },
          permanent: { strikeCount: 4 },
        },
        managerRole: 'tools.ozone.team.defs#roleAdmin',
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneSettingUpsertOption,
          'admin',
        ),
      },
    )
  }
  const status = async (accountDid = did) => {
    const result = await network.ozone
      .getModClient()
      .queryStatuses({ subject: accountDid })
    return result.subjectStatuses[0].accountStrike!
  }
  const drain = async () => {
    while (
      await network.ozone.daemon.ctx.strikeExpiryProcessor.processPolicyBatch()
    ) {
      /* drain */
    }
  }
  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_strike_expiry_policy',
    })
    await configure(365)
  })
  afterAll(async () => {
    await network?.close()
  })

  it('stores configured expiry for takedowns and emails, preserving warnings and permanent levels', async () => {
    const mod = network.ozone.getModClient()
    const takedown = await mod.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 1,
      },
    })
    const email = await mod.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventEmail',
        subjectLine: 'Violation notice',
        severityLevel: 'sev-1',
        strikeCount: 1,
      },
    })
    for (const event of [takedown, email]) {
      expect(event.event).toMatchObject({
        strikeExpiresAt: new Date(
          Date.parse(event.createdAt) + 365 * DAY,
        ).toISOString(),
      })
    }
    const warning = await mod.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventEmail',
        subjectLine: 'Warning',
        severityLevel: 'sev-1',
        strikeCount: 0,
      },
    })
    expect(warning.event).not.toHaveProperty('strikeExpiresAt')
    const permanent = await mod.emitEvent({
      subject: { ...subject, did: 'did:plc:expirypermanent' },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'permanent',
        strikeCount: 4,
      },
    })
    expect(permanent.event).not.toHaveProperty('strikeExpiresAt')
    expect((await status()).activeStrikeCount).toBe(2)
  })

  it('automatically reconciles 365 to 180 and back, including expiries before the daemon cursor', async () => {
    const db = network.ozone.ctx.db
    const old = toDatetimeString(new Date(Date.now() - 200 * DAY))
    await db.db
      .updateTable('moderation_event')
      .set({ createdAt: old })
      .where('subjectDid', '=', did)
      .where('strikeCount', '>', 0)
      .execute()
    await drain()
    expect((await status()).activeStrikeCount).toBe(2)
    await network.ozone.daemon.ctx.strikeExpiryProcessor.updateCursor(
      new Date().toISOString(),
    )
    await configure(180)
    await drain()
    expect((await status()).activeStrikeCount).toBe(0)
    expect((await status()).totalStrikeCount).toBe(2)
    const events = await network.ozone
      .getModClient()
      .queryEvents({ subject: did, withStrike: true })
    for (const event of events.events.filter(
      (e) =>
        'strikeCount' in e.event &&
        typeof e.event.strikeCount === 'number' &&
        e.event.strikeCount > 0,
    )) {
      expect(event.event).toMatchObject({
        strikeExpiresAt: new Date(Date.parse(old) + 180 * DAY).toISOString(),
      })
    }
    await configure(365)
    await drain()
    expect((await status()).activeStrikeCount).toBe(2)
  })

  it('preserves an explicit expiry across changes to the policy', async () => {
    const explicitDid = 'did:plc:expiryexplicit' as DidString
    const expiry = new Date(Date.now() + 5 * DAY).toISOString()
    const event = await network.ozone.getModClient().emitEvent({
      subject: { ...subject, did: explicitDid },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 1,
        strikeExpiresAt: expiry,
      },
    })
    await configure(180)
    await drain()
    const result = await network.ozone
      .getModClient()
      .queryEvents({ subject: explicitDid, withStrike: true })
    expect(result.events.find((e) => e.id === event.id)!.event).toMatchObject({
      strikeExpiresAt: expiry,
    })
  })

  it('keeps a reversal after expiry from producing a negative active count', async () => {
    const reversalDid = 'did:plc:expiryreversal' as DidString
    const mod = network.ozone.getModClient()
    const source = await mod.emitEvent({
      subject: { ...subject, did: reversalDid },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 1,
      },
    })
    const db = network.ozone.ctx.db
    await db.db
      .updateTable('moderation_event')
      .set({ createdAt: toDatetimeString(new Date(Date.now() - 200 * DAY)) })
      .where('id', '=', source.id)
      .execute()
    const reversal = await mod.emitEvent({
      subject: { ...subject, did: reversalDid },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        severityLevel: 'sev-1',
        strikeCount: -1,
      },
    })
    expect((await status(reversalDid)).activeStrikeCount).toBe(0)
    expect((await status(reversalDid)).totalStrikeCount).toBe(0)
    const rows = await db.db
      .selectFrom('moderation_event')
      .where('id', 'in', [source.id, reversal.id])
      .select(['strikeExpiresAt', 'meta'])
      .orderBy('id')
      .execute()
    expect(rows[1].strikeExpiresAt).toBe(rows[0].strikeExpiresAt)
    expect(rows[1].meta?.strikeReversalOf).toBe(source.id)
    await configure(365)
    await drain()
    expect((await status(reversalDid)).activeStrikeCount).toBe(0)
  })

  it('rejects orphan and excessive reversals atomically', async () => {
    const orphan = 'did:plc:expiryorphan'
    await network.ozone.getModClient().emitEvent({
      subject: { ...subject, did: orphan },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
      },
    })
    await expect(
      network.ozone.getModClient().emitEvent({
        subject: { ...subject, did: orphan },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
          severityLevel: 'sev-1',
          strikeCount: -1,
        },
      }),
    ).rejects.toThrow('Strike reversal must match')
    const events = await network.ozone
      .getModClient()
      .queryEvents({ subject: orphan })
    expect(events.events).toHaveLength(1)
    const excessive = 'did:plc:expiryexcessive'
    await network.ozone.getModClient().emitEvent({
      subject: { ...subject, did: excessive },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 1,
      },
    })
    await expect(
      network.ozone.getModClient().emitEvent({
        subject: { ...subject, did: excessive },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
          severityLevel: 'sev-1',
          strikeCount: -2,
        },
      }),
    ).rejects.toThrow('Strike reversal must match')
    expect((await status(excessive as DidString)).activeStrikeCount).toBe(1)
    await expect(
      network.ozone.getModClient().emitEvent({
        subject: { ...subject, did: excessive },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
          severityLevel: 'sev-1',
          strikeCount: 1,
        },
      }),
    ).rejects.toThrow('Strike reversal must match')
  })

  it('resumes committed DID batches and serializes concurrent workers', async () => {
    const db = network.ozone.ctx.db
    await db.db
      .insertInto('account_strike')
      .values(
        Array.from({ length: 101 }, (_, i) => ({
          did: `did:plc:batch${String(i).padStart(3, '0')}` as DidString,
          activeStrikeCount: 0,
          totalStrikeCount: 0,
          firstStrikeAt: null,
          lastStrikeAt: null,
        })),
      )
      .execute()
    await configure(180)
    const processor = network.ozone.daemon.ctx.strikeExpiryProcessor
    expect(await processor.processPolicyBatch()).toBe(true)
    const first = await db.db
      .selectFrom('job_cursor')
      .select('cursor')
      .where('job', '=', 'strike_expiry_policy')
      .executeTakeFirstOrThrow()
    expect(JSON.parse(first.cursor!).after).toBe('did:plc:batch049')
    await Promise.all([
      processor.processPolicyBatch(),
      processor.processPolicyBatch(),
    ])
    const last = await db.db
      .selectFrom('job_cursor')
      .select('cursor')
      .where('job', '=', 'strike_expiry_policy')
      .executeTakeFirstOrThrow()
    expect(JSON.parse(last.cursor!).complete).toBe(true)
  })

  it('serializes concurrent strike writers for the same DID', async () => {
    const concurrentDid = 'did:plc:expiryconcurrent' as DidString
    await Promise.all(
      Array.from({ length: 3 }, () =>
        network.ozone.getModClient().emitEvent({
          subject: { ...subject, did: concurrentDid },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventEmail',
            subjectLine: 'Strike',
            severityLevel: 'sev-1',
            strikeCount: 1,
          },
        }),
      ),
    )
    expect((await status(concurrentDid)).activeStrikeCount).toBe(3)
    const service = new StrikeService(network.ozone.ctx.db)
    expect((await service.getSubjectStrikeEvents(concurrentDid)).length).toBe(3)
  })

  it('normalizes configured severity keys and rejects ambiguous collisions', async () => {
    const db = network.ozone.ctx.db
    await db.db
      .updateTable('setting')
      .set({ value: { 'Sev 1': { expiryInDays: 365 } } })
      .where('key', '=', SeverityLevelSettingKey)
      .where('scope', '=', 'instance')
      .execute()
    const mod = network.ozone.getModClient()
    const emitted = await mod.emitEvent({
      subject: { ...subject, did: 'did:plc:mixedcaseseverity' },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'Sev 1',
        strikeCount: 1,
      },
    })
    expect(emitted.event).toMatchObject({
      strikeExpiresAt: new Date(
        Date.parse(emitted.createdAt) + 365 * DAY,
      ).toISOString(),
    })
    await db.db
      .updateTable('setting')
      .set({
        value: {
          'Sev 1': { expiryInDays: 365 },
          'sev-1': { expiryInDays: 180 },
        },
      })
      .where('key', '=', SeverityLevelSettingKey)
      .where('scope', '=', 'instance')
      .execute()
    await expect(new StrikeService(db).getExpiryPolicy()).rejects.toThrow(
      'Conflicting strike severity keys',
    )
    await configure(365)
  })

  it('reconciles edits back to the same value when the intermediate policy was never polled', async () => {
    await configure(365)
    await drain()
    await configure(180)
    const emitted = await network.ozone.getModClient().emitEvent({
      subject: { ...subject, did: 'did:plc:transientpolicy' },
      event: {
        $type: 'tools.ozone.moderation.defs#modEventEmail',
        subjectLine: 'Strike',
        severityLevel: 'sev-1',
        strikeCount: 1,
      },
    })
    expect(emitted.event).toMatchObject({
      strikeExpiresAt: new Date(
        Date.parse(emitted.createdAt) + 180 * DAY,
      ).toISOString(),
    })
    await configure(365)
    await drain()
    const result = await network.ozone
      .getModClient()
      .queryEvents({ subject: 'did:plc:transientpolicy', withStrike: true })
    expect(result.events[0].event).toMatchObject({
      strikeExpiresAt: new Date(
        Date.parse(emitted.createdAt) + 365 * DAY,
      ).toISOString(),
    })
  })

  it('holds policy edits until a writer using that setting commits', async () => {
    let release!: () => void
    let ready!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const locked = new Promise<void>((resolve) => {
      ready = resolve
    })
    const writer = network.ozone.ctx.db.transaction(async (txn) => {
      await new StrikeService(txn).getExpiryPolicyState()
      ready()
      await gate
    })
    await locked
    const edit = configure(180)
    try {
      expect(
        await Promise.race([
          edit.then(() => 'committed'),
          new Promise<string>((resolve) =>
            setTimeout(() => resolve('waiting'), 50),
          ),
        ]),
      ).toBe('waiting')
    } finally {
      release()
      await writer
      await edit
    }
  })
})
