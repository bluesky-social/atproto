import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { DatetimeString, DidString } from '@atproto/lex'
import { com, tools } from '../src/lexicons/index.js'
import { reportForEvent } from './_inbox.js'

describe('viewer inbox subject filters', () => {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient
  let did: DidString
  let actionWatermark: DatetimeString
  const resolvedPaths: string[] = []

  function call(method: string, params: object, owner = did) {
    return sc.agent.call(method, params, undefined, {
      headers: {
        ...sc.getHeaders(owner),
        'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
      },
    })
  }

  async function list(
    params: Partial<tools.ozone.inbox.listActionedSubjects.$Params> = {},
    owner = did,
  ): Promise<tools.ozone.inbox.listActionedSubjects.$OutputBody> {
    return (
      await call(tools.ozone.inbox.listActionedSubjects.$lxm, params, owner)
    ).data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_subject_filters',
    })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    await basicSeed(sc)
    did = sc.dids.alice
    for (let i = 0; i < 6; i++) await sc.post(did, `Filter fixture ${i}`)
    await network.processAll()
    const subjects = sc.posts[did].slice(-6).map(({ ref }) => ({
      $type: com.atproto.repo.strongRef.$type,
      uri: ref.uriStr,
      cid: ref.cidStr,
    }))
    const actions: Awaited<ReturnType<ModeratorClient['emitEvent']>>[] = []
    for (const subject of subjects) {
      actions.push(
        await mod.emitEvent({
          subject,
          event: {
            $type: tools.ozone.moderation.defs.modEventLabel.$type,
            createLabelVals: ['spam'],
            negateLabelVals: [],
          },
        }),
      )
    }
    actionWatermark = (await list()).subjects[0].updatedAt

    for (const [i, subject] of subjects.entries()) {
      if (i === 5) continue
      await sc.agent.call(
        tools.ozone.inbox.appealActionedSubject.$lxm,
        {},
        {
          subject,
          action: {
            $type: tools.ozone.inbox.appealActionedSubject.actionRef.$type,
            id: actions[i].id,
          },
        },
        {
          encoding: 'application/json',
          headers: {
            ...sc.getHeaders(did),
            'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
          },
        },
      )
      if (i === 0) continue
      const { events } = await mod.queryEvents({
        subject: subject.uri,
        types: [tools.ozone.moderation.defs.modEventReport.$type],
        reportTypes: [tools.ozone.report.defs.ReasonAppeal],
      })
      const report = await reportForEvent(mod, events[0].id)
      // Exercise both directions of disagreement with the subject flag.
      if (i !== 4) {
        await network.ozone.getAgent().tools.ozone.report.createActivity(
          {
            reportId: report.id,
            activity: { $type: tools.ozone.report.defs.closeActivity.$type },
          },
          {
            headers: await network.ozone.modHeaders(
              tools.ozone.report.createActivity.$lxm,
              'admin',
            ),
            encoding: 'application/json',
          },
        )
      }
      if (i === 1) continue
      await mod.emitEvent({
        subject,
        event: {
          $type: tools.ozone.moderation.defs.modEventResolveAppeal.$type,
        },
      })
      if (i !== 4) resolvedPaths.push(subject.uri.split('/').slice(3).join('/'))
    }
    // Legacy status rows can have a null appeal flag.
    await network.ozone.ctx.db.db
      .updateTable('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', resolvedPaths[0])
      .set({ appealed: null })
      .execute()
  })

  afterAll(async () => network?.close())

  it.each([
    ['createdAt', 'asc'],
    ['createdAt', 'desc'],
    ['updatedAt', 'asc'],
    ['updatedAt', 'desc'],
  ] as const)(
    'filters before paging with %s %s',
    async (sortField, sortDirection) => {
      const params = { sortField, sortDirection }
      const all = await list(params)
      expect(all.subjects).toHaveLength(6)
      expect(
        all.subjects.map((subject) => subject.appeal?.state).sort(),
      ).toEqual([
        'none',
        'pending',
        'pending',
        'resolved',
        'resolved',
        'resolved',
      ])
      for (const filter of ['pending', 'resolved'] as const) {
        const expected = all.subjects.filter((s) => s.appeal?.state === filter)
        const first = await list({ ...params, filter, limit: 1 })
        expect(first.subjects).toEqual(expected.slice(0, 1))
        expect(first.cursor).toBeDefined()
        const second = await list({
          ...params,
          filter,
          limit: 1,
          cursor: first.cursor,
        })
        expect(second.subjects).toEqual(expected.slice(1, 2))
        if (expected.length > 2) {
          expect(second.cursor).toBeDefined()
          const third = await list({
            ...params,
            filter,
            limit: 1,
            cursor: second.cursor,
          })
          expect(third.subjects).toEqual(expected.slice(2))
          expect(third.cursor).toBeUndefined()
        } else {
          expect(second.cursor).toBeUndefined()
        }
      }
      expect((await list({ ...params, filter: 'unread' })).subjects).toEqual(
        all.subjects,
      )
    },
  )

  it('matches the public unread timestamp for both sorts and the exact watermark boundary', async () => {
    await network.ozone.ctx.db.db
      .insertInto('inbox_seen')
      .values({ did, section: 'subjects', seenAt: actionWatermark })
      .execute()
    for (const sortField of ['createdAt', 'updatedAt'] as const) {
      for (const sortDirection of ['asc', 'desc'] as const) {
        const params = { sortField, sortDirection }
        const all = await list(params)
        const expected = all.subjects.filter((s) => !s.isRead)
        expect(expected.length).toBeGreaterThan(0)
        expect(expected.length).toBeLessThan(all.subjects.length)
        expect(expected.every((s) => s.createdAt <= actionWatermark)).toBe(true)
        expect((await list({ ...params, filter: 'unread' })).subjects).toEqual(
          expected,
        )
        const subjects: typeof expected = []
        let cursor: string | undefined
        do {
          const page = await list({
            ...params,
            filter: 'unread',
            limit: 1,
            cursor,
          })
          subjects.push(...page.subjects)
          cursor = page.cursor
        } while (cursor)
        expect(subjects).toEqual(expected)
      }
    }
    const { subjects } = await list()
    const seenAt = subjects[0].updatedAt
    await network.ozone.ctx.db.db
      .updateTable('inbox_seen')
      .where('did', '=', did)
      .where('section', '=', 'subjects')
      .set({ seenAt })
      .execute()
    expect((await list({ filter: 'unread' })).subjects).toEqual([])
    expect((await list()).subjects.every((s) => s.isRead)).toBe(true)
  })

  it('keeps ownership checks and validates the filter', async () => {
    for (const filter of ['pending', 'resolved', 'unread'] as const) {
      expect((await list({ filter }, sc.dids.bob)).subjects).toEqual([])
      await expect(list({ filter, did }, sc.dids.bob)).rejects.toMatchObject({
        error: 'Forbidden',
      })
    }
    await expect(
      call(tools.ozone.inbox.listActionedSubjects.$lxm, { filter: 'bogus' }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  it('reflects reopening a report in list, detail, and unread state without a subject event', async () => {
    const before = await list({ filter: 'resolved' })
    const subject = before.subjects[0].subject
    if (!com.atproto.repo.strongRef.$isTypeOf(subject))
      throw new Error('Expected record')
    const { events } = await mod.queryEvents({
      subject: subject.uri,
      types: [tools.ozone.moderation.defs.modEventReport.$type],
      reportTypes: [tools.ozone.report.defs.ReasonAppeal],
    })
    const report = await reportForEvent(mod, events[0].id)
    await network.ozone.getAgent().tools.ozone.report.createActivity(
      {
        reportId: report.id,
        activity: { $type: tools.ozone.report.defs.reopenActivity.$type },
      },
      {
        headers: await network.ozone.modHeaders(
          tools.ozone.report.createActivity.$lxm,
          'admin',
        ),
        encoding: 'application/json',
      },
    )
    expect((await list({ filter: 'resolved' })).subjects).toHaveLength(2)
    const { subjects } = await list({ filter: 'unread' })
    expect(subjects).toEqual([
      expect.objectContaining({
        subject,
        appeal: expect.objectContaining({ state: 'pending' }),
      }),
    ])
    const detail = (
      await call(tools.ozone.inbox.getActionedSubject.$lxm, {
        subject: subject.uri,
      })
    ).data
    expect(detail.appeal.state).toBe('pending')
    expect(detail.updatedAt).toBe(subjects[0].updatedAt)
    expect(detail.isRead).toBe(false)
    expect(detail.appeal.resolvedAt).toBeUndefined()
  })
})
