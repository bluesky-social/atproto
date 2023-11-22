import { sql } from 'kysely'
import { countAll } from '../../db/util'
import { PrimaryDatabase } from '../../db'

export const tidyNotifications = async (db: PrimaryDatabase, did: string) => {
  // @TODO decide thresholds
  // i.e. 30 days before the last time the user checked their notifs
  const beforeLastSeenThresholdDays = 30
  // i.e. 180 days before the latest unread notification
  const beforeLatestUnreadThresholdDays = 180
  // don't consider culling unreads until they hit this threshold, and then enforce beforeLatestUnreadThresholdDays
  const unreadKeptThresholdCount = 500
  const stats = await db.db
    .selectFrom('notification')
    .select([
      sql<0 | 1>`("sortAt" < "lastSeenNotifs")`.as('read'),
      countAll.as('count'),
      sql<string>`min("sortAt")`.as('earliestAt'),
      sql<string>`max("sortAt")`.as('latestAt'),
      sql<string>`max("lastSeenNotifs")`.as('lastSeenAt'),
    ])
    .leftJoin('actor_state', 'actor_state.did', 'notification.did')
    .where('notification.did', '=', did)
    .groupBy(sql`1`) // group by read (i.e. 1st column)
    .execute()
  const readStats = stats.find((stat) => stat.read)
  const unreadStats = stats.find((stat) => !stat.read)
  let readCutoffAt: Date | undefined
  let unreadCutoffAt: Date | undefined
  if (readStats) {
    readCutoffAt = addDays(
      new Date(readStats.lastSeenAt),
      -beforeLastSeenThresholdDays,
    )
  }
  if (unreadStats && unreadStats.count > unreadKeptThresholdCount) {
    unreadCutoffAt = addDays(
      new Date(unreadStats.latestAt),
      -beforeLatestUnreadThresholdDays,
    )
  }
  // take most recent of read/unread cutoffs
  const cutoffAt = greatest(readCutoffAt, unreadCutoffAt)
  if (cutoffAt) {
    // skip delete if it wont catch any notifications
    const earliestAt = least(readStats?.earliestAt, unreadStats?.earliestAt)
    if (earliestAt && earliestAt < cutoffAt.toISOString()) {
      await db.db
        .deleteFrom('notification')
        .where('did', '=', did)
        .where('sortAt', '<', cutoffAt.toISOString())
        .execute()
    }
  }
}

const addDays = (date: Date, days: number) => {
  date.setDate(date.getDate() + days)
  return date
}

const least = <T extends Ordered>(a: T | undefined, b: T | undefined) => {
  return a !== undefined && (b === undefined || a < b) ? a : b
}

const greatest = <T extends Ordered>(a: T | undefined, b: T | undefined) => {
  return a !== undefined && (b === undefined || a > b) ? a : b
}

type Ordered = string | number | Date
