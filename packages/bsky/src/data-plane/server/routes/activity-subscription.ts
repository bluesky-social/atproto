import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { NamespaceAppBskyNotificationDefsSubjectActivitySubscription } from '../../../stash'
import { Database } from '../db'
import { StashKeyKey } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActivitySubscription(req) {
    const { actorDid, subjectDid } = req

    const res = await db.db
      .selectFrom('activity_subscription')
      .selectAll()
      .where('creator', '=', actorDid)
      .where('subjectDid', '=', subjectDid)
      .executeTakeFirst()
    if (!res) {
      return {}
    }

    return {
      creator: actorDid,
      namespace: NamespaceAppBskyNotificationDefsSubjectActivitySubscription,
      key: res.key,
      activitySubscription: {
        post: res.post,
        reply: res.reply,
      },
    }
  },

  async getActivitySubscriptions(req) {
    const { actorDid, cursor, limit } = req

    let builder = db.db
      .selectFrom('activity_subscription')
      .select('subjectDid')
      .where('creator', '=', actorDid)

    const { ref } = db.db.dynamic
    const key = new StashKeyKey(ref('activity_subscription.key'))
    builder = key.paginate(builder, {
      cursor,
      limit,
    })
    const res = await builder.execute()
    const dids = res.map(({ subjectDid }) => subjectDid)
    return {
      dids,
    }
  },
})
