import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import { countAll, excluded } from '../../../db/util'
import { sql } from 'kysely'
import { TimeCidKeyset, paginate } from '../../../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getNotifications(req) {
    const { actorDid, limit, cursor } = req
    const { ref } = db.db.dynamic
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
      .select([
        'notif.author as authorDid',
        'notif.recordUri as uri',
        'notif.recordCid as cid',
        'notif.reason as reason',
        'notif.reasonSubject as reasonSubject',
        'notif.sortAt as sortAt',
      ])

    const keyset = new TimeCidKeyset(
      ref('notif.sortAt'),
      ref('notif.recordCid'),
    )
    builder = paginate(builder, {
      cursor,
      limit,
      keyset,
      tryIndex: true,
    })

    const notifsRes = await builder.execute()
    const notifications = notifsRes.map((notif) => ({
      uri: notif.uri,
      reason: notif.reason,
      timestamp: {
        nanos: new Date(notif.sortAt).getTime() * 1000,
      },
    }))
    return {
      notifications,
      cursor: keyset.packFromResult(notifsRes),
    }
  },

  async getNotificationSeen(req) {
    const res = await db.db
      .selectFrom('actor_state')
      .where('did', '=', req.actorDid)
      .selectAll()
      .executeTakeFirst()
    if (!res) {
      return {}
    }
    const nanos = new Date(res.lastSeenNotifs).getTime() * 1000
    return {
      timestamp: {
        nanos,
      },
    }
  },

  async getUnreadNotificationCount(req) {
    const { actorDid } = req
    const { ref } = db.db.dynamic
    const result = await db.db
      .selectFrom('notification')
      .select(countAll.as('count'))
      .innerJoin('actor', 'actor.did', 'notification.did')
      .leftJoin('actor_state', 'actor_state.did', 'actor.did')
      .innerJoin('record', 'record.uri', 'notification.recordUri')
      // Ensure to hit notification_did_sortat_idx, handling case where lastSeenNotifs is null.
      .where('notification.did', '=', actorDid)
      .where(
        'notification.sortAt',
        '>',
        sql`coalesce(${ref('actor_state.lastSeenNotifs')}, ${''})`,
      )
      .executeTakeFirst()

    return {
      count: result?.count,
    }
  },

  async updateNotificationSeen(req) {
    const { actorDid, timestamp } = req
    if (!timestamp) {
      return
    }
    const lastSeenNotifs = new Date(
      Math.floor(timestamp.nanos / 1000),
    ).toISOString()
    await db.db
      .insertInto('actor_state')
      .values({ did: actorDid, lastSeenNotifs })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({
          lastSeenNotifs: excluded(db.db, 'lastSeenNotifs'),
        }),
      )
      .executeTakeFirst()
  },
})
