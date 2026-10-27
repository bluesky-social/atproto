import type { AtpAgent, ToolsOzoneQueueCreateQueue } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { toDatetimeString } from '@atproto/lex'
import type { DidString } from '@atproto/syntax'
import { jsonb } from '../src/db/types.js'
import { APPEAL_REASON_TYPE, appealWindowEnd } from '../src/inbox/appeal.js'
import { loadSubject } from '../src/inbox/views.js'
import { com, tools } from '../src/lexicons/index.js'
import {
  ConvoSubject,
  MessageSubject,
  RecordSubject,
  RepoSubject,
} from '../src/mod-service/subject.js'
import { reportForEvent } from './_inbox.js'

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
    // @NOTE Queues survive the fixture's ordinary row cleanup. Remove this
    // suite's old queues through the API so repeated local runs stay isolated.
    for (;;) {
      const { data } = await ozoneAgent.tools.ozone.queue.listQueues(
        { limit: 100 },
        {
          headers: await network.ozone.modHeaders(
            'tools.ozone.queue.listQueues',
            'admin',
          ),
        },
      )
      if (!data.queues.length) break
      for (const queue of data.queues) {
        await ozoneAgent.tools.ozone.queue.deleteQueue(
          { queueId: queue.id },
          {
            headers: await network.ozone.modHeaders(
              'tools.ozone.queue.deleteQueue',
              'admin',
            ),
            encoding: 'application/json',
          },
        )
      }
    }
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

  async function getAccountView(did: DidString) {
    const { data } = await sc.agent.call(
      'tools.ozone.inbox.listActionedSubjects',
      {},
      undefined,
      {
        headers: { ...sc.getHeaders(did), 'atproto-proxy': proxyHeader },
      },
    )
    const view = data.subjects.find(
      (view: { subject: { did?: string } }) => view.subject.did === did,
    )
    if (!view) throw new Error('No account view returned')
    return view
  }

  async function appeal(actionId: number, did: DidString) {
    let event:
      | Awaited<ReturnType<ModeratorClient['queryEvents']>>['events'][number]
      | undefined
    let cursor: string | undefined
    do {
      const page = await modClient.queryEvents({ limit: 100, cursor })
      event = page.events.find((event) => event.id === actionId)
      cursor = page.cursor
    } while (!event && cursor)
    const subject = event?.subject ?? {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did,
    }
    return callAppeal(
      {
        action: {
          $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
          id: actionId,
        },
        subject,
      },
      did,
    )
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

  async function appealLabel(
    val: string,
    subject: EmitSubject,
    did: DidString,
  ) {
    return callAppeal(
      {
        action: {
          $type: 'tools.ozone.inbox.appealActionedSubject#labelRef',
          val,
        },
        subject,
      },
      did,
    )
  }

  async function appealTakedown(subject: EmitSubject, did: DidString) {
    return callAppeal(
      {
        action: {
          $type: 'tools.ozone.inbox.appealActionedSubject#takedownRef',
        },
        subject,
      },
      did,
    )
  }

  // The response deliberately withholds the appeal report ID, so tests that
  // need the underlying row look it up the way a moderator surface would.
  async function latestAppealReport(did: DidString) {
    const { events } = await modClient.queryEvents({
      subject: did,
      includeAllUserRecords: true,
      types: [tools.ozone.moderation.defs.modEventReport.$type],
      limit: 100,
      reportTypes: [APPEAL_REASON_TYPE],
    })
    const appealEvent = events[0]
    if (!appealEvent) throw new Error('No appeal event returned')
    return { ...(await reportForEvent(modClient, appealEvent.id)), did }
  }

  async function closeLatestAppeal(did: DidString) {
    const report = await latestAppealReport(did)
    await ozoneAgent.tools.ozone.report.createActivity(
      {
        reportId: report.id,
        activity: { $type: 'tools.ozone.report.defs#closeActivity' },
      },
      {
        headers: await network.ozone.modHeaders(
          'tools.ozone.report.createActivity',
          'admin',
        ),
        encoding: 'application/json',
      },
    )
    return report.id
  }

  // Match the client's own subject union rather than `object`, so a malformed
  // literal in a test fails at build time instead of at request time.
  type EmitSubject = Parameters<ModeratorClient['emitEvent']>[0]['subject']

  const seededRecordSubject = (name: string, did = sc.dids.alice) => ({
    $type: 'com.atproto.repo.strongRef' as const,
    uri: `at://${did}/app.bsky.feed.post/${name}`,
    cid: sc.posts[did][0].ref.cidStr,
  })

  async function takedown(subject: EmitSubject, reportIds?: number[]) {
    return modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject,
      reportAction: reportIds ? { ids: reportIds } : undefined,
    })
  }

  async function label(subject: EmitSubject, reportIds?: number[]) {
    return modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['!warn'],
        negateLabelVals: [],
      },
      subject,
      reportAction: reportIds ? { ids: reportIds } : undefined,
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
    await network.ozone.ctx.db.transaction((txn) =>
      network.ozone.ctx.queueService(txn).insertReportsFromEvents({
        cursor: sourceReport.id - 1,
        limit: 1,
      }),
    )
    const source = await reportForEvent(modClient, sourceReport.id)
    const action = await takedown(subject, [source.id])

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
      reportType: APPEAL_REASON_TYPE,
      actionEventIds: [action.id],
      did: sc.dids.bob,
    })
    const storedReport = await network.ozone.ctx.db.db
      .selectFrom('report')
      .where('id', '=', report.id)
      .select(['eventId', 'reporterDid'])
      .executeTakeFirstOrThrow()
    expect(storedReport.reporterDid).toBe(sc.dids.bob)
    const appealEvent = await network.ozone.ctx.db.db
      .selectFrom('moderation_event')
      .where('id', '=', storedReport.eventId)
      .select('createdBy')
      .executeTakeFirstOrThrow()
    expect(storedReport.reporterDid).toBe(appealEvent.createdBy)
    const { subjectStatuses } = await modClient.queryStatuses({
      subject: subject.uri,
    })
    expect(subjectStatuses).toHaveLength(1)
    expect(subjectStatuses[0].tags).not.toContain('report:appeal')
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

  it.each(['admin', 'moderator', 'triage'] as const)(
    'lets an %s file an appeal on behalf of a user',
    async (role) => {
      const subject = {
        $type: 'com.atproto.repo.strongRef' as const,
        uri: `at://${sc.dids.alice}/app.bsky.feed.post/mod-appeal-${role}`,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      }
      const action = await takedown(subject)

      const response = await ozoneAgent.call(
        'tools.ozone.inbox.appealActionedSubject',
        undefined,
        {
          action: {
            $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
            id: action.id,
          },
          subject,
        },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders(
            'tools.ozone.inbox.appealActionedSubject',
            role,
          ),
        },
      )

      expect(response.data).toMatchObject({
        subject,
        appeal: { state: 'pending' },
      })
      expect(await latestAppealReport(sc.dids.alice)).toMatchObject({
        actionEventIds: [action.id],
      })
      const appealReport = await latestAppealReport(sc.dids.alice)
      const { events } = await modClient.queryEvents({
        subject: subject.uri,
        types: [tools.ozone.moderation.defs.modEventReport.$type],
      })
      const appealEvent = events.find(
        (event) => event.id === appealReport.eventId,
      )!
      expect(appealEvent.createdBy).toBe(sc.dids.alice)
      expect(appealEvent.event).toMatchObject({
        appealSubmittedBy:
          role === 'admin'
            ? network.ozone.adminAccnt.did
            : role === 'moderator'
              ? network.ozone.moderatorAccnt.did
              : network.ozone.triageAccnt.did,
      })
    },
  )

  it('routes a labelRef through the report actioned by that label event', async () => {
    const subject = seededRecordSubject('label-ref')
    const sourceReport = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: 'com.atproto.moderation.defs#reasonSpam',
      },
      subject,
    })
    await network.ozone.ctx.db.transaction((txn) =>
      network.ozone.ctx
        .queueService(txn)
        .insertReportsFromEvents({ cursor: sourceReport.id - 1, limit: 1 }),
    )
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['not-warn'],
        negateLabelVals: [],
      },
      subject,
    })
    const source = await reportForEvent(modClient, sourceReport.id)
    const action = await label(subject, [source.id])

    await appealLabel('!warn', subject, sc.dids.alice)

    expect(await latestAppealReport(sc.dids.alice)).toMatchObject({
      queueId: source.queueId,
      actionEventIds: [action.id],
    })
  })

  it('routes a takedownRef through the report actioned by the takedown event', async () => {
    const subject = seededRecordSubject('takedown-ref')
    const sourceReport = await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: 'com.atproto.moderation.defs#reasonSpam',
      },
      subject,
    })
    await network.ozone.ctx.db.transaction((txn) =>
      network.ozone.ctx
        .queueService(txn)
        .insertReportsFromEvents({ cursor: sourceReport.id - 1, limit: 1 }),
    )
    const source = await reportForEvent(modClient, sourceReport.id)
    const action = await takedown(subject, [source.id])

    await appealTakedown(subject, sc.dids.alice)

    expect(await latestAppealReport(sc.dids.alice)).toMatchObject({
      queueId: source.queueId,
      actionEventIds: [action.id],
    })
  })

  it('routes a missing label event through the configured label mapping', async () => {
    const subject = seededRecordSubject('missing-label-ref')
    const queue = await network.ozone.ctx
      .queueService(network.ozone.ctx.db)
      .create({
        name: 'Missing label fallback queue',
        subjectTypes: [],
        reportTypes: [],
        recommendedPolicies: [],
        recommendedLabels: ['label-that-was-never-applied'],
        createdBy: network.ozone.adminAccnt.did,
      })

    await appealLabel('label-that-was-never-applied', subject, sc.dids.alice)

    const report = await latestAppealReport(sc.dids.alice)
    expect(report).toMatchObject({
      queueId: queue.id,
      status: 'queued',
      actionEventIds: null,
    })
    const { events } = await modClient.queryEvents({
      subject: subject.uri,
      types: [tools.ozone.moderation.defs.modEventReport.$type],
    })
    const event = events.find((event) => event.id === report.eventId)!
    expect(event.event).toMatchObject({
      appealActionType: 'tools.ozone.inbox.appealActionedSubject#labelRef',
      appealLabel: 'label-that-was-never-applied',
    })
  })

  describe('tag-based queue routing', () => {
    let sequence = 0
    const reporterTag = 'appeal-reporter'
    const accountTag = 'appeal-account'
    const createdQueues: number[] = []
    const taggedSubjects: { subject: EmitSubject; tags: string[] }[] = []

    async function createQueue(
      input: Partial<ToolsOzoneQueueCreateQueue.InputSchema>,
    ) {
      const { data } = await ozoneAgent.tools.ozone.queue.createQueue(
        {
          name: `Appeal tag routing ${++sequence}`,
          subjectTypes: ['account', 'record'],
          reportTypes: [APPEAL_REASON_TYPE],
          ...input,
        },
        {
          headers: await network.ozone.modHeaders(
            tools.ozone.queue.createQueue.$lxm,
            'admin',
          ),
        },
      )
      createdQueues.push(data.queue.id)
      return data.queue
    }

    async function tagSubject(
      subject: EmitSubject,
      add: string[],
      remove: string[] = [],
    ) {
      await modClient.emitEvent({
        subject,
        event: tools.ozone.moderation.defs.modEventTag.$build({ add, remove }),
      })
      if (add.length) taggedSubjects.push({ subject, tags: add })
    }

    async function tagAccount(did: DidString, tags: string[]) {
      await tagSubject(com.atproto.admin.defs.repoRef.$build({ did }), tags)
    }

    async function routingSubject(subjectType: 'account' | 'record') {
      const name = `tag-appeal-${++sequence}`
      if (subjectType === 'record') {
        return { subject: seededRecordSubject(name), did: sc.dids.alice }
      }
      const account = await sc.createAccount(name, {
        handle: `${name}.test`,
        email: `${name}@test.com`,
        password: 'tag-appeal-password',
      })
      return {
        subject: com.atproto.admin.defs.repoRef.$build({ did: account.did }),
        did: account.did,
      }
    }

    async function activities(reportId: number) {
      return (
        await ozoneAgent.tools.ozone.report.listActivities(
          { reportId },
          {
            headers: await network.ozone.modHeaders(
              tools.ozone.report.listActivities.$lxm,
              'admin',
            ),
          },
        )
      ).data.activities
    }

    afterEach(async () => {
      for (const { subject, tags } of taggedSubjects.splice(0)) {
        await tagSubject(subject, [], tags)
      }
      for (const queueId of createdQueues.splice(0)) {
        await ozoneAgent.tools.ozone.queue.deleteQueue(
          { queueId },
          {
            headers: await network.ozone.modHeaders(
              tools.ozone.queue.deleteQueue.$lxm,
              'admin',
            ),
          },
        )
      }
    })

    it.each(['reporterTags', 'accountTags'] as const)(
      'inherits a %s source queue ahead of current tags and preserves it on replay',
      async (criterion) => {
        const { subject, did } = await routingSubject('record')
        const sourceTag = 'appeal-source'
        const sourceDid = criterion === 'reporterTags' ? sc.dids.bob : did
        const sourceQueue = await createQueue({
          [criterion]: [sourceTag],
          reportTypes: ['appeal-source-reason'],
        })
        const unusedCriterion =
          criterion === 'reporterTags' ? 'accountTags' : 'reporterTags'
        await network.ozone.ctx.db.db
          .updateTable('report_queue')
          .set({ [unusedCriterion]: null })
          .where('id', '=', sourceQueue.id)
          .execute()
        await tagAccount(sourceDid, [sourceTag])
        const sourceEvent = await sc.createReport({
          subject,
          reasonType: 'appeal-source-reason',
          reportedBy: sc.dids.bob,
        })
        const router = network.ozone.daemon.ctx.queueRouter
        await router.routeReports()
        const source = await reportForEvent(modClient, sourceEvent.id)
        expect(source.queueId).toBe(sourceQueue.id)
        const action = await takedown(subject, [source.id])

        await tagSubject(
          com.atproto.admin.defs.repoRef.$build({ did: sourceDid }),
          [],
          [sourceTag],
        )
        await createQueue({
          [unusedCriterion]: [reporterTag],
        })
        await tagAccount(did, [reporterTag])

        await appeal(action.id, did)
        expect(await latestAppealReport(did)).toMatchObject({
          queueId: sourceQueue.id,
          actionEventIds: [action.id],
          status: 'queued',
        })
        const report = await latestAppealReport(did)
        expect(await activities(report.id)).toEqual([])
        await router.routeReports()
        expect((await latestAppealReport(did)).queueId).toBe(sourceQueue.id)
        expect(await activities(report.id)).toEqual([])
      },
    )

    it.each(['account', 'record'] as const)(
      'routes a %s appeal to its label mapping ahead of automatic tag matches',
      async (subjectType) => {
        const { subject, did } = await routingSubject(subjectType)
        await createQueue({})
        const mapped = await createQueue({
          subjectTypes: [],
          reportTypes: [],
          recommendedLabels: ['tag-appeal-label'],
        })
        await createQueue({ accountTags: [accountTag] })
        await createQueue({ reporterTags: [reporterTag] })
        await tagAccount(did, [reporterTag, accountTag])

        await appealLabel('tag-appeal-label', subject, did)

        expect(await latestAppealReport(did)).toMatchObject({
          queueId: mapped.id,
          status: 'queued',
          actionEventIds: null,
        })
        expect(await activities((await latestAppealReport(did)).id)).toEqual([])
      },
    )

    it.each([false, true])(
      'uses the affected account for delegated reporter-tag matching (tagged: %s)',
      async (affectedTagged) => {
        const { subject, did } = await routingSubject('record')
        const submitterTag = 'appeal-submitter'
        const ordinary = await createQueue({})
        const reporting = await createQueue({
          reporterTags: [reporterTag, submitterTag],
        })
        await tagAccount(network.ozone.adminAccnt.did, [submitterTag])
        if (affectedTagged) await tagAccount(did, [reporterTag])
        const action = await takedown(subject)

        await ozoneAgent.call(
          tools.ozone.inbox.appealActionedSubject.$lxm,
          undefined,
          {
            subject,
            action: tools.ozone.inbox.appealActionedSubject.actionRef.$build({
              id: action.id,
            }),
          },
          {
            encoding: 'application/json',
            headers: await network.ozone.modHeaders(
              tools.ozone.inbox.appealActionedSubject.$lxm,
              'admin',
            ),
          },
        )

        expect(await latestAppealReport(did)).toMatchObject({
          queueId: affectedTagged ? reporting.id : ordinary.id,
          reportedBy: did,
          actionEventIds: [action.id],
        })
        const report = await latestAppealReport(did)
        const history = await activities(report.id)
        if (affectedTagged) {
          expect(history).toHaveLength(1)
          expect(history[0]).toMatchObject({
            activity: { $type: tools.ozone.report.defs.noteActivity.$type },
            internalNote: `Automatically routed to queue "${reporting.name}" (ID ${reporting.id}). Matched reporterTags: ["${reporterTag}"].`,
            createdBy: network.ozone.ctx.cfg.service.did,
            isAutomated: true,
          })
          expect(history[0].publicNote).toBeUndefined()
          await network.ozone.daemon.ctx.queueRouter.routeReports()
          expect(await activities(report.id)).toEqual(history)
        } else {
          expect(history).toEqual([])
        }
      },
    )

    it.each([
      { reportTypes: undefined },
      { reportTypes: [] },
      { reportTypes: [com.atproto.moderation.defs.ReasonSpam] },
      { reportTypes: [APPEAL_REASON_TYPE] },
    ])(
      'requires all automatic appeal criteria to match (reportTypes: %j)',
      async ({ reportTypes }) => {
        const { subject, did } = await routingSubject('record')
        const ordinary = await createQueue({})
        const tagged = await createQueue({
          accountTags: [accountTag],
          reportTypes,
        })
        await tagAccount(did, [accountTag])
        await callAppeal({ subject }, did)
        const matches = !!(
          reportTypes as readonly string[] | undefined
        )?.includes(APPEAL_REASON_TYPE)
        const report = await latestAppealReport(did)
        expect(report.queueId).toBe(matches ? tagged.id : ordinary.id)
        const history = await activities(report.id)
        expect(history).toHaveLength(matches ? 1 : 0)
        if (matches) {
          expect(history[0].internalNote).toBe(
            `Automatically routed to queue "${tagged.name}" (ID ${tagged.id}). Matched accountTags: ["${accountTag}"].`,
          )
        }
      },
    )

    it('routes an appeal through an untagged queue with an explicitly selected appeal reason', async () => {
      const { subject, did } = await routingSubject('account')
      const queue = await createQueue({
        subjectTypes: ['account'],
        reportTypes: [APPEAL_REASON_TYPE],
      })
      await callAppeal({ subject }, did)
      expect((await latestAppealReport(did)).queueId).toBe(queue.id)
    })

    it('keeps label mapping ahead of ordinary matching when tags do not match', async () => {
      const { subject, did } = await routingSubject('record')
      await createQueue({})
      await createQueue({ accountTags: [accountTag] })
      const mapped = await createQueue({
        subjectTypes: [],
        reportTypes: [],
        recommendedLabels: ['tag-appeal-label'],
      })
      await tagSubject(subject, [accountTag])

      await appealLabel('tag-appeal-label', subject, did)

      expect((await latestAppealReport(did)).queueId).toBe(mapped.id)
    })

    it('uses ordinary appeal matching when no tags or label destination match', async () => {
      const { subject, did } = await routingSubject('record')
      const ordinary = await createQueue({})
      await createQueue({ accountTags: [accountTag] })

      await callAppeal({ subject }, did)

      expect((await latestAppealReport(did)).queueId).toBe(ordinary.id)
    })

    it('skips disabled and deleted tag queues before falling back to a label mapping', async () => {
      const { subject, did } = await routingSubject('record')
      const disabled = await createQueue({ accountTags: [accountTag] })
      const deleted = await createQueue({
        reporterTags: [reporterTag],
      })
      await ozoneAgent.tools.ozone.queue.updateQueue(
        { queueId: disabled.id, enabled: false },
        {
          headers: await network.ozone.modHeaders(
            tools.ozone.queue.updateQueue.$lxm,
            'admin',
          ),
        },
      )
      await ozoneAgent.tools.ozone.queue.deleteQueue(
        { queueId: deleted.id },
        {
          headers: await network.ozone.modHeaders(
            tools.ozone.queue.deleteQueue.$lxm,
            'admin',
          ),
        },
      )
      createdQueues.splice(createdQueues.indexOf(deleted.id), 1)
      const mapped = await createQueue({
        subjectTypes: [],
        reportTypes: [],
        recommendedLabels: ['tag-appeal-label'],
      })
      await tagAccount(did, [accountTag, reporterTag])

      await appealLabel('tag-appeal-label', subject, did)

      expect((await latestAppealReport(did)).queueId).toBe(mapped.id)
    })

    it('uses tag fallback when linked source reports disagree and retains the action link', async () => {
      const { subject, did } = await routingSubject('record')
      const sourceIds: number[] = []
      for (let count = 0; count < 2; count++) {
        const queue = await createQueue({ subjectTypes: [], reportTypes: [] })
        const event = await modClient.emitEvent({
          subject,
          event: tools.ozone.moderation.defs.modEventReport.$build({
            reportType: com.atproto.moderation.defs.ReasonSpam,
          }),
          modTool: { name: 'test-tool', meta: { queueId: queue.id } },
        })
        await network.ozone.daemon.ctx.queueRouter.routeReports()
        sourceIds.push((await reportForEvent(modClient, event.id)).id)
      }
      const action = await takedown(subject, sourceIds)
      const tagged = await createQueue({ accountTags: [accountTag] })
      await tagAccount(did, [accountTag])

      await appeal(action.id, did)

      expect(await latestAppealReport(did)).toMatchObject({
        queueId: tagged.id,
        actionEventIds: [action.id],
        status: 'queued',
      })
    })
  })

  it('files an actionRef through fallback when its event cannot be found', async () => {
    const subject = seededRecordSubject('missing-action-ref')

    await callAppeal(
      {
        action: {
          $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
          id: 999_999,
        },
        subject,
      },
      sc.dids.alice,
    )

    expect(await latestAppealReport(sc.dids.alice)).toMatchObject({
      actionEventIds: null,
    })
  })

  it('links a semantic reference to the latest matching action', async () => {
    const subject = seededRecordSubject('ambiguous-ref')
    await takedown(subject)
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
      },
      subject,
    })
    const action = await takedown(subject)

    await appealTakedown(subject, sc.dids.alice)

    expect(await latestAppealReport(sc.dids.alice)).toMatchObject({
      queueId: -1,
      status: 'open',
      actionEventIds: [action.id],
    })
  })

  it('creates an unlinked subject appeal when action is omitted', async () => {
    const response = await legacyAppeal(sc.dids.carol)
    const report = await latestAppealReport(sc.dids.carol)

    expect(response.data).toMatchObject({
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      appeal: { state: 'pending' },
    })
    expect(report).toMatchObject({
      reportType: APPEAL_REASON_TYPE,
      actionEventIds: null,
      did: sc.dids.carol,
    })
  })

  it('requires an appeal subject', async () => {
    await expect(callAppeal({}, sc.dids.alice)).rejects.toMatchObject({
      error: 'InvalidRequest',
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

  it('allows a new post action to be appealed after a previous appeal closes', async () => {
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: sc.posts[sc.dids.dan][0].ref.uriStr,
      cid: sc.posts[sc.dids.dan][0].ref.cidStr,
    }
    const first = await takedown(subject)
    await appeal(first.id, sc.dids.dan)
    await closeLatestAppeal(sc.dids.dan)

    await expect(appeal(first.id, sc.dids.dan)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
    const second = await label(subject)
    const detail = await sc.agent.call(
      'tools.ozone.inbox.getActionedSubject',
      { subject: subject.uri },
      undefined,
      {
        headers: {
          ...sc.getHeaders(sc.dids.dan),
          'atproto-proxy': proxyHeader,
        },
      },
    )
    expect(detail.data.availableActions).toEqual(['appeal'])
    const result = await appeal(second.id, sc.dids.dan)
    expect(result.data.availableActions).toEqual([])
    expect(result.data.appeal.state).toBe('pending')
  })

  it('offers a takedown appeal after an earlier label appeal is approved', async () => {
    const account = await sc.createAccount('repeatpost', {
      handle: 'repeatpost.test',
      email: 'repeatpost@test.com',
      password: 'repeatpost-pass',
    })
    const post = await sc.post(account.did, 'a post with two actions')
    const subject = {
      $type: com.atproto.repo.strongRef.$type,
      uri: post.ref.uriStr,
      cid: post.ref.cidStr,
    }
    const first = await label(subject)
    await appeal(first.id, account.did)
    const previous = await latestAppealReport(account.did)
    const removal = await modClient.emitEvent({
      subject,
      event: {
        $type: tools.ozone.moderation.defs.modEventLabel.$type,
        createLabelVals: [],
        negateLabelVals: ['!warn'],
      },
      reportAction: { ids: [previous.id] },
    })
    const detail = () =>
      sc.agent.call(
        tools.ozone.inbox.getActionedSubject.$lxm,
        { subject: subject.uri },
        undefined,
        {
          headers: {
            ...sc.getHeaders(account.did),
            'atproto-proxy': proxyHeader,
          },
        },
      )
    expect((await detail()).data.availableActions).toEqual([])
    await expect(appeal(removal.id, account.did)).rejects.toMatchObject({
      error: 'NotAppealable',
    })

    const second = await takedown(subject)
    expect((await detail()).data.availableActions).toEqual(['appeal'])
    const list = await sc.agent.call(
      tools.ozone.inbox.listActionedSubjects.$lxm,
      {},
      undefined,
      {
        headers: {
          ...sc.getHeaders(account.did),
          'atproto-proxy': proxyHeader,
        },
      },
    )
    const listed = list.data.subjects.find(
      (view: { subject: { uri?: string } }) => view.subject.uri === subject.uri,
    )
    expect(listed?.availableActions).toEqual(['appeal'])
    await appeal(second.id, account.did)
    expect(await latestAppealReport(account.did)).toMatchObject({
      actionEventIds: [second.id],
    })
  })

  it('prevents reopening an older appeal while another is active', async () => {
    const account = await sc.createAccount('reopenappeal', {
      handle: 'reopenappeal.test',
      email: 'reopenappeal@test.com',
      password: 'reopenappeal-pass',
    })
    const subject = com.atproto.admin.defs.repoRef.$build({ did: account.did })
    const first = await label(subject)
    await appeal(first.id, account.did)
    const oldId = await closeLatestAppeal(account.did)
    const second = await takedown(subject)
    await appeal(second.id, account.did)
    const activity = async (
      reportId: number,
      type: 'closeActivity' | 'reopenActivity',
    ) =>
      ozoneAgent.tools.ozone.report.createActivity(
        { reportId, activity: { $type: `tools.ozone.report.defs#${type}` } },
        {
          headers: await network.ozone.modHeaders(
            'tools.ozone.report.createActivity',
            'admin',
          ),
          encoding: 'application/json',
        },
      )
    await expect(activity(oldId, 'reopenActivity')).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
    await closeLatestAppeal(account.did)
    await activity(oldId, 'reopenActivity')
    const view = await getAccountView(account.did)
    expect(view.appeal.state).toBe('pending')
    expect(view.availableActions).toEqual([])
    await activity(oldId, 'closeActivity')
    await expect(appeal(second.id, account.did)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
  })

  it('finds an appealable action beyond the public event window', async () => {
    const account = await sc.createAccount('appealhistory', {
      handle: 'appealhistory.test',
      email: 'appealhistory@test.com',
      password: 'appealhistory-pass',
    })
    const subject = com.atproto.admin.defs.repoRef.$build({ did: account.did })
    const first = await label(subject)
    for (let i = 0; i < 51; i++) {
      await modClient.emitEvent({
        subject,
        event: {
          $type: tools.ozone.moderation.defs.modEventEmail.$type,
          subjectLine: 'Update',
        },
      })
    }
    expect((await getAccountView(account.did)).availableActions).toEqual([
      'appeal',
    ])
    const { data } = await sc.agent.call(
      tools.ozone.inbox.getActionedSubject.$lxm,
      { subject: account.did },
      undefined,
      {
        headers: {
          ...sc.getHeaders(account.did),
          'atproto-proxy': proxyHeader,
        },
      },
    )
    expect(data.availableActions).toEqual(['appeal'])
    await appeal(first.id, account.did)
  })

  it('requires a new action for a subsequent subject-only appeal', async () => {
    const account = await sc.createAccount('subjectappeal', {
      handle: 'subjectappeal.test',
      email: 'subjectappeal@test.com',
      password: 'subjectappeal-pass',
    })
    const subject = com.atproto.admin.defs.repoRef.$build({ did: account.did })
    const first = await label(subject)
    await appeal(first.id, account.did)
    await closeLatestAppeal(account.did)
    await expect(legacyAppeal(account.did)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
    await takedown(subject)
    await legacyAppeal(account.did)
    expect((await getAccountView(account.did)).appeal.state).toBe('pending')
  })

  it('serializes concurrent inbox appeals on the same subject', async () => {
    const account = await sc.createAccount('appealrace', {
      handle: 'appealrace.test',
      email: 'appealrace@test.com',
      password: 'appealrace-pass',
    })
    const subject = com.atproto.admin.defs.repoRef.$build({ did: account.did })
    const action = await takedown(subject)
    const results = await Promise.allSettled([
      appeal(action.id, account.did),
      appeal(action.id, account.did),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    const failed = results.find((result) => result.status === 'rejected')
    expect(failed).toMatchObject({ reason: { error: 'AlreadyAppealed' } })
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
    await expect(appeal(second.id, sc.dids.dan)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
    const third = await label(subject)
    await appeal(third.id, sc.dids.dan)
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

    expect(tools.ozone.inbox.defs.subjectView.safeParse(data).success).toBe(
      true,
    )
    expect(data).toEqual({
      src: network.ozone.ctx.cfg.service.did,
      isRead: false,
      subject,
      enforcement: { state: 'takendown', scope: 'network' },
      appeal: {
        state: 'pending',
        appealedAt: data.appeal.appealedAt,
        appealableUntil: appealWindowEnd(
          toDatetimeString(action.createdAt),
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
    // The appeal report ID stays server-side; no read watermark has been set.
    expect(data).not.toHaveProperty('reportId')
    expect(data.isRead).toBe(false)
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
      policies: [
        {
          key: 'spam-automation',
          displayName: 'spam-automation',
          link: network.ozone.ctx.cfg.inbox.policyDefaultUrl,
        },
      ],
    })
    expect(data.appeal.appealableUntil).toBe(
      appealWindowEnd(
        toDatetimeString(action.createdAt),
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
        {
          reason: 'Please reconsider this decision',
          action: {
            $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
            id: 1,
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.alice,
          },
        },
        {
          encoding: 'application/json',
          headers: { 'atproto-proxy': proxyHeader },
        },
      ),
    ).rejects.toMatchObject({ status: 401 })
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

  it('rejects an actionRef paired with a different subject', async () => {
    await expect(
      callAppeal(
        {
          action: {
            $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
            id: 1,
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
        },
        sc.dids.carol,
      ),
    ).rejects.toMatchObject({ error: 'NotAppealable' })
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

    const eventIds = async () => {
      const { events } = await modClient.queryEvents({
        subject: account.did,
        limit: 100,
      })
      return events.map((event) => event.id)
    }

    const before = await eventIds()
    await expect(appeal(action.id, account.did)).rejects.toMatchObject({
      error: 'AlreadyAppealed',
    })
    // The rejected attempt must not leave a stray report event behind.
    expect(await eventIds()).toEqual(before)
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
          queuedAt: toDatetimeString(Date.now()),
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
          createdAt: toDatetimeString(Date.now()),
          updatedAt: toDatetimeString(Date.now()),
        })),
      )
      .execute()

    await appeal(action.id, account.did)
    const report = await latestAppealReport(account.did)
    expect(report).toMatchObject({
      queueId: -1,
      status: 'open',
    })
    expect(report.queuedAt).toBeUndefined()
  })

  it('uses fallback routing instead of inheriting from another appeal', async () => {
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
        reportTypes: [APPEAL_REASON_TYPE],
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
        closedAt: toDatetimeString(Date.now()),
      })
      .execute()

    const second = await label(subject)
    await appeal(second.id, account.did)
    expect(await latestAppealReport(account.did)).toMatchObject({
      queueId: queue.id,
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

    const backdate = async (id: number, createdAt: number) =>
      network.ozone.ctx.db.db
        .updateTable('moderation_event')
        .where('id', '=', id)
        .set({ createdAt: toDatetimeString(createdAt) })
        .execute()

    const now = Date.now()
    // A day past the window, and a day inside it.
    await backdate(stale.id, now - 190 * 86_400_000)
    await backdate(fresh.id, now - 170 * 86_400_000)

    await expect(appeal(stale.id, account.did)).rejects.toMatchObject({
      error: 'AppealWindowExpired',
    })
    await expect(appeal(fresh.id, account.did)).resolves.toBeDefined()
  })

  it('shows a resolved appeal without exposing moderator note text', async () => {
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

    const view = await getAccountView(account.did)

    expect(tools.ozone.inbox.defs.subjectView.safeParse(view).success).toBe(
      true,
    )
    expect(view?.appeal).toMatchObject({
      state: 'resolved',
    })
    expect(view?.appeal?.resolvedAt).toBeDefined()
    expect(view?.appeal).not.toHaveProperty('note')
    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain(
      'We reviewed this again and the takedown stands.',
    )
    expect(serialized).not.toContain('MODERATOR-ONLY-RATIONALE')
    expect(serialized).not.toContain('MODERATOR-ONLY-COMMENT')
  })

  it('returns nothing for a subject with no moderation history', async () => {
    await expect(
      sc.agent.call(
        'tools.ozone.inbox.getActionedSubject',
        { subject: `at://${sc.dids.dan}/app.bsky.feed.post/never-actioned` },
        undefined,
        {
          headers: {
            ...sc.getHeaders(sc.dids.dan),
            'atproto-proxy': proxyHeader,
          },
        },
      ),
    ).rejects.toMatchObject({ error: 'NotFound' })
  })
  it('rejects a malformed appeal subject or action reference', async () => {
    // Below the lexicon's minimum.
    await expect(
      callAppeal(
        {
          action: {
            $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
            id: 0,
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.alice,
          },
        },
        sc.dids.alice,
      ),
    ).rejects.toThrow()
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
    expect(tools.ozone.inbox.defs.subjectView.safeParse(data).success).toBe(
      true,
    )
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
  it('distinguishes appeals for the same message ID in different conversations', async () => {
    const account = await sc.createAccount('chatcollision', {
      handle: 'chatcollision.test',
      email: 'chatcollision@test.com',
      password: 'chatcollision-pass',
    })
    const messageId = 'shared-message-id'
    const subject = (convoId: string) => ({
      $type: 'chat.bsky.convo.defs#messageRef' as const,
      did: account.did,
      convoId,
      messageId,
    })

    const action = await takedown(subject('convo-a'))
    await expect(
      callAppeal(
        {
          action: {
            $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
            id: action.id,
          },
          subject: subject('convo-b'),
        },
        account.did,
      ),
    ).rejects.toMatchObject({ error: 'NotAppealable' })

    await callAppeal({ subject: subject('convo-a') }, account.did)
    await expect(
      callAppeal({ subject: subject('convo-b') }, account.did),
    ).resolves.toBeDefined()

    const { events } = await modClient.queryEvents({
      subject: account.did,
      includeAllUserRecords: true,
      types: [tools.ozone.moderation.defs.modEventReport.$type],
      reportTypes: [APPEAL_REASON_TYPE],
    })
    expect(events.map((event) => event.subject)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ convoId: 'convo-a' }),
        expect.objectContaining({ convoId: 'convo-b' }),
      ]),
    )
    expect(events).toHaveLength(2)
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

    // A takedown clears `appealed`, but the open appeal remains in its queue.
    await takedown(subject)
    const view = await getAccountView(account.did)
    expect(view?.appeal?.state).toBe('pending')

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

    const view = await getAccountView(account.did)
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
      {
        action: {
          $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
          id: action.id,
        },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: account.did,
        },
      },
      {
        encoding: 'application/json',
        headers: {
          ...sc.getHeaders(account.did),
          'atproto-proxy': proxyHeader,
        },
      },
    )

    expect(tools.ozone.inbox.defs.subjectView.safeParse(data).success).toBe(
      true,
    )
    expect(data.appeal).toMatchObject({ state: 'pending' })
    const report = await latestAppealReport(account.did)
    expect(report).toMatchObject({ reportType: APPEAL_REASON_TYPE })
  })
})
