import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { asDatetimeString, toDatetimeString } from '@atproto/lex'
import { createInboxNotification } from '../src/inbox/notifications.js'
import { com, tools } from '../src/lexicons/index.js'
import { resetInbox, seedSeenAt } from './_inbox.js'

describe('inbox read watermarks', () => {
  let network: TestNetwork
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({ dbPostgresSchema: 'ozone_inbox_seen' })
    sc = network.getSeedClient()
    await basicSeed(sc)
  })
  afterAll(async () => network?.close())

  beforeEach(async () => {
    await resetInbox(network.ozone.ctx.db)
  })

  function headers() {
    return {
      ...sc.getHeaders(sc.dids.alice),
      'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
    }
  }

  function updateSeen(sections: string[], seenAt: string) {
    return sc.agent.tools.ozone.inbox.updateSeen(
      { sections, seenAt },
      { headers: headers() },
    )
  }

  async function addNotification(section: 'reports' | 'subjects', at: string) {
    await createInboxNotification(network.ozone.ctx.db, {
      recipientDid: sc.dids.alice,
      reason: section === 'reports' ? 'reportResolved' : 'actionTaken',
      target:
        section === 'reports'
          ? tools.ozone.inbox.defs.reportRef.$build({ reportId: 123 })
          : tools.ozone.inbox.defs.subjectRef.$build({
              subject: com.atproto.admin.defs.repoRef.$build({
                did: sc.dids.alice,
              }),
            }),
      sourceKey: `${section}:${at}`,
      createdAt: toDatetimeString(at),
    })
  }

  async function readState(section: 'reports' | 'subjects') {
    const options = { headers: headers() }
    const [all, unread, count] = await Promise.all([
      sc.agent.tools.ozone.inbox.listNotifications({ section }, options),
      sc.agent.tools.ozone.inbox.listNotifications(
        { section, unreadOnly: true },
        options,
      ),
      sc.agent.tools.ozone.inbox.getUnreadCount({ section }, options),
    ])
    return {
      isRead: all.data.notifications.map((n) => n.isRead),
      unread: unread.data.notifications.length,
      count: count.data.unreadCounts.total,
    }
  }

  it.each([false, true])(
    'keeps each section independent when the lagging section has a watermark: %s',
    async (hasWatermark) => {
      await addNotification('reports', '2026-01-01T04:00:00.000Z')
      await addNotification('subjects', '2026-01-01T04:00:00.000Z')
      if (hasWatermark) {
        await updateSeen(['subjects'], '2026-01-01T01:00:00.000Z')
      }
      await updateSeen(['reports'], '2026-01-01T05:00:00.000Z')
      const { data } = await updateSeen(
        ['reports', 'subjects', 'reports'],
        '2026-01-01T03:00:00.000Z',
      )
      expect(data.seenAt).toBe('2026-01-01T03:00:00.000Z')
      expect(await readState('reports')).toEqual({
        isRead: [true],
        unread: 0,
        count: 0,
      })
      expect(await readState('subjects')).toEqual({
        isRead: [false],
        unread: 1,
        count: 1,
      })
      const repeat = await updateSeen(
        ['subjects', 'reports'],
        '2026-01-01T02:00:00.000Z',
      )
      expect(repeat.data.seenAt).toBe(data.seenAt)
      expect(await readState('subjects')).toEqual({
        isRead: [false],
        unread: 1,
        count: 1,
      })
    },
  )

  it.each([
    '2026-01-01T14:00:00+02:00',
    '2026-01-01T10:00:00-02:00',
    '2026-01-01T12:00:00Z',
  ])(
    'normalizes %s before comparing notification timestamps',
    async (seenAt) => {
      await addNotification('subjects', '2026-01-01T12:00:00.000Z')
      await addNotification('subjects', '2026-01-01T13:00:00.000Z')
      const { data } = await updateSeen(['subjects'], seenAt)
      expect(data.seenAt).toBe('2026-01-01T12:00:00.000Z')
      expect(await readState('subjects')).toEqual({
        isRead: [false, true],
        unread: 1,
        count: 1,
      })
    },
  )

  it('clamps a future instant even when its offset date sorts before now', async () => {
    const before = Date.now()
    const future = new Date(before - 5 * 60 * 60 * 1000)
      .toISOString()
      .replace('Z', '-12:00')
    await addNotification('subjects', toDatetimeString(before + 60_000))
    const { data } = await updateSeen(['subjects'], future)
    expect(Date.parse(data.seenAt)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(data.seenAt)).toBeLessThanOrEqual(Date.now())
    expect(data.seenAt).toBe(new Date(data.seenAt).toISOString())
    expect(await readState('subjects')).toEqual({
      isRead: [false],
      unread: 1,
      count: 1,
    })
  })

  it('preserves the API datetime range when an existing watermark is updated', async () => {
    await updateSeen(['subjects'], '0000-01-01T00:00:00Z')
    const { data } = await updateSeen(['subjects'], '2026-01-01T12:00:00Z')
    expect(data.seenAt).toBe('2026-01-01T12:00:00.000Z')
  })

  it.each([
    ['2026-01-01T14:00:00+02:00', '13:00:00.000', '13:00:00.000'],
    ['2026-01-01T10:00:00-02:00', '11:00:00.000', '12:00:00.000'],
    ['2026-01-01T12:00:00Z', '12:00:00.500', '12:00:00.500'],
    ['2026-01-01T12:00:00.123456Z', '12:00:00.100', '12:00:00.123'],
  ])(
    'normalizes an existing watermark %s when updating it',
    async (existing, requested, expected) => {
      // @NOTE Fixture for rows written before updateSeen normalized timestamps.
      await seedSeenAt(
        network.ozone.ctx.db,
        sc.dids.alice,
        'subjects',
        asDatetimeString(existing),
      )
      await addNotification('subjects', `2026-01-01T${expected}Z`)
      await addNotification('subjects', '2026-01-01T15:00:00.000Z')
      const { data } = await updateSeen(
        ['subjects'],
        `2026-01-01T${requested}Z`,
      )
      expect(data.seenAt).toBe(`2026-01-01T${expected}Z`)
      expect(await readState('subjects')).toEqual({
        isRead: [false, true],
        unread: 1,
        count: 1,
      })
    },
  )
})
