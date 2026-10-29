import { randomUUID } from 'node:crypto'
import { type Selectable, sql } from 'kysely'
import type { DatetimeString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import type { InboxNotification } from '../db/schema/inbox_notification.js'
import { dbLogger } from '../logger.js'
import { notificationVisibility } from './notification-visibility.js'
import { getNotificationPreferences } from './preferences.js'

export type PushCategory = 'reports' | 'account' | 'labels'

export function pushCategory(
  notification: Pick<InboxNotification, 'reason' | 'target'>,
): PushCategory {
  if (
    notification.reason === 'reportResolved' ||
    notification.reason === 'reportReopened'
  )
    return 'reports'
  if (
    (notification.reason === 'actionTaken' ||
      notification.reason === 'actionReversed') &&
    'actionType' in notification.target &&
    (notification.target.actionType === 'labelApplied' ||
      notification.target.actionType === 'labelRemoved')
  )
    return 'labels'
  return 'account'
}

/** Insert optional push work without losing the surrounding inbox history. */
export async function enqueuePushNotifications(
  db: Database,
  notifications: Selectable<InboxNotification>[],
): Promise<void> {
  if (!notifications.length) return
  db.assertTransaction()
  await sql`savepoint inbox_push_work`.execute(db.db)
  try {
    // Optional delivery must not hold up the source action on a blocked outbox.
    const setting = await sql<{ value: string; milliseconds: number }>`
      select current_setting('lock_timeout') as value, setting::int as milliseconds
      from pg_settings where name = 'lock_timeout'
    `.execute(db.db)
    if (!setting.rows[0].milliseconds || setting.rows[0].milliseconds > 250) {
      await sql`select set_config('lock_timeout', '250ms', true)`.execute(db.db)
    }
    const dids = [
      ...new Set(
        notifications.map((notification) => notification.recipientDid),
      ),
    ]
    const preferences = await db.db
      .selectFrom('inbox_notification_preference')
      .selectAll()
      .where('did', 'in', dids)
      .execute()
    const byDid = new Map(preferences.map((row) => [row.did, row]))
    const eligible = notifications.filter((notification) => {
      const pref = byDid.get(notification.recipientDid)
      return pref?.[pushCategory(notification)] ?? pref?.push ?? true
    })
    if (eligible.length) {
      await db.db
        .insertInto('inbox_push_outbox')
        .values(
          eligible.map((notification) => ({
            notificationId: notification.id,
            createdAt: notification.createdAt,
            leaseToken: null,
            leaseUntil: null,
            finishedAt: null,
          })),
        )
        .onConflict((oc) => oc.column('notificationId').doNothing())
        .execute()
    }
    await sql`select set_config('lock_timeout', ${setting.rows[0].value}, true)`.execute(
      db.db,
    )
    await sql`release savepoint inbox_push_work`.execute(db.db)
  } catch (err) {
    await sql`rollback to savepoint inbox_push_work`.execute(db.db)
    await sql`release savepoint inbox_push_work`.execute(db.db)
    dbLogger.error(
      { code: (err as { code?: string }).code },
      'inbox push enqueue failed',
    )
  }
}

const MAX_AGE_MS = 60 * 60 * 1000
const LEASE_MS = 60 * 1000

/** Claim unprocessed work without relying on transaction commit order. */
export async function claimPushNotifications(
  db: Database,
  limit: number,
  startAt?: DatetimeString,
) {
  return db.transaction(async (txn) => {
    const clock = await sql<{ now: Date }>`select now() as now`.execute(txn.db)
    const now = clock.rows[0].now
    await sql`delete from inbox_push_outbox where "notificationId" in (
      select "notificationId" from inbox_push_outbox
      where "finishedAt" is not null and "finishedAt" < ${new Date(now.getTime() - 7 * 24 * MAX_AGE_MS)}
      order by "finishedAt", "notificationId" limit 500
      for update skip locked
    )`.execute(txn.db)
    const rows = await txn.db
      .selectFrom('inbox_push_outbox as o')
      .innerJoin('inbox_notification as n', 'n.id', 'o.notificationId')
      .selectAll('n')
      .where('o.state', '=', 'pending')
      .where((eb) =>
        eb.or([eb('o.leaseUntil', 'is', null), eb('o.leaseUntil', '<=', now)]),
      )
      .orderBy('o.createdAt')
      .orderBy('o.notificationId')
      .limit(limit)
      .forUpdate('o')
      .skipLocked()
      .execute()

    const claimed: Array<{
      id: number
      leaseToken: string
      recipientDid: InboxNotification['recipientDid']
      reason: InboxNotification['reason']
      target: InboxNotification['target']
      createdAt: DatetimeString
      category: PushCategory
    }> = []
    const prefs = new Map<
      string,
      Awaited<ReturnType<typeof getNotificationPreferences>>
    >()
    let expired = 0
    let suppressed = 0
    for (const row of rows) {
      if (new Date(row.createdAt).getTime() + MAX_AGE_MS <= now.getTime()) {
        expired++
        await txn.db
          .updateTable('inbox_push_outbox')
          .set({
            state: 'expired',
            finishedAt: now,
            leaseToken: null,
            leaseUntil: null,
          })
          .where('notificationId', '=', row.id)
          .execute()
        continue
      }
      const category = pushCategory(row)
      let pref = prefs.get(row.recipientDid)
      if (!pref) {
        pref = await getNotificationPreferences(txn, row.recipientDid)
        prefs.set(row.recipientDid, pref)
      }
      const visible =
        !startAt ||
        !!(await txn.db
          .selectFrom('inbox_notification as n')
          .select('n.id')
          .where('n.id', '=', row.id)
          .where(notificationVisibility(row.recipientDid, startAt))
          .executeTakeFirst())
      if (!pref[category] || !visible) {
        suppressed++
        await txn.db
          .updateTable('inbox_push_outbox')
          .set({
            state: 'suppressed',
            finishedAt: now,
            leaseToken: null,
            leaseUntil: null,
          })
          .where('notificationId', '=', row.id)
          .execute()
        continue
      }
      const leaseToken = randomUUID()
      await txn.db
        .updateTable('inbox_push_outbox')
        .set((eb) => ({
          leaseToken,
          leaseUntil: sql<Date>`clock_timestamp() + ${LEASE_MS} * interval '1 millisecond'`,
          attempts: eb('attempts', '+', 1),
        }))
        .where('notificationId', '=', row.id)
        .execute()
      claimed.push({
        id: row.id,
        leaseToken,
        recipientDid: row.recipientDid,
        reason: row.reason,
        target: row.target,
        createdAt: row.createdAt,
        category,
      })
    }
    return {
      notifications: claimed,
      processed: rows.length,
      expired,
      suppressed,
    }
  })
}

/** Acknowledgements are fenced by the lease token and can be retried. */
export async function ackPushNotifications(
  db: Database,
  items: Array<{ id: number; leaseToken: string }>,
) {
  return db.transaction(async (txn) => {
    const acknowledged: number[] = []
    for (const item of items) {
      const row = await txn.db
        .selectFrom('inbox_push_outbox')
        .selectAll()
        .where('notificationId', '=', item.id)
        .forUpdate()
        .executeTakeFirst()
      if (!row || row.leaseToken !== item.leaseToken) continue
      if (row.state === 'handedOff') {
        acknowledged.push(item.id)
      } else if (row.state === 'pending') {
        const updated = await txn.db
          .updateTable('inbox_push_outbox')
          .set({
            state: 'handedOff',
            finishedAt: sql<Date>`clock_timestamp()`,
            leaseUntil: null,
          })
          .where('notificationId', '=', item.id)
          .where('leaseUntil', '>', sql<Date>`clock_timestamp()`)
          .returning('notificationId')
          .executeTakeFirst()
        if (updated) acknowledged.push(item.id)
      }
    }
    return acknowledged
  })
}
