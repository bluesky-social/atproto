import type { ModeratorClient, SeedClient } from '@atproto/dev-env'
import { TestNetwork, basicSeed } from '@atproto/dev-env'
import { toDatetimeString } from '@atproto/lex'
import { getSeenAt } from '../src/inbox/seen.js'
import {
  findActionedSubject,
  getActionedSubjectDetail,
  parseSubjectCursor,
  queryActionedSubjects,
} from '../src/inbox/subjects.js'
import { hydrateSubjectView } from '../src/inbox/views.js'
import { subjectFromStatusRow } from '../src/mod-service/subject.js'

describe('viewer inbox subject reads', () => {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_subject_reads',
    })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => network?.close())

  it('pages only actioned subjects owned by the viewer', async () => {
    const record = sc.posts[sc.dids.alice][0].ref
    await mod.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['spam'],
        negateLabelVals: [],
      },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: record.uriStr,
        cid: record.cidStr,
      },
    })
    await mod.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['spam'],
        negateLabelVals: [],
      },
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
    })
    await mod.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['spam'],
        negateLabelVals: [],
      },
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob },
    })

    const db = network.ozone.ctx.db
    const first = await queryActionedSubjects(db, sc.dids.alice, { limit: 1 })
    const second = await queryActionedSubjects(db, sc.dids.alice, {
      limit: 1,
      cursor: first.cursor,
    })
    expect(first.rows).toHaveLength(1)
    expect(second.rows).toHaveLength(1)
    expect(first.rows[0].id).not.toBe(second.rows[0].id)
    expect(second.cursor).toBeUndefined()
    expect([first.rows[0].did, second.rows[0].did]).toEqual([
      sc.dids.alice,
      sc.dids.alice,
    ])
    expect(await queryActionedSubjects(db, sc.dids.bob, {})).toMatchObject({
      rows: [expect.objectContaining({ did: sc.dids.bob })],
    })
    expect(() => parseSubjectCursor('bad')).toThrow('Invalid cursor')
    expect(() => parseSubjectCursor('2026-99-99T00:00:00.000Z::1')).toThrow(
      'Invalid cursor',
    )

    const seenAt = await getSeenAt(db, sc.dids.alice, 'subjects')
    const view = await hydrateSubjectView(
      db,
      subjectFromStatusRow(first.rows[0]),
      network.ozone.ctx.cfg.service.did,
      network.ozone.ctx.cfg.inbox,
      seenAt,
    )
    expect(view?.isRead).toBe(false)
    await db.db
      .insertInto('inbox_seen')
      .values({
        did: sc.dids.alice,
        section: 'subjects',
        seenAt: toDatetimeString(Date.now() + 1000),
      })
      .execute()
    const readView = await hydrateSubjectView(
      db,
      subjectFromStatusRow(first.rows[0]),
      network.ozone.ctx.cfg.service.did,
      network.ozone.ctx.cfg.inbox,
      await getSeenAt(db, sc.dids.alice, 'subjects'),
    )
    expect(readView?.isRead).toBe(true)
  })

  it('returns full public history and de-identified report summary', async () => {
    const db = network.ozone.ctx.db
    const subject = await findActionedSubject(db, sc.dids.alice, sc.dids.alice)
    expect(subject).not.toBeNull()
    expect(await findActionedSubject(db, sc.dids.bob, sc.dids.alice)).toBeNull()
    expect(
      await findActionedSubject(
        db,
        sc.dids.bob,
        sc.posts[sc.dids.alice][0].ref.uriStr,
      ),
    ).toBeNull()

    await sc.createReport({
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      reportedBy: sc.dids.carol,
    })
    await network.processAll()
    const detail = await getActionedSubjectDetail(
      db,
      subject!,
      network.ozone.ctx.cfg.service.did,
      network.ozone.ctx.cfg.inbox,
      await getSeenAt(db, sc.dids.alice, 'subjects'),
    )
    expect(detail?.actions).toEqual([
      expect.objectContaining({ type: 'labelApplied', labels: ['spam'] }),
    ])
    expect(detail?.reports?.reasonTypes).toEqual([
      'com.atproto.moderation.defs#reasonSpam',
    ])
    expect(detail?.reports?.firstReportedOn).toMatch(/T00:00:00\.000Z$/)
    expect(JSON.stringify(detail)).not.toContain(sc.dids.carol)
    expect(detail?.reports).not.toHaveProperty('count')
  })

  it('serves authenticated detail and hides another account behind NotFound', async () => {
    const call = (did: typeof sc.dids.alice, method: string, params: object) =>
      sc.agent.call(method, params, undefined, {
        headers: {
          ...sc.getHeaders(did),
          'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
        },
      })

    const { data: page } = await call(
      sc.dids.alice,
      'tools.ozone.inbox.listActionedSubjects',
      { limit: 1 },
    )
    expect(page.subjects).toHaveLength(1)
    const { data: own } = await call(
      sc.dids.alice,
      'tools.ozone.inbox.getActionedSubject',
      { subject: sc.dids.alice },
    )
    expect(own.subject).toMatchObject({ did: sc.dids.alice })
    const preview = await fetch(
      `${network.ozone.url}/xrpc/tools.ozone.inbox.getActionedSubject?did=${encodeURIComponent(sc.dids.alice)}&subject=${encodeURIComponent(sc.dids.alice)}`,
      {
        headers: await network.ozone.modHeaders(
          'tools.ozone.inbox.getActionedSubject',
        ),
      },
    )
    expect(preview.status).toBe(200)
    expect((await preview.json()).subject).toMatchObject({ did: sc.dids.alice })
    const forbidden = await sc.agent.fetchHandler(
      `/xrpc/tools.ozone.inbox.getActionedSubject?did=${encodeURIComponent(sc.dids.alice)}&subject=${encodeURIComponent(sc.dids.alice)}`,
      {
        headers: {
          ...sc.getHeaders(sc.dids.bob),
          'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
        },
      },
    )
    expect(forbidden.status).toBe(403)
    await expect(
      call(sc.dids.bob, 'tools.ozone.inbox.getActionedSubject', {
        subject: sc.dids.alice,
      }),
    ).rejects.toMatchObject({ error: 'NotFound' })
  })
})
