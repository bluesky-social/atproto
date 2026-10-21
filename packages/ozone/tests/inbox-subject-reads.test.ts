import { jest } from '@jest/globals'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import { tools } from '../src/lexicons/index.js'

describe('viewer inbox subjects', () => {
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

  function call(did: DidString, method: string, params: object = {}) {
    return sc.agent.call(method, params, undefined, {
      headers: {
        ...sc.getHeaders(did),
        'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
      },
    })
  }
  function label(
    subject: Parameters<ModeratorClient['emitEvent']>[0]['subject'],
    vals = ['spam'],
    negate: string[] = [],
  ) {
    return mod.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: vals,
        negateLabelVals: negate,
        comment: 'PRIVATE MODERATOR COMMENT',
      },
      meta: { privateAudit: 'PRIVATE METADATA' },
    })
  }

  it('pages only owned actioned subjects with a fixed query count', async () => {
    const record = sc.posts[sc.dids.alice][0].ref
    await label({
      $type: 'com.atproto.repo.strongRef',
      uri: record.uriStr,
      cid: record.cidStr,
    })
    await label({ $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice })
    await label({ $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob })
    using queries = jest.spyOn(
      network.ozone.ctx.db.db.getExecutor(),
      'executeQuery',
    )
    const { data: first } = await call(
      sc.dids.alice,
      tools.ozone.inbox.listActionedSubjects.$lxm,
      { limit: 1 },
    )
    const singleCount = queries.mock.calls.length
    queries.mockClear()
    const { data: all } = await call(
      sc.dids.alice,
      tools.ozone.inbox.listActionedSubjects.$lxm,
      { limit: 100 },
    )
    // The first request can also populate the membership cache.
    expect(queries.mock.calls.length).toBeLessThanOrEqual(singleCount)
    expect(queries.mock.calls.length).toBeLessThanOrEqual(8)
    expect(all.subjects).toHaveLength(2)
    const { data: second } = await call(
      sc.dids.alice,
      tools.ozone.inbox.listActionedSubjects.$lxm,
      { limit: 1, cursor: first.cursor },
    )
    expect(first.subjects).toHaveLength(1)
    expect(second.subjects).toHaveLength(1)
    expect(second.subjects[0].subject).not.toEqual(first.subjects[0].subject)
    expect(second.cursor).toBeUndefined()
    expect([...first.subjects, ...second.subjects]).toEqual(all.subjects)
    const { data: bob } = await call(
      sc.dids.bob,
      tools.ozone.inbox.listActionedSubjects.$lxm,
    )
    expect(bob.subjects).toEqual([
      expect.objectContaining({
        subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob },
      }),
    ])
    for (const cursor of ['bad', '2026-99-99T00:00:00.000Z::1']) {
      await expect(
        call(sc.dids.alice, tools.ozone.inbox.listActionedSubjects.$lxm, {
          cursor,
        }),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })
    }
    expect(first.subjects[0].isRead).toBe(false)
    // updateSeen is introduced in the next stacked PR; seed its storage here.
    await network.ozone.ctx.db.db
      .insertInto('inbox_seen')
      .values({
        did: sc.dids.alice,
        section: 'subjects',
        seenAt: toDatetimeString(Date.now() + 1000),
      })
      .execute()
    const { data: read } = await call(
      sc.dids.alice,
      tools.ozone.inbox.listActionedSubjects.$lxm,
    )
    expect(
      read.subjects.every((subject: { isRead: boolean }) => subject.isRead),
    ).toBe(true)
  })

  it('returns only public history and a de-identified report summary', async () => {
    await sc.createReport({
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      reportedBy: sc.dids.carol,
      reason: 'PRIVATE REPORTER COMMENT',
    })
    await network.processAll()
    const { data: detail } = await call(
      sc.dids.alice,
      tools.ozone.inbox.getActionedSubject.$lxm,
      { subject: sc.dids.alice },
    )
    expect(detail.actions).toEqual([
      expect.objectContaining({ type: 'labelApplied', labels: ['spam'] }),
    ])
    expect(detail.reports.reasonTypes).toEqual([
      'com.atproto.moderation.defs#reasonSpam',
    ])
    expect(detail.reports.firstReportedOn).toMatch(/T00:00:00\.000Z$/)
    for (const secret of [
      sc.dids.carol,
      'PRIVATE MODERATOR COMMENT',
      'PRIVATE METADATA',
      'PRIVATE REPORTER COMMENT',
    ]) {
      expect(JSON.stringify(detail)).not.toContain(secret)
    }
    expect(detail.reports).not.toHaveProperty('count')
    expect(tools.ozone.inbox.defs.subjectViewDetail.$matches(detail)).toBe(true)
  })

  it('hides other accounts and permits authorized detail previews', async () => {
    for (const subject of [
      sc.dids.alice,
      sc.posts[sc.dids.alice][0].ref.uriStr,
    ]) {
      await expect(
        call(sc.dids.bob, tools.ozone.inbox.getActionedSubject.$lxm, {
          subject,
        }),
      ).rejects.toMatchObject({ error: 'NotFound' })
    }
    const method = tools.ozone.inbox.getActionedSubject.$lxm
    const preview = await fetch(
      `${network.ozone.url}/xrpc/${method}?did=${encodeURIComponent(sc.dids.alice)}&subject=${encodeURIComponent(sc.dids.alice)}`,
      {
        headers: await network.ozone.modHeaders(method),
      },
    )
    expect(preview.status).toBe(200)
    expect((await preview.json()).subject).toMatchObject({ did: sc.dids.alice })
    await expect(
      call(sc.dids.bob, method, { did: sc.dids.alice, subject: sc.dids.alice }),
    ).rejects.toMatchObject({ error: 'Forbidden' })
    const unauthenticated = await fetch(
      `${network.ozone.url}/xrpc/${method}?subject=${encodeURIComponent(sc.dids.alice)}`,
    )
    expect(unauthenticated.status).toBe(401)
  })

  it('preserves reversal dates across history pages', async () => {
    const post = sc.posts[sc.dids.bob][0].ref
    const subject = {
      $type: 'com.atproto.repo.strongRef' as const,
      uri: post.uriStr,
      cid: post.cidStr,
    }
    const applied = await label(subject, ['spam', 'porn'])
    await label(subject, [], ['spam'])
    const removed = await label(subject, [], ['porn'])
    const takenDown = await mod.emitEvent({
      subject,
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
    })
    const reversed = await mod.emitEvent({
      subject,
      event: { $type: 'tools.ozone.moderation.defs#modEventReverseTakedown' },
    })
    const method = tools.ozone.inbox.getActionedSubject.$lxm
    const { data: full } = await call(sc.dids.bob, method, {
      subject: post.uriStr,
    })
    const actions: typeof full.actions = []
    let cursor: string | undefined
    do {
      const { data: page } = await call(sc.dids.bob, method, {
        subject: post.uriStr,
        limit: 1,
        cursor,
      })
      expect(page.actions).toHaveLength(1)
      expect(page.enforcement).toEqual(full.enforcement)
      actions.push(...page.actions)
      cursor = page.cursor
    } while (cursor)
    expect(actions).toEqual(full.actions)
    expect(actions).toContainEqual(
      expect.objectContaining({
        id: applied.id,
        reversedAt: removed.createdAt,
      }),
    )
    expect(actions).toContainEqual(
      expect.objectContaining({
        id: takenDown.id,
        reversedAt: reversed.createdAt,
      }),
    )
    expect(actions).toHaveLength(4)
    await expect(
      call(sc.dids.bob, method, { subject: post.uriStr, cursor: 'bogus' }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
    await expect(
      call(sc.dids.bob, method, { subject: post.uriStr, limit: 101 }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  it('bounds the default history page and continues without duplicates', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef' as const,
      did: sc.dids.dan,
    }
    for (let i = 0; i < 51; i++) await label(subject)
    const method = tools.ozone.inbox.getActionedSubject.$lxm
    const { data: first } = await call(sc.dids.dan, method, {
      subject: sc.dids.dan,
    })
    expect(first.actions).toHaveLength(50)
    expect(first.cursor).toBeDefined()
    const { data: last } = await call(sc.dids.dan, method, {
      subject: sc.dids.dan,
      cursor: first.cursor,
    })
    expect(last.actions).toHaveLength(1)
    expect(last.cursor).toBeUndefined()
    expect(
      new Set(
        [...first.actions, ...last.actions].map((a: { id: number }) => a.id),
      ).size,
    ).toBe(51)
  })

  it('keeps chat events out of the account list and detail', async () => {
    const did = sc.dids.carol
    const accountAction = await label({
      $type: 'com.atproto.admin.defs#repoRef',
      did,
    })
    await label(
      {
        $type: 'chat.bsky.convo.defs#messageRef',
        did,
        convoId: 'private-convo',
        messageId: 'private-message',
      },
      ['porn'],
    )
    await label(
      { $type: 'chat.bsky.convo.defs#convoRef', did, convoId: 'private-convo' },
      ['sexual'],
    )
    const { data: list } = await call(
      did,
      tools.ozone.inbox.listActionedSubjects.$lxm,
    )
    expect(list.subjects).toEqual([
      expect.objectContaining({
        subject: { $type: 'com.atproto.admin.defs#repoRef', did },
        actionCount: 1,
        latestAction: expect.objectContaining({ id: accountAction.id }),
      }),
    ])
    const { data: detail } = await call(
      did,
      tools.ozone.inbox.getActionedSubject.$lxm,
      { subject: did },
    )
    expect(detail.actions).toEqual([
      expect.objectContaining({ id: accountAction.id }),
    ])
  })
})
