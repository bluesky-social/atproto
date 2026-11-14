import { jest } from '@jest/globals'
import {
  ComAtprotoModerationDefs,
  type ToolsOzoneModerationDefs,
} from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { app, chat, com, tools } from '../src/lexicons/index.js'
import { ProtectedTagSettingKey } from '../src/setting/constants.js'
import { reportForEvent } from './_inbox.js'

describe('bulk moderation events', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  const REASONSPAM = ComAtprotoModerationDefs.REASONSPAM

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_bulk_events',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })
  afterAll(async () => network?.close())
  describe('bulk events', () => {
    const repoRef = (did: string) => ({
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did,
    })

    const strongRef = (did: string, postIndex = 0) => ({
      $type: 'com.atproto.repo.strongRef' as const,
      uri: sc.posts[did][postIndex].ref.uriStr,
      cid: sc.posts[did][postIndex].ref.cidStr,
    })

    it('batch of valid acknowledge events on multiple subjects succeeds', async () => {
      const subjects = [repoRef(sc.dids.alice), repoRef(sc.dids.bob)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
      for (const ev of result.events) {
        expect(ev.event.$type).toBe(
          'tools.ozone.moderation.defs#modEventAcknowledge',
        )
      }
    })

    it('batch takedown on multiple repo subjects succeeds', async () => {
      const subjects = [repoRef(sc.dids.carol), repoRef(sc.dids.dan)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)

      // Reverse the takedowns so they don't interfere with other tests
      for (const subject of subjects) {
        await modClient.performReverseTakedown({ subject })
      }
    })

    it('batch with partial failure returns mixed results', async () => {
      // First takedown alice
      await modClient.performTakedown({ subject: repoRef(sc.dids.alice) })

      const subjects = [
        repoRef(sc.dids.alice), // already taken down — should fail
        repoRef(sc.dids.bob), // should succeed
      ]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(1)
      expect(result.failedEvents).toHaveLength(1)
      expect(result.failedEvents[0].error).toContain('already taken down')

      // Reverse takedowns
      await modClient.performReverseTakedown({
        subject: repoRef(sc.dids.alice),
      })
      await modClient.performReverseTakedown({ subject: repoRef(sc.dids.bob) })
    })

    it('rejects duplicate subjects', async () => {
      const subject = repoRef(sc.dids.carol)
      const subjects = [subject, subject]

      await expect(
        modClient.emitEvents({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
          },
          subjects: subjects.map((s) => ({ subject: s })),
          createdBy: 'did:example:admin',
        }),
      ).rejects.toThrow('Subjects array contains duplicates')
    })

    it('rejects empty subjects array', async () => {
      await expect(
        modClient.emitEvents({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
          },
          subjects: [],
          createdBy: 'did:example:admin',
        }),
      ).rejects.toThrow('Subjects array must not be empty')
    })

    it('works with strongRef subjects (records)', async () => {
      const subjects = [strongRef(sc.dids.alice, 0), strongRef(sc.dids.bob, 0)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
    })

    it('works with mixed subject types', async () => {
      const subjects = [repoRef(sc.dids.alice), strongRef(sc.dids.bob, 0)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
    })

    it('respects auth — triage can acknowledge but not takedown', async () => {
      const subjects = [repoRef(sc.dids.alice)]

      // Triage can acknowledge
      const ackResult = await modClient.emitEvents(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
          },
          subjects: subjects.map((s) => ({ subject: s })),
          createdBy: 'did:example:admin',
        },
        'triage',
      )
      expect(ackResult.events).toHaveLength(1)

      // Triage cannot takedown — should fail per-item
      const takedownResult = await modClient.emitEvents(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTakedown',
          },
          subjects: subjects.map((s) => ({ subject: s })),
          createdBy: 'did:example:admin',
        },
        'triage',
      )
      expect(takedownResult.events).toHaveLength(0)
      expect(takedownResult.failedEvents).toHaveLength(1)
      expect(takedownResult.failedEvents[0].error).toContain(
        'Must be a full moderator',
      )
    })

    it('tag events work in bulk', async () => {
      const subjects = [repoRef(sc.dids.alice), repoRef(sc.dids.bob)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTag',
          add: ['bulk-tag'],
          remove: [],
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
    })

    it('bulk label events on repo subjects', async () => {
      const subjects = [repoRef(sc.dids.alice), repoRef(sc.dids.bob)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
      for (const ev of result.events) {
        expect(ev.event.$type).toBe('tools.ozone.moderation.defs#modEventLabel')
        expect(
          (ev.event as ToolsOzoneModerationDefs.ModEventLabel).createLabelVals,
        ).toEqual(['spam'])
      }
    })

    it('bulk label events on record subjects', async () => {
      const subjects = [strongRef(sc.dids.alice, 0), strongRef(sc.dids.bob, 0)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['nsfw'],
          negateLabelVals: [],
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
      for (const ev of result.events) {
        expect(ev.event.$type).toBe('tools.ozone.moderation.defs#modEventLabel')
      }
    })

    it('bulk reverse takedown succeeds when all subjects are taken down', async () => {
      const subjects = [repoRef(sc.dids.carol), repoRef(sc.dids.dan)]

      // First takedown both subjects
      for (const subject of subjects) {
        await modClient.performTakedown({ subject })
      }

      // Bulk reverse takedown
      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
    })

    it('bulk reverse takedown — partial failure when subject not taken down', async () => {
      // Takedown only carol
      await modClient.performTakedown({ subject: repoRef(sc.dids.carol) })

      const subjects = [
        repoRef(sc.dids.carol), // taken down — should succeed
        repoRef(sc.dids.dan), // not taken down — should fail
      ]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(1)
      expect(result.failedEvents).toHaveLength(1)
      expect(result.failedEvents[0].error).toContain('not taken down')
    })

    it('bulk acknowledge events', async () => {
      const subjects = [repoRef(sc.dids.alice), repoRef(sc.dids.bob)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
      for (const ev of result.events) {
        expect(ev.event.$type).toBe(
          'tools.ozone.moderation.defs#modEventAcknowledge',
        )
      }
    })

    it('bulk resolve appeal events', async () => {
      const subjects = [repoRef(sc.dids.alice), repoRef(sc.dids.bob)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventResolveAppeal',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
      for (const ev of result.events) {
        expect(ev.event.$type).toBe(
          'tools.ozone.moderation.defs#modEventResolveAppeal',
        )
      }
    })

    it('bulk report events', async () => {
      const subjects = [repoRef(sc.dids.alice), repoRef(sc.dids.bob)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: REASONSPAM,
          comment: 'Bulk report',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
      for (const ev of result.events) {
        expect(ev.event.$type).toBe(
          'tools.ozone.moderation.defs#modEventReport',
        )
      }
    })

    it('bulk takedown on record subjects', async () => {
      const subjects = [strongRef(sc.dids.alice, 0), strongRef(sc.dids.bob, 0)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)

      // Reverse the takedowns to clean up
      for (const subject of subjects) {
        await modClient.performReverseTakedown({ subject })
      }
    })

    it('duplicate takedown in same batch is rejected', async () => {
      const subject = repoRef(sc.dids.carol)
      const subjects = [subject, subject]

      await expect(
        modClient.emitEvents({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTakedown',
          },
          subjects: subjects.map((s) => ({ subject: s })),
          createdBy: 'did:example:admin',
        }),
      ).rejects.toThrow('Subjects array contains duplicates')
    })

    it('bulk email events on repo subjects', async () => {
      const subjects = [repoRef(sc.dids.alice), repoRef(sc.dids.bob)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventEmail',
          subjectLine: 'Bulk notice',
          content: 'This is a bulk email test',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
      for (const ev of result.events) {
        expect(ev.event.$type).toBe('tools.ozone.moderation.defs#modEventEmail')
      }
    })

    it('bulk email events fail on record subjects', async () => {
      const subjects = [strongRef(sc.dids.alice, 0), strongRef(sc.dids.bob, 0)]

      const result = await modClient.emitEvents({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventEmail',
          subjectLine: 'Should fail',
          content: 'Email on records should fail',
        },
        subjects: subjects.map((s) => ({ subject: s })),
        createdBy: 'did:example:admin',
      })

      expect(result.events).toHaveLength(0)
      expect(result.failedEvents).toHaveLength(2)
      expect(result.failedEvents[0].error).toContain(
        'Email can only be sent to a repo subject',
      )
    })

    it('dispatches bulk credential revocations for account subjects', async () => {
      const subjects = [(await fixture()).account, (await fixture()).account]
      using revoke = jest
        .spyOn(network.ozone.ctx.pdsClient!, 'call')
        .mockResolvedValue(undefined)

      const result = await modClient.emitEvents(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#revokeAccountCredentialsEvent',
            comment: 'Bulk revoke credentials',
          },
          subjects: subjects.map((s) => ({ subject: s })),
          createdBy: 'did:example:admin',
        },
        'admin',
      )

      expect(revoke).toHaveBeenCalledTimes(2)
      expect(revoke.mock.calls.map((call) => call[1])).toEqual(
        subjects.map(({ did }) => ({ account: did })),
      )
      expect(result.events).toHaveLength(2)
      expect(result.failedEvents).toHaveLength(0)
      for (const ev of result.events) {
        expect(ev.event.$type).toBe(
          'tools.ozone.moderation.defs#revokeAccountCredentialsEvent',
        )
      }
    })

    it('bulk revokeAccountCredentials fails for non-admin', async () => {
      const subjects = [repoRef(sc.dids.alice)]

      const result = await modClient.emitEvents(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#revokeAccountCredentialsEvent',
            comment: 'Should fail for non-admin',
          },
          subjects: subjects.map((s) => ({ subject: s })),
          createdBy: 'did:example:admin',
        },
        'moderator',
      )

      expect(result.events).toHaveLength(0)
      expect(result.failedEvents).toHaveLength(1)
      expect(result.failedEvents[0].error).toContain(
        'Must be an admin to revoke account credentials',
      )
    })

    it('rejects bulk label events containing invalid characters', async () => {
      const subjects = [repoRef(sc.dids.alice), repoRef(sc.dids.bob)]

      await expect(
        modClient.emitEvents({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: ['valid', 'has space'],
            negateLabelVals: [],
          },
          subjects: subjects.map((s) => ({ subject: s })),
          createdBy: 'did:example:admin',
        }),
      ).rejects.toThrow('Invalid label')
    })
  })

  let fixtureNumber = 0
  async function fixture() {
    const name = `bulkfixture${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const posts = await Promise.all([
      sc.post(did, 'Example post'),
      sc.post(did, 'Another example'),
    ])
    const records = posts.map(({ ref }) =>
      com.atproto.repo.strongRef.$build({ uri: ref.uriStr, cid: ref.cidStr }),
    )
    await network.processAll()
    return {
      did,
      account: com.atproto.admin.defs.repoRef.$build({ did }),
      records,
      message: chat.bsky.convo.defs.messageRef.$build({
        did,
        convoId: 'bulk-convo',
        messageId: 'bulk-message',
      }),
      conversation: chat.bsky.convo.defs.convoRef.$build({
        did,
        convoId: 'bulk-convo',
      }),
    }
  }

  type Fixture = Awaited<ReturnType<typeof fixture>>
  type Subject =
    Fixture['account' | 'message' | 'conversation'] | Fixture['records'][number]
  async function report(
    subject: Subject,
    reasonType: string = com.atproto.moderation.defs.ReasonSpam,
  ) {
    const event = await sc.createReport({
      subject,
      reasonType,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    return reportForEvent(modClient, event.id)
  }
  async function detail(id: number) {
    return (
      await modClient.agent.tools.ozone.report.getReport(
        { id },
        {
          headers: await network.ozone.modHeaders(
            tools.ozone.report.getReport.$lxm,
          ),
        },
      )
    ).data
  }
  const acknowledge = () =>
    tools.ozone.moderation.defs.modEventAcknowledge.$build({})

  it('targets different report IDs per entry and records notes and activity metadata', async () => {
    const fixtures = [await fixture(), await fixture()]
    const reports = await Promise.all(fixtures.map((f) => report(f.account)))
    const untouched = await Promise.all(
      fixtures.map((f) => report(f.records[0])),
    )
    const result = await modClient.emitEvents({
      event: acknowledge(),
      subjects: fixtures.map((f, i) => ({
        subject: f.account,
        reportAction: {
          ids: [reports[i].id],
          note: `Review ${i}`,
          isAutomated: true,
        },
      })),
      modTool: {
        name: 'example-tool',
        meta: {
          runId: 'example-run',
          createdBy: 'did:example:forged',
          actionEventId: -1,
        },
      },
    })
    expect(result.failedEvents).toEqual([])
    expect(result.events).toHaveLength(2)
    for (const [i, row] of reports.entries()) {
      const action = result.events[i]
      expect(await detail(row.id)).toMatchObject({
        status: 'closed',
        actionEventIds: [action.id],
        actionNote: `Review ${i}`,
      })
      const { data } = await modClient.agent.tools.ozone.report.listActivities(
        { reportId: row.id },
        {
          headers: await network.ozone.modHeaders(
            tools.ozone.report.listActivities.$lxm,
          ),
        },
      )
      const close = data.activities.find(
        (a) => a.activity.$type === tools.ozone.report.defs.closeActivity.$type,
      )
      expect(close).toMatchObject({
        isAutomated: true,
        meta: {
          source: 'example-tool',
          runId: 'example-run',
          actionEventId: action.id,
        },
      })
      expect(close?.meta).not.toHaveProperty('createdBy')
    }
    for (const row of untouched)
      expect((await detail(row.id)).status).toBe('open')
  })

  it.each(['all', 'types', 'subjects', 'subjectTypes', 'allOwned'] as const)(
    'supports %s report targeting independently for each account',
    async (mode) => {
      const f = await fixture()
      const subjects = [f.account, ...f.records, f.message, f.conversation]
      const reports = [] as Awaited<ReturnType<typeof report>>[]
      for (const [i, subject] of subjects.entries())
        reports.push(
          await report(
            subject,
            i === 2
              ? com.atproto.moderation.defs.ReasonMisleading
              : com.atproto.moderation.defs.ReasonSpam,
          ),
        )
      const targeting: tools.ozone.moderation.emitEvent.ReportAction =
        mode === 'allOwned'
          ? { allOwned: true }
          : mode === 'subjects'
            ? { all: true, subjects: [f.records[0]] }
            : mode === 'subjectTypes'
              ? { all: true, subjectTypes: ['message', 'conversation'] }
              : mode === 'types'
                ? {
                    types: [com.atproto.moderation.defs.ReasonSpam],
                    subjectTypes: ['record'],
                  }
                : { all: true }
      const result = await modClient.emitEvents({
        event: acknowledge(),
        subjects: [{ subject: f.account, reportAction: targeting }],
      })
      expect(result.failedEvents).toEqual([])
      const selected =
        mode === 'allOwned'
          ? [0, 1, 2, 3, 4]
          : mode === 'subjectTypes'
            ? [0, 3, 4]
            : mode === 'all'
              ? [0]
              : [0, 1]
      for (const [i, row] of reports.entries()) {
        const current = await detail(row.id)
        expect(current.status).toBe(selected.includes(i) ? 'closed' : 'open')
        if (selected.includes(i))
          expect(current.actionEventIds).toContain(result.events[0].id)
      }
    },
  )

  it('rolls back a failed entry without changing its reports or losing successful entries', async () => {
    const first = await fixture()
    const second = await fixture()
    const a = await report(first.account)
    const b = await report(second.account)
    const before = (
      await modClient.queryEvents({ subject: first.did })
    ).events.map((e) => e.id)
    const result = await modClient.emitEvents({
      event: acknowledge(),
      subjects: [
        { subject: first.account, reportAction: { ids: [a.id, b.id] } },
        { subject: second.account, reportAction: { ids: [b.id] } },
      ],
    })
    expect(result.events).toHaveLength(1)
    expect(result.failedEvents).toMatchObject([
      { subject: first.account, errorName: 'InvalidRequest' },
    ])
    expect((await detail(a.id)).status).toBe('open')
    expect((await detail(b.id)).status).toBe('closed')
    expect(
      (await modClient.queryEvents({ subject: first.did })).events.map(
        (e) => e.id,
      ),
    ).toEqual(before)
  })

  it.each([
    'empty',
    'mutually-exclusive',
    'cross-account',
    'record-expansion',
    'record-allOwned',
    'nonclosing-expansion',
    'nonclosing-allOwned',
  ] as const)(
    'rejects %s report targeting per entry before logging an event',
    async (mode) => {
      const f = await fixture()
      const other = await fixture()
      const subject = mode.startsWith('record-') ? f.records[0] : f.account
      const event = mode.startsWith('nonclosing-')
        ? tools.ozone.moderation.defs.modEventTag.$build({
            add: ['example-tag'],
            remove: [],
          })
        : acknowledge()
      const targeting: tools.ozone.moderation.emitEvent.ReportAction =
        mode === 'empty'
          ? {}
          : mode === 'mutually-exclusive'
            ? { all: true, subjects: [], subjectTypes: [] }
            : mode === 'cross-account'
              ? { all: true, subjects: [other.records[0]] }
              : mode.endsWith('allOwned')
                ? { allOwned: true }
                : { all: true, subjectTypes: ['record'] }
      const result = await modClient.emitEvents({
        event,
        subjects: [
          { subject, reportAction: targeting },
          { subject: other.account },
        ],
      })
      expect(result.events).toHaveLength(1)
      expect(result.failedEvents).toMatchObject([
        { subject, errorName: 'InvalidRequest' },
      ])
      expect(
        (
          await modClient.queryEvents({
            subject: f.did,
            includeAllUserRecords: true,
          })
        ).events,
      ).toHaveLength(0)
    },
  )

  it('keeps message IDs scoped to their conversation when checking duplicates and targeting reports', async () => {
    const f = await fixture()
    const messages = [
      f.message,
      { ...f.message, convoId: 'other-convo' },
      { ...f.message, messageId: 'other-message' },
    ]
    const reports = [] as Awaited<ReturnType<typeof report>>[]
    for (const subject of [...messages, f.conversation])
      reports.push(await report(subject))
    const result = await modClient.emitEvents({
      event: acknowledge(),
      subjects: messages
        .slice(0, 2)
        .map((subject) => ({ subject, reportAction: { all: true } })),
    })
    expect(result.events).toHaveLength(2)
    expect(result.failedEvents).toEqual([])
    for (const [i, row] of reports.entries())
      expect((await detail(row.id)).status).toBe(i < 2 ? 'closed' : 'open')
    await expect(
      modClient.emitEvents({
        event: acknowledge(),
        subjects: [{ subject: f.message }, { subject: { ...f.message } }],
      }),
    ).rejects.toThrow('duplicates')
    const conversations = await modClient.emitEvents({
      event: acknowledge(),
      subjects: [
        { subject: f.conversation },
        { subject: { ...f.conversation, convoId: 'other-convo' } },
      ],
    })
    expect(conversations.events).toHaveLength(2)
  })

  it.each([
    'modEventTakedown',
    'modEventReverseTakedown',
    'modEventLabel',
  ] as const)(
    'rejects message %s without changing its reports',
    async (kind) => {
      const f = await fixture()
      const row = await report(f.message)
      const event =
        kind === 'modEventLabel'
          ? tools.ozone.moderation.defs.modEventLabel.$build({
              createLabelVals: ['spam'],
              negateLabelVals: [],
            })
          : tools.ozone.moderation.defs[kind].$build({})
      const result = await modClient.emitEvents({
        event,
        subjects: [{ subject: f.message, reportAction: { ids: [row.id] } }],
      })
      expect(result.events).toEqual([])
      expect(result.failedEvents).toHaveLength(1)
      expect(result.failedEvents[0].error).toContain('Message')
      expect((await detail(row.id)).status).toBe('open')
    },
  )

  it('links account-wide acknowledge cascades to owned reports', async () => {
    const f = await fixture()
    const reports = [
      await report(f.records[0]),
      await report(f.message),
      await report(f.conversation),
    ]
    const result = await modClient.emitEvents({
      event: tools.ozone.moderation.defs.modEventAcknowledge.$build({
        acknowledgeAccountSubjects: true,
      }),
      subjects: [{ subject: f.account }],
      modTool: { name: 'example-cascade' },
    })
    expect(result.failedEvents).toEqual([])
    for (const row of reports)
      expect(await detail(row.id)).toMatchObject({
        status: 'closed',
        actionEventIds: [result.events[0].id],
      })
  })

  it('deduplicates external IDs per subject and preserves other entries', async () => {
    const f = await fixture()
    const other = await fixture()
    const input = {
      event: acknowledge(),
      subjects: [{ subject: f.account, externalId: 'example-action' }],
    }
    expect((await modClient.emitEvents(input)).events).toHaveLength(1)
    const result = await modClient.emitEvents({
      ...input,
      subjects: [
        ...input.subjects,
        { subject: other.account, externalId: 'example-action' },
      ],
    })
    expect(result.events).toHaveLength(1)
    expect(result.failedEvents).toMatchObject([
      { subject: f.account, errorName: 'DuplicateExternalId' },
    ])
  })

  it('rejects unsupported event types even though the event union is open', async () => {
    const f = await fixture()
    for (const event of [
      tools.ozone.moderation.defs.modEventDivert.$build({}),
      { $type: 'example.event.defs#unknown' },
    ]) {
      await expect(
        modClient.emitEvents({ event, subjects: [{ subject: f.account }] }),
      ).rejects.toThrow('Unsupported bulk event type')
    }
    expect((await modClient.queryEvents({ subject: f.did })).events).toEqual([])
  })

  it('reports invalid subjects per entry', async () => {
    const f = await fixture()
    const result = await modClient.emitEvents({
      event: acknowledge(),
      subjects: [
        { subject: { $type: 'example.subject#unknown' } },
        { subject: f.account },
      ],
    })
    expect(result.events).toHaveLength(1)
    expect(result.failedEvents).toHaveLength(1)
  })

  it('records email delivery independently for each recipient', async () => {
    const fixtures = [await fixture(), await fixture()]
    const service = network.ozone.ctx.modService(network.ozone.ctx.db)
    const prototype: typeof service = Object.getPrototypeOf(service)
    using sendEmail = jest
      .spyOn(prototype, 'sendEmail')
      .mockImplementation(async ({ recipientDid }) => {
        if (recipientDid === fixtures[1].did)
          throw new Error('Example delivery failure')
      })
    const result = await modClient.emitEvents({
      event: tools.ozone.moderation.defs.modEventEmail.$build({
        subjectLine: 'Example',
        content: 'Example notification',
      }),
      subjects: fixtures.map((f) => ({ subject: f.account })),
    })
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(result.failedEvents).toEqual([])
    const delivery = result.events.map(({ event }) => {
      expect(tools.ozone.moderation.defs.modEventEmail.$matches(event)).toBe(
        true,
      )
      return (event as ToolsOzoneModerationDefs.ModEventEmail).isDelivered
    })
    expect(delivery).toEqual([true, false])
  })

  it('honors report type validation and disabled automatic report tags', async () => {
    const f = await fixture()
    const profile = network.ozone.ctx.moderationServiceProfile()
    const prototype: typeof profile = Object.getPrototypeOf(profile)
    using validateReason = jest
      .spyOn(prototype, 'validateReasonType')
      .mockRejectedValueOnce(new Error('Invalid reason type'))
    const event = tools.ozone.moderation.defs.modEventReport.$build({
      reportType: com.atproto.moderation.defs.ReasonSpam,
    })
    await expect(
      modClient.emitEvents({ event, subjects: [{ subject: f.account }] }),
    ).rejects.toThrow()
    expect(validateReason).toHaveBeenCalledWith(
      event.reportType,
      tools.ozone.moderation.emitEvents.$lxm,
    )
    validateReason.mockRestore()
    const disabled = jest.replaceProperty(
      network.ozone.ctx.cfg.service,
      'reportTagsDisabled',
      true,
    )
    try {
      const result = await modClient.emitEvents({
        event,
        subjects: [{ subject: f.account }],
      })
      expect(result.failedEvents).toEqual([])
      const statuses = await modClient.queryStatuses({ subject: f.did })
      expect(statuses.subjectStatuses[0].tags ?? []).not.toContain(
        'report:spam',
      )
    } finally {
      disabled.restore()
    }
  })

  it('requires an admin for bulk feed-generator takedowns', async () => {
    const f = await fixture()
    const subject = com.atproto.repo.strongRef.$build({
      uri: `at://${f.did}/${app.bsky.feed.generator.$type}/example`,
      cid: f.records[0].cid,
    })
    const result = await modClient.emitEvents(
      {
        event: tools.ozone.moderation.defs.modEventTakedown.$build({}),
        subjects: [{ subject }],
      },
      'moderator',
    )
    expect(result.events).toEqual([])
    expect(result.failedEvents[0].error).toContain('Must be a full admin')
    expect(
      (await modClient.queryEvents({ subject: subject.uri })).events,
    ).toEqual([])
  })

  it('checks protected tag permissions globally and action permissions per subject', async () => {
    const f = await fixture()
    const other = await fixture()
    await modClient.upsertSettingOption({
      key: ProtectedTagSettingKey,
      scope: 'instance',
      managerRole: tools.ozone.team.defs.RoleAdmin,
      value: {
        'example-protected': { roles: [tools.ozone.team.defs.RoleAdmin] },
      },
    })
    try {
      const event = tools.ozone.moderation.defs.modEventTag.$build({
        add: ['example-protected'],
        remove: [],
      })
      await expect(
        modClient.emitEvents(
          { event, subjects: [{ subject: f.account }] },
          'moderator',
        ),
      ).rejects.toThrow('Can not manage tag')
      expect(
        (
          await modClient.emitEvents(
            { event, subjects: [{ subject: f.account }] },
            'admin',
          )
        ).events,
      ).toHaveLength(1)
      const result = await modClient.emitEvents(
        {
          event: tools.ozone.moderation.defs.modEventLabel.$build({
            createLabelVals: ['spam'],
            negateLabelVals: [],
          }),
          subjects: [{ subject: f.account }, { subject: other.account }],
        },
        'moderator',
      )
      expect(result.events).toHaveLength(1)
      expect(result.failedEvents[0].error).toContain('protected tag')
    } finally {
      await modClient.removeSettingOptions({
        keys: [ProtectedTagSettingKey],
        scope: 'instance',
      })
    }
  })

  it('preserves successes and failure subjects across processing chunks', async () => {
    const f = await fixture()
    const subjects = Array.from({ length: 12 }, (_, i) => ({
      subject: com.atproto.repo.strongRef.$build({
        uri: `at://${f.did}/${app.bsky.feed.post.$type}/example${i}`,
        cid: f.records[0].cid,
      }),
    }))
    const result = await modClient.emitEvents({
      event: acknowledge(),
      subjects: [
        ...subjects.slice(0, 10),
        { subject: { $type: 'example.subject#invalid' } },
        subjects[11],
      ],
    })
    expect(result.events.map(({ subject }) => subject)).toEqual(
      [...subjects.slice(0, 10), subjects[11]].map(({ subject }) => subject),
    )
    expect(result.failedEvents).toMatchObject([
      { subject: { $type: 'example.subject#invalid' } },
    ])
    await expect(
      modClient.emitEvents({
        event: acknowledge(),
        subjects: Array.from({ length: 101 }, () => ({ subject: f.account })),
      }),
    ).rejects.toThrow()
  })

  it('routes bulk actions through the PDS to the moderation service by default', async () => {
    const f = await fixture()
    await network.ozone.addModeratorDid(sc.dids.alice)
    const { data } = await network.pds
      .getAgent()
      .tools.ozone.moderation.emitEvents(
        {
          event: acknowledge(),
          subjects: [{ subject: f.account }],
          createdBy: sc.dids.alice,
        },
        {
          encoding: 'application/json',
          headers: sc.getHeaders(sc.dids.alice),
        },
      )
    expect(data.events).toHaveLength(1)
    expect(data.failedEvents).toEqual([])
    expect(data.events[0].createdBy).toBe(sc.dids.alice)
  })
})
