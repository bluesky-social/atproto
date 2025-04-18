import { Timestamp } from '@bufbuild/protobuf'
import { ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { IsoSortAtKey } from '../db/pagination'
import { countAll, notSoftDeletedClause } from '../db/util'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getNotifications(req) {
    const { actorDid, limit, cursor, priority } = req
    const { ref } = db.db.dynamic
    const priorityFollowQb = db.db
      .selectFrom('follow')
      .select(sql<boolean>`${true}`.as('val'))
      .where('creator', '=', actorDid)
      .whereRef('subjectDid', '=', ref('notif.author'))
      .limit(1)

    let builder = db.db
      .selectFrom('notification as notif')
      .where('notif.did', '=', actorDid)
      .where((clause) =>
        clause
          .where('reasonSubject', 'is', null)
          .orWhereExists(
            db.db
              .selectFrom('record as subject')
              .selectAll()
              .whereRef('subject.uri', '=', ref('notif.reasonSubject')),
          ),
      )
      .if(priority, (qb) => qb.whereExists(priorityFollowQb))
      .select([
        'notif.author as authorDid',
        'notif.recordUri as uri',
        'notif.recordCid as cid',
        'notif.reason as reason',
        'notif.reasonSubject as reasonSubject',
        'notif.sortAt as sortAt',
      ])
      .select(priorityFollowQb.as('priority'))

    const key = new IsoSortAtKey(ref('notif.sortAt'))
    builder = key.paginate(builder, {
      cursor,
      limit,
    })

    const notifsRes = await builder.execute()
    const notifications = notifsRes.map((notif) => ({
      recipientDid: actorDid,
      uri: notif.uri,
      reason: notif.reason,
      reasonSubject: notif.reasonSubject ?? undefined,
      timestamp: Timestamp.fromDate(new Date(notif.sortAt)),
      priority: notif.priority ?? false,
    }))
    return {
      notifications,
      cursor: key.packFromResult(notifsRes),
    }
  },

  async getNotificationSeen(req) {
    const { actorDid, priority } = req
    const res = await db.db
      .selectFrom('actor_state')
      .where('did', '=', actorDid)
      .selectAll()
      .executeTakeFirst()
    if (!res) {
      return {}
    }
    const lastSeen =
      priority && res.lastSeenPriorityNotifs
        ? res.lastSeenPriorityNotifs
        : res.lastSeenNotifs
    return {
      timestamp: Timestamp.fromDate(new Date(lastSeen)),
    }
  },

  async getUnreadNotificationCount(req) {
    const { actorDid, priority } = req
    const { ref } = db.db.dynamic
    const lastSeenRes = await db.db
      .selectFrom('actor_state')
      .where('did', '=', actorDid)
      .selectAll()
      .executeTakeFirst()
    const lastSeen =
      priority && lastSeenRes?.lastSeenPriorityNotifs
        ? lastSeenRes.lastSeenPriorityNotifs
        : lastSeenRes?.lastSeenNotifs

    const result = await db.db
      .selectFrom('notification')
      .select(countAll.as('count'))
      .innerJoin('actor', 'actor.did', 'notification.did')
      .leftJoin('actor_state', 'actor_state.did', 'actor.did')
      .innerJoin('record', 'record.uri', 'notification.recordUri')
      .where(notSoftDeletedClause(ref('record')))
      .where(notSoftDeletedClause(ref('actor')))
      // Ensure to hit notification_did_sortat_idx, handling case where lastSeenNotifs is null.
      .where('notification.did', '=', actorDid)
      .where('notification.sortAt', '>', lastSeen ?? '')
      .if(priority, (qb) =>
        qb.whereExists(
          db.db
            .selectFrom('follow')
            .select(sql<boolean>`${true}`.as('val'))
            .where('creator', '=', actorDid)
            .whereRef('subjectDid', '=', ref('notification.author')),
        ),
      )
      .executeTakeFirst()

    return {
      count: result?.count,
    }
  },

  async updateNotificationSeen(req) {
    const { actorDid, timestamp, priority } = req
    if (!timestamp) {
      return
    }
    const timestampIso = timestamp.toDate().toISOString()
    let builder = db.db
      .updateTable('actor_state')
      .where('did', '=', actorDid)
      .returningAll()
    if (priority) {
      builder = builder.set({ lastSeenPriorityNotifs: timestampIso })
    } else {
      builder = builder.set({ lastSeenNotifs: timestampIso })
    }
    const updateRes = await builder.executeTakeFirst()
    if (updateRes) {
      return
    }
    await db.db
      .insertInto('actor_state')
      .values({
        did: actorDid,
        lastSeenNotifs: timestampIso,
        priorityNotifs: priority,
        lastSeenPriorityNotifs: priority ? timestampIso : undefined,
      })
      .onConflict((oc) => oc.doNothing())
      .executeTakeFirst()
  },
})
