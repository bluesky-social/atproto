import assert from 'assert'
import { AtUri } from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { BskyDaemon, DaemonConfig, PrimaryDatabase } from '../src'
import usersSeed from './seeds/users'
import { countAll, excluded } from '../src/db/util'
import { NotificationsDaemon } from '../src/daemon/notifications'
import {
  BEFORE_LAST_SEEN_DAYS,
  BEFORE_LATEST_UNREAD_DAYS,
  UNREAD_KEPT_COUNT,
} from '../src/services/util/notification'

describe('daemon', () => {
  let network: TestNetwork
  let daemon: BskyDaemon
  let db: PrimaryDatabase
  let actors: { did: string }[] = []

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_daemon',
    })
    db = network.bsky.ctx.db.getPrimary()
    daemon = BskyDaemon.create({
      db,
      cfg: new DaemonConfig({
        version: network.bsky.ctx.cfg.version,
        dbPostgresUrl: network.bsky.ctx.cfg.dbPrimaryPostgresUrl,
        dbPostgresSchema: network.bsky.ctx.cfg.dbPostgresSchema,
      }),
    })
    const sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    actors = await db.db.selectFrom('actor').selectAll().execute()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('notifications daemon', () => {
    it('processes all dids', async () => {
      for (const { did } of actors) {
        await Promise.all([
          setLastSeen(daemon.ctx.db, { did }),
          createNotifications(daemon.ctx.db, {
            did,
            daysAgo: 2 * BEFORE_LAST_SEEN_DAYS,
            count: 1,
          }),
        ])
      }
      await expect(countNotifications(db)).resolves.toBe(actors.length)
      await runNotifsOnce(daemon.notifications)
      await expect(countNotifications(db)).resolves.toBe(0)
    })

    it('removes read notifications older than threshold.', async () => {
      const { did } = actors[0]
      const lastSeenDaysAgo = 10
      await Promise.all([
        setLastSeen(daemon.ctx.db, { did, daysAgo: lastSeenDaysAgo }),
        // read, delete
        createNotifications(daemon.ctx.db, {
          did,
          daysAgo: lastSeenDaysAgo + BEFORE_LAST_SEEN_DAYS + 1,
          count: 2,
        }),
        // read, keep
        createNotifications(daemon.ctx.db, {
          did,
          daysAgo: lastSeenDaysAgo + BEFORE_LAST_SEEN_DAYS - 1,
          count: 3,
        }),
        // unread, keep
        createNotifications(daemon.ctx.db, {
          did,
          daysAgo: lastSeenDaysAgo - 1,
          count: 4,
        }),
      ])
      await expect(countNotifications(db)).resolves.toBe(9)
      await runNotifsOnce(daemon.notifications)
      await expect(countNotifications(db)).resolves.toBe(7)
      await clearNotifications(db)
    })

    it('removes unread notifications older than threshold.', async () => {
      const { did } = actors[0]
      await Promise.all([
        setLastSeen(daemon.ctx.db, {
          did,
          daysAgo: 2 * BEFORE_LATEST_UNREAD_DAYS, // all are unread
        }),
        createNotifications(daemon.ctx.db, {
          did,
          daysAgo: 0,
          count: 1,
        }),
        createNotifications(daemon.ctx.db, {
          did,
          daysAgo: BEFORE_LATEST_UNREAD_DAYS - 1,
          count: 99,
        }),
        createNotifications(daemon.ctx.db, {
          did,
          daysAgo: BEFORE_LATEST_UNREAD_DAYS + 1,
          count: 400,
        }),
      ])
      await expect(countNotifications(db)).resolves.toBe(UNREAD_KEPT_COUNT)
      await runNotifsOnce(daemon.notifications)
      // none removed when within UNREAD_KEPT_COUNT
      await expect(countNotifications(db)).resolves.toBe(UNREAD_KEPT_COUNT)
      // add one more, tip over UNREAD_KEPT_COUNT
      await createNotifications(daemon.ctx.db, {
        did,
        daysAgo: BEFORE_LATEST_UNREAD_DAYS + 1,
        count: 1,
      })
      await runNotifsOnce(daemon.notifications)
      // removed all older than BEFORE_LATEST_UNREAD_DAYS
      await expect(countNotifications(db)).resolves.toBe(100)
      await clearNotifications(db)
    })
  })

  const runNotifsOnce = async (notifsDaemon: NotificationsDaemon) => {
    assert(!notifsDaemon.running, 'notifications daemon is already running')
    notifsDaemon.run({ forever: false, batchSize: 2 })
    await notifsDaemon.running
  }

  const setLastSeen = async (
    db: PrimaryDatabase,
    opts: { did: string; daysAgo?: number },
  ) => {
    const { did, daysAgo = 0 } = opts
    const lastSeenAt = new Date()
    lastSeenAt.setDate(lastSeenAt.getDate() - daysAgo)
    await db.db
      .insertInto('actor_state')
      .values({ did, lastSeenNotifs: lastSeenAt.toISOString() })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({
          lastSeenNotifs: excluded(db.db, 'lastSeenNotifs'),
        }),
      )
      .execute()
  }

  const createNotifications = async (
    db: PrimaryDatabase,
    opts: {
      did: string
      count: number
      daysAgo: number
    },
  ) => {
    const { did, count, daysAgo } = opts
    const sortAt = new Date()
    sortAt.setDate(sortAt.getDate() - daysAgo)
    await db.db
      .insertInto('notification')
      .values(
        [...Array(count)].map(() => ({
          did,
          author: did,
          reason: 'none',
          recordCid: 'bafycid',
          recordUri: AtUri.make(did, 'invalid.collection', 'self').toString(),
          sortAt: sortAt.toISOString(),
        })),
      )
      .execute()
  }

  const clearNotifications = async (db: PrimaryDatabase) => {
    await db.db.deleteFrom('notification').execute()
  }

  const countNotifications = async (db: PrimaryDatabase) => {
    const { count } = await db.db
      .selectFrom('notification')
      .select(countAll.as('count'))
      .executeTakeFirstOrThrow()
    return count
  }
})
