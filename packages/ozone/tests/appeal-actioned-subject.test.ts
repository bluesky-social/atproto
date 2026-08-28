import type { AtpAgent } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { jsonb } from '../src/db/types.js'
import { appealWindowEnd } from '../src/inbox/appeal.js'
import { hydrateSubjectView, loadSubject } from '../src/inbox/views.js'
import { validateSubjectView } from '../src/lexicon/types/tools/ozone/inbox/defs.js'
import { REASONAPPEAL } from '../src/lexicon/types/tools/ozone/report/defs.js'
import {
  ConvoSubject,
  MessageSubject,
  RecordSubject,
  RepoSubject,
} from '../src/mod-service/subject.js'

describe('appealActionedSubject', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let ozoneAgent: AtpAgent
  let proxyHeader: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_appeal_actioned_subject',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    ozoneAgent = network.ozone.getAgent()
    // tools.ozone.inbox.* has no default route in the PDS, so every call from a
    // regular user has to name the labeler explicitly.
    proxyHeader = `${network.ozone.ctx.cfg.service.did}#atproto_labeler`
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  async function callAppeal(body: object, did: DidString) {
    return sc.agent.call(
      'tools.ozone.inbox.appealActionedSubject',
      undefined,
      { reason: 'Please reconsider this decision', ...body },
      {
        encoding: 'application/json',
        headers: { ...sc.getHeaders(did), 'atproto-proxy': proxyHeader },
      },
    )
  }

  async function appeal(actionId: number, did: DidString) {
    return callAppeal({ actionId }, did)
  }

  async function legacyAppeal(did: DidString) {
    return callAppeal(
      { subject: { $type: 'com.atproto.admin.defs#repoRef', did } },
      did,
    )
  }

  async function appealRecord(
    ref: { uriStr: string; cidStr: string },
    did: DidString,
  ) {
    return callAppeal(
      {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: ref.uriStr,
          cid: ref.cidStr,
        },
      },
      did,
    )
  }

  // The response deliberately withholds the appeal report ID, so tests that
  // need the underlying row look it up the way a moderator surface would.
  async function latestAppealReport(did: DidString) {
    return network.ozone.ctx.db.db
      .selectFrom('report')
      .where('reportType', '=', REASONAPPEAL)
      .where('did', '=', did)
      .orderBy('id', 'desc')
      .selectAll()
      .executeTakeFirstOrThrow()
  }

  async function closeLatestAppeal(did: DidString) {
    const report = await latestAppealReport(did)
    await network.ozone.ctx.db.db
      .updateTable('report')
      .where('id', '=', report.id)
      .set({ status: 'closed', closedAt: new Date().toISOString() })
      .execute()
    return report.id
  }

  // Match the client's own subject union rather than `object`, so a malformed
  // literal in a test fails at build time instead of at request time.
  type EmitSubject = Parameters<ModeratorClient['emitEvent']>[0]['subject']

  async function takedown(subject: EmitSubject) {
    return modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject,
    })
  }

  async function label(subject: EmitSubject) {
    return modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['!warn'],
        negateLabelVals: [],
      },
      subject,
    })
  }

  it('creates a linked appeal in the original report queue', async () => {
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }
    const sourceReport = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: 'com.atproto.moderation.defs#reasonSpam',
      },
      subject,
    })
    const queue = await network.ozone.ctx
      .queueService(network.ozone.ctx.db)
      .create({
        name: 'Appeal source queue',
        description: null,
        subjectTypes: ['record'],
        collection: null,
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
        recommendedPolicies: [],
        createdBy: network.ozone.adminAccnt.did,
      })
    await network.ozone.ctx
      .queueService(network.ozone.ctx.db)
      .insertReportsFromEvents({
        cursor: sourceReport.id - 1,
        limit: 1,
      })
    const action = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
      },
      subject,
    })
    const source = await network.ozone.ctx.db.db
      .selectFrom('report')
      .where('eventId', '=', sourceReport.id)
      .select('id')
      .executeTakeFirstOrThrow()
    await network.ozone.ctx.db.db
      .updateTable('report')
      .where('id', '=', source.id)
      .set({ actionEventIds: jsonb([action.id]) })
      .execute()

    const response = await appeal(action.id, sc.dids.bob)
    const report = await latestAppealReport(sc.dids.bob)

    expect(response.data).toMatchObject({
      subject: { $type: 'com.atproto.repo.strongRef', uri: subject.uri },
      appeal: { state: 'pending' },
      // The appealed action, not the appeal, dates the subject.
      createdAt: action.createdAt,
    })
    expect(report).toMatchObject({
      queueId: queue.id,
      status: 'queued',
      reportType: REASONAPPEAL,
      actionEventIds: [action.id],
      did: sc.dids.bob,
    })
  })

  it('does not reveal actions belonging to another user', async () => {
    const action = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
      },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol,
      },
    })

    await expect(appeal(action.id, sc.dids.alice)).rejects.toMatchObject({
      error: 'NotAppealable',
    })
  })

  it('creates an unlinked subject appeal when actionId is omitted', async () => {
    const response = await legacyAppeal(sc.dids.carol)
    const report = await latestAppealReport(sc.dids.carol)

    expect(response.data).toMatchObject({
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      appeal: { state: 'pending' },
    })
    expect(report).toMatchObject({
      reportType: REASONAPPEAL,
      actionEventIds: null,
      did: sc.dids.carol,
    })
  })

  it('requires exactly one appeal target', async () => {
    await expect(callAppeal({}, sc.dids.alice)).rejects.toMatchObject({
      error: 'InvalidAppealTarget',
    })
  })

  it('rejects duplicate active appeals for the same action', async () => {
    const action = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['!warn'],
        negateLabelVals: [],
      },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })

    await appeal(action.id, sc.dids.alice)
    await expect(appeal(action.id, sc.dids.alice)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
  })

  it('rejects moderation events that are not public decisions', async () => {
    const action = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventComment',
        comment: 'Internal note',
      },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })

    await expect(appeal(action.id, sc.dids.alice)).rejects.toMatchObject({
      error: 'NotAppealable',
    })
  })

  it('allows a record only one appeal ever, closed appeals included', async () => {
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: sc.posts[sc.dids.dan][0].ref.uriStr,
      cid: sc.posts[sc.dids.dan][0].ref.cidStr,
    }
    const first = await takedown(subject)
    await appeal(first.id, sc.dids.dan)
    await closeLatestAppeal(sc.dids.dan)

    // A different action on the same record does not earn a second appeal.
    const second = await label(subject)
    await expect(appeal(second.id, sc.dids.dan)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
  })

  it('matches an existing appeal by subject rather than by action', async () => {
    const post = sc.posts[sc.dids.dan][1].ref
    const action = await takedown({
      $type: 'com.atproto.repo.strongRef',
      uri: post.uriStr,
      cid: post.cidStr,
    })
    await appeal(action.id, sc.dids.dan)

    // Same record, reached through the legacy subject form.
    await expect(appealRecord(post, sc.dids.dan)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
  })

  it('lets an account appeal a later action once the previous appeal closes', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: sc.dids.dan,
    }
    const first = await takedown(subject)
    await appeal(first.id, sc.dids.dan)

    const second = await label(subject)
    await expect(appeal(second.id, sc.dids.dan)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })

    const firstReportId = await closeLatestAppeal(sc.dids.dan)
    await appeal(second.id, sc.dids.dan)
    const secondReport = await latestAppealReport(sc.dids.dan)
    expect(secondReport.id).not.toBe(firstReportId)
  })

  it('returns a subject view that satisfies the published lexicon', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: sc.dids.bob,
    }
    const action = await takedown(subject)
    const { data } = await appeal(action.id, sc.dids.bob)

    expect(validateSubjectView(data).success).toBe(true)
    expect(data).toEqual({
      src: network.ozone.ctx.cfg.service.did,
      subject,
      enforcement: { state: 'takendown', scope: 'network' },
      appeal: {
        state: 'pending',
        appealedAt: data.appeal.appealedAt,
        appealableUntil: appealWindowEnd(
          action.createdAt,
          network.ozone.ctx.cfg.inbox.appealWindowMonths,
        ),
      },
      availableActions: [],
      latestAction: {
        id: action.id,
        type: 'accountTakedown',
        scope: 'network',
        createdAt: action.createdAt,
      },
      actionCount: 1,
      createdAt: action.createdAt,
      updatedAt: data.updatedAt,
    })
    // The appeal report ID stays server-side, and read state waits on a
    // watermark Ozone does not store yet.
    expect(data).not.toHaveProperty('reportId')
    expect(data).not.toHaveProperty('isRead')
  })

  it('derives a suspension, its expiry, and the six-month appeal window', async () => {
    const post = sc.posts[sc.dids.alice][0].ref
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: post.uriStr,
      cid: post.cidStr,
    }
    const action = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        durationInHours: 72,
        policies: ['spam-automation'],
      },
      subject,
    })
    const { data } = await appeal(action.id, sc.dids.alice)

    // A record takedown reads as "removed" whether or not it has a duration.
    expect(data.enforcement).toMatchObject({ state: 'removed' })
    expect(data.enforcement.expiresAt).toBeDefined()
    expect(data.latestAction).toMatchObject({
      type: 'contentRemoved',
      policies: ['spam-automation'],
    })
    expect(data.appeal.appealableUntil).toBe(
      appealWindowEnd(
        action.createdAt,
        network.ozone.ctx.cfg.inbox.appealWindowMonths,
      ),
    )
  })

  it('lets a takedown outrank a label while still listing it', async () => {
    const post = sc.posts[sc.dids.alice][1].ref
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: post.uriStr,
      cid: post.cidStr,
    }
    await label(subject)
    const action = await takedown(subject)
    const { data } = await appeal(action.id, sc.dids.alice)

    expect(data.enforcement).toMatchObject({
      state: 'removed',
      labels: ['!warn'],
    })
    expect(data.actionCount).toBe(2)
  })

  it('folds a reversal into the action it undid rather than counting it', async () => {
    const post = sc.posts[sc.dids.alice][2].ref
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: post.uriStr,
      cid: post.cidStr,
    }
    await takedown(subject)
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventReverseTakedown' },
      subject,
    })
    const action = await takedown(subject)
    const { data } = await appeal(action.id, sc.dids.alice)

    // Two takedowns, one reversal: the reversal is not an action of its own.
    expect(data.actionCount).toBe(2)
    expect(data.latestAction).toMatchObject({
      id: action.id,
      type: 'contentRemoved',
    })
    expect(data.latestAction).not.toHaveProperty('reversedAt')
  })

  it('never leaks moderator-only text', async () => {
    const post = sc.posts[sc.dids.carol][0].ref
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: post.uriStr,
      cid: post.cidStr,
    }
    const action = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        comment: 'MODERATOR-ONLY-REASONING',
      },
      subject,
    })
    const { data } = await appeal(action.id, sc.dids.carol)

    expect(JSON.stringify(data)).not.toContain('MODERATOR-ONLY-REASONING')
  })
  it('refuses an unauthenticated caller', async () => {
    await expect(
      sc.agent.call(
        'tools.ozone.inbox.appealActionedSubject',
        undefined,
        { reason: 'Please reconsider this decision', actionId: 1 },
        {
          encoding: 'application/json',
          headers: { 'atproto-proxy': proxyHeader },
        },
      ),
    ).rejects.toMatchObject({ status: 401 })
  })

  it('hides a nonexistent action behind the same error as an inaccessible one', async () => {
    await expect(appeal(999_999, sc.dids.alice)).rejects.toMatchObject({
      error: 'NotAppealable',
    })
  })

  it("refuses to appeal another user's content", async () => {
    const post = sc.posts[sc.dids.bob][1].ref
    const action = await takedown({
      $type: 'com.atproto.repo.strongRef',
      uri: post.uriStr,
      cid: post.cidStr,
    })

    await expect(appeal(action.id, sc.dids.alice)).rejects.toMatchObject({
      error: 'NotAppealable',
    })
  })

  it('rejects naming both an action and a subject', async () => {
    await expect(
      callAppeal(
        {
          actionId: 1,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
        },
        sc.dids.carol,
      ),
    ).rejects.toMatchObject({ error: 'InvalidAppealTarget' })
  })

  it('writes nothing when the appeal is rejected', async () => {
    const account = await sc.createAccount('rollback', {
      handle: 'rollback.test',
      email: 'rollback@test.com',
      password: 'rollback-pass',
    })
    const action = await takedown({
      $type: 'com.atproto.admin.defs#repoRef',
      did: account.did,
    })
    await appeal(action.id, account.did)

    const countEvents = async () =>
      network.ozone.ctx.db.db
        .selectFrom('moderation_event')
        .where('subjectDid', '=', account.did)
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow()

    const before = await countEvents()
    await expect(appeal(action.id, account.did)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
    // The rejected attempt must not leave a stray report event behind.
    expect(await countEvents()).toEqual(before)
  })

  it('leaves the appeal unassigned when the source reports disagree', async () => {
    const account = await sc.createAccount('ambiguous', {
      handle: 'ambiguous.test',
      email: 'ambiguous@test.com',
      password: 'ambiguous-pass',
    })
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: account.did,
    }
    const action = await takedown(subject)

    // Two source reports linked to the same action, sitting in different
    // queues: there is no single queue to inherit.
    const [queueA, queueB] = await Promise.all(
      ['Ambiguous queue A', 'Ambiguous queue B'].map((name) =>
        network.ozone.ctx.queueService(network.ozone.ctx.db).create({
          name,
          description: null,
          subjectTypes: ['account'],
          collection: null,
          reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
          recommendedPolicies: [],
          createdBy: network.ozone.adminAccnt.did,
        }),
      ),
    )
    await network.ozone.ctx.db.db
      .insertInto('report')
      .values(
        [queueA.id, queueB.id].map((queueId) => ({
          eventId: action.id * 1000 + queueId,
          queueId,
          queuedAt: new Date().toISOString(),
          actionEventIds: jsonb([action.id]),
          actionNote: null,
          isMuted: false,
          isAutomated: false,
          status: 'queued',
          reportType: 'com.atproto.moderation.defs#reasonSpam',
          did: account.did,
          recordPath: '',
          subjectMessageId: null,
          subjectConvoId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      )
      .execute()

    await appeal(action.id, account.did)
    const report = await latestAppealReport(account.did)
    expect(report).toMatchObject({
      queueId: -1,
      queuedAt: null,
      status: 'open',
    })
  })

  it('never inherits a queue from another appeal report', async () => {
    const account = await sc.createAccount('appealsource', {
      handle: 'appealsource.test',
      email: 'appealsource@test.com',
      password: 'appealsource-pass',
    })
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: account.did,
    }
    const action = await takedown(subject)
    const queue = await network.ozone.ctx
      .queueService(network.ozone.ctx.db)
      .create({
        name: 'Appeal-only queue',
        description: null,
        subjectTypes: ['account'],
        collection: null,
        reportTypes: [REASONAPPEAL],
        recommendedPolicies: [],
        createdBy: network.ozone.adminAccnt.did,
      })

    // An existing appeal report in a queue, linked to the same action. It is
    // not a source of truth for where a new appeal belongs.
    await appeal(action.id, account.did)
    const existing = await latestAppealReport(account.did)
    await network.ozone.ctx.db.db
      .updateTable('report')
      .where('id', '=', existing.id)
      .set({
        queueId: queue.id,
        status: 'closed',
        closedAt: new Date().toISOString(),
      })
      .execute()

    const second = await label(subject)
    await appeal(second.id, account.did)
    expect(await latestAppealReport(account.did)).toMatchObject({
      queueId: -1,
    })
  })

  it('accepts an appeal from a reporting-muted user and marks it muted', async () => {
    const account = await sc.createAccount('muted', {
      handle: 'muted.test',
      email: 'muted@test.com',
      password: 'muted-pass',
    })
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: account.did,
    }
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventMuteReporter',
        durationInHours: 24,
      },
      subject,
    })
    const action = await takedown(subject)

    // A reporting mute applies to appeals too. The appeal is recorded, flagged,
    // and left for the muted-report workflow to handle - it is not an
    // unlimited channel around the mute, nor is it silently dropped.
    await appeal(action.id, account.did)
    expect(await latestAppealReport(account.did)).toMatchObject({
      isMuted: true,
    })
  })

  it('closes the appeal window six months after the action', async () => {
    const account = await sc.createAccount('stale', {
      handle: 'stale.test',
      email: 'stale@test.com',
      password: 'stale-pass',
    })
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: account.did,
    }
    const stale = await takedown(subject)
    const fresh = await label(subject)

    const backdate = async (id: number, createdAt: string) =>
      network.ozone.ctx.db.db
        .updateTable('moderation_event')
        .where('id', '=', id)
        .set({ createdAt })
        .execute()

    const now = Date.now()
    // A day past the window, and a day inside it.
    await backdate(stale.id, new Date(now - 190 * 86_400_000).toISOString())
    await backdate(fresh.id, new Date(now - 170 * 86_400_000).toISOString())

    await expect(appeal(stale.id, account.did)).rejects.toMatchObject({
      error: 'AppealWindowExpired',
    })
    await expect(appeal(fresh.id, account.did)).resolves.toBeDefined()
  })

  it('shows a resolved appeal with its public note and never the internal one', async () => {
    const account = await sc.createAccount('resolved', {
      handle: 'resolved.test',
      email: 'resolved@test.com',
      password: 'resolved-pass',
    })
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: account.did,
    }
    const action = await takedown(subject)
    await appeal(action.id, account.did)
    const report = await latestAppealReport(account.did)

    await ozoneAgent.api.tools.ozone.report.createActivity(
      {
        reportId: report.id,
        activity: { $type: 'tools.ozone.report.defs#closeActivity' },
        publicNote: 'We reviewed this again and the takedown stands.',
        internalNote: 'MODERATOR-ONLY-RATIONALE',
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          'tools.ozone.report.createActivity',
          'admin',
        ),
      },
    )
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventResolveAppeal',
        comment: 'MODERATOR-ONLY-COMMENT',
      },
      subject,
    })

    const view = await hydrateSubjectView(
      network.ozone.ctx.db,
      new RepoSubject(account.did),
      network.ozone.ctx.cfg.service.did,
      network.ozone.ctx.cfg.inbox,
    )

    expect(validateSubjectView(view).success).toBe(true)
    expect(view?.appeal).toMatchObject({
      state: 'resolved',
      note: 'We reviewed this again and the takedown stands.',
    })
    expect(view?.appeal?.resolvedAt).toBeDefined()
    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain('MODERATOR-ONLY-RATIONALE')
    expect(serialized).not.toContain('MODERATOR-ONLY-COMMENT')
  })

  it('returns nothing for a subject with no moderation history', async () => {
    const view = await hydrateSubjectView(
      network.ozone.ctx.db,
      new RecordSubject(
        `at://${sc.dids.dan}/app.bsky.feed.post/never-actioned`,
        'bafyreiunknown',
      ),
      network.ozone.ctx.cfg.service.did,
      network.ozone.ctx.cfg.inbox,
    )
    expect(view).toBeNull()
  })
  it('rejects a malformed appeal target', async () => {
    // Below the lexicon's minimum.
    await expect(callAppeal({ actionId: 0 }, sc.dids.alice)).rejects.toThrow()
    // Not a subject shape the endpoint knows.
    await expect(
      callAppeal(
        { subject: { $type: 'com.example.notASubject' } },
        sc.dids.alice,
      ),
    ).rejects.toThrow()
  })

  it('accepts a legacy appeal for a subject with no action history', async () => {
    const account = await sc.createAccount('legacyrec', {
      handle: 'legacyrec.test',
      email: 'legacyrec@test.com',
      password: 'legacyrec-pass',
    })
    const post = await sc.post(account.did, 'never actioned')

    const { data } = await appealRecord(
      { uriStr: post.ref.uriStr, cidStr: post.ref.cidStr },
      account.did,
    )

    // The legacy form does not require an action, so the view has an appeal but
    // no history to describe and nothing further to offer.
    expect(validateSubjectView(data).success).toBe(true)
    expect(data.appeal).toEqual({
      state: 'pending',
      appealedAt: data.appeal.appealedAt,
    })
    // Nothing appealable on record means no window to advertise.
    expect(data.appeal).not.toHaveProperty('appealableUntil')
    expect(data).not.toHaveProperty('latestAction')
    expect(data).not.toHaveProperty('actionCount')
    expect(data.availableActions).toEqual([])
    // No source report to inherit from leaves the appeal unassigned.
    expect(await latestAppealReport(account.did)).toMatchObject({ queueId: -1 })
  })
  it('loads subjects without leaking one subject into another', async () => {
    const account = await sc.createAccount('batch', {
      handle: 'batch.test',
      email: 'batch@test.com',
      password: 'batch-pass',
    })
    const postA = await sc.post(account.did, 'batch a')
    const postB = await sc.post(account.did, 'batch b')

    const ref = (post: { ref: { uriStr: string; cidStr: string } }) => ({
      $type: 'com.atproto.repo.strongRef' as const,
      uri: post.ref.uriStr,
      cid: post.ref.cidStr,
    })
    // One action on the account, two on one of its records.
    await takedown({
      $type: 'com.atproto.admin.defs#repoRef',
      did: account.did,
    })
    await label(ref(postA))
    await takedown(ref(postA))

    const subjects = [
      new RepoSubject(account.did),
      new RecordSubject(postA.ref.uriStr, postA.ref.cidStr),
      new RecordSubject(postB.ref.uriStr, postB.ref.cidStr),
    ]
    const [accountSnapshot, postASnapshot, postBSnapshot] = await Promise.all(
      subjects.map((subject) => loadSubject(network.ozone.ctx.db, subject)),
    )

    // The account's own history, not its records'.
    expect(accountSnapshot).toMatchObject({
      actionCount: 1,
    })
    expect(postASnapshot).toMatchObject({
      actionCount: 2,
    })
    // A record nothing has happened to still gets an empty snapshot.
    expect(postBSnapshot).toMatchObject({
      actionCount: 0,
      events: [],
      appealReport: null,
    })
  })
  it("keeps an account's chat moderation out of its account history", async () => {
    const account = await sc.createAccount('chatty', {
      handle: 'chatty.test',
      email: 'chatty@test.com',
      password: 'chatty-pass',
    })
    const convoId = 'convo-for-chatty'
    const messageId = 'message-for-chatty'

    // One action on the account, plus chat actions on the same DID. Messages
    // and conversations both carry a null subjectUri, so they are only
    // distinguishable from the account by their own id columns.
    await takedown({
      $type: 'com.atproto.admin.defs#repoRef',
      did: account.did,
    })
    await takedown({
      $type: 'chat.bsky.convo.defs#messageRef',
      did: account.did,
      convoId,
      messageId,
    })
    // A label rather than a takedown: a message and its conversation share one
    // subject status row, so the second takedown would be refused.
    await label({
      $type: 'chat.bsky.convo.defs#convoRef',
      did: account.did,
      convoId,
    })

    const subjects = [
      new RepoSubject(account.did),
      new MessageSubject(account.did, convoId, messageId),
      new ConvoSubject(account.did, convoId),
    ]
    const [accountSnapshot, messageSnapshot, convoSnapshot] = await Promise.all(
      subjects.map((subject) => loadSubject(network.ozone.ctx.db, subject)),
    )

    expect(accountSnapshot).toMatchObject({
      actionCount: 1,
    })
    expect(messageSnapshot).toMatchObject({
      actionCount: 1,
    })
    expect(convoSnapshot).toMatchObject({
      actionCount: 1,
    })
  })
  it('never offers an appeal that submission would refuse', async () => {
    const account = await sc.createAccount('superseded', {
      handle: 'superseded.test',
      email: 'superseded@test.com',
      password: 'superseded-pass',
    })
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: account.did,
    }
    const action = await label(subject)
    await appeal(action.id, account.did)

    // A takedown clears `appealed` without anyone working the appeal, so its
    // report is still open in a queue. The subject reads as superseded.
    await takedown(subject)
    const view = await hydrateSubjectView(
      network.ozone.ctx.db,
      new RepoSubject(account.did),
      network.ozone.ctx.cfg.service.did,
      network.ozone.ctx.cfg.inbox,
    )
    expect(view?.appeal?.state).toBe('superseded')

    // The open appeal still blocks a new one, so the view must not advertise
    // an appeal the endpoint is going to reject.
    expect(view?.availableActions).toEqual([])
    await expect(appeal(action.id, account.did)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
  })
  it('shows a moderator email in the history but does not let it be appealed', async () => {
    const account = await sc.createAccount('emailed', {
      handle: 'emailed.test',
      email: 'emailed@test.com',
      password: 'emailed-pass',
    })
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: account.did,
    }
    const action = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventEmail',
        subjectLine: 'About your recent post',
        comment: 'warning',
        strikeCount: 1,
      },
      subject,
    })

    // An email logs a communication; it asserts no enforcement to reverse.
    await expect(appeal(action.id, account.did)).rejects.toMatchObject({
      error: 'NotAppealable',
    })

    const view = await hydrateSubjectView(
      network.ozone.ctx.db,
      new RepoSubject(account.did),
      network.ozone.ctx.cfg.service.did,
      network.ozone.ctx.cfg.inbox,
    )
    // Still part of the history the user can see...
    expect(view?.latestAction).toMatchObject({ type: 'communicationSent' })
    expect(view?.actionCount).toBe(1)
    // ...but it opens no appeal window and offers nothing.
    expect(view?.appeal).toEqual({ state: 'none' })
    expect(view?.availableActions).toEqual([])
  })
  it('accepts an appeal with no explanation', async () => {
    const account = await sc.createAccount('terse', {
      handle: 'terse.test',
      email: 'terse@test.com',
      password: 'terse-pass',
    })
    const action = await takedown({
      $type: 'com.atproto.admin.defs#repoRef',
      did: account.did,
    })

    // Filing an appeal is a request for review; making the user argue their
    // case is not a precondition for getting one.
    const { data } = await sc.agent.call(
      'tools.ozone.inbox.appealActionedSubject',
      undefined,
      { actionId: action.id },
      {
        encoding: 'application/json',
        headers: {
          ...sc.getHeaders(account.did),
          'atproto-proxy': proxyHeader,
        },
      },
    )

    expect(validateSubjectView(data).success).toBe(true)
    expect(data.appeal).toMatchObject({ state: 'pending' })
    const report = await latestAppealReport(account.did)
    expect(report).toMatchObject({ reportType: REASONAPPEAL })
  })
})
