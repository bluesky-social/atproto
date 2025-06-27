import { PlainMessage } from '@bufbuild/protobuf'
import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import { Service } from '../../../proto/bsky_connect'
import {
  ActivitySubscription,
  GetActivitySubscriptionsByActorAndSubjectsResponse,
} from '../../../proto/bsky_pb'
import { Namespaces } from '../../../stash'
import { Database } from '../db'
import { StashKeyKey } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActivitySubscriptionsByActorAndSubjects(req) {
    const { actorDid, subjectDids } = req
    if (subjectDids.length === 0) {
      return new GetActivitySubscriptionsByActorAndSubjectsResponse({
        subscriptions: [],
      })
    }

    const res = await db.db
      .selectFrom('activity_subscription')
      .selectAll()
      .where('creator', '=', actorDid)
      .where('subjectDid', 'in', subjectDids)
      .execute()

    const bySubject = keyBy(res, 'subjectDid')
    const subscriptions = subjectDids.map(
      (did): PlainMessage<ActivitySubscription> => {
        const subject = bySubject.get(did)
        if (!subject) {
          return {
            actorDid,
            namespace:
              Namespaces.AppBskyNotificationDefsSubjectActivitySubscription,
            key: '',
            post: undefined,
            reply: undefined,
            subjectDid: '',
          }
        }

        return {
          actorDid,
          namespace:
            Namespaces.AppBskyNotificationDefsSubjectActivitySubscription,
          key: subject.key,
          post: subject.post ? {} : undefined,
          reply: subject.reply ? {} : undefined,
          subjectDid: subject.subjectDid,
        }
      },
    )

    return {
      subscriptions,
    }
  },

  async getActivitySubscriptionDids(req) {
    const { actorDid, cursor, limit } = req

    let builder = db.db
      .selectFrom('activity_subscription')
      .selectAll()
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
      cursor: key.packFromResult(res),
    }
  },
})
