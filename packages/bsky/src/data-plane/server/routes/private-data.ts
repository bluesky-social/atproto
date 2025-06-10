import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import {
  ChatPreference,
  FilterablePreference,
  Preference,
  Preferences,
  SubjectActivitySubscription,
} from '../../../lexicon/types/app/bsky/notification/defs'
import { Service } from '../../../proto/bsky_connect'
import {
  ChatNotificationInclude,
  ChatNotificationPreference,
  FilterableNotificationPreference,
  NotificationInclude,
  NotificationPreference,
  NotificationPreferences,
} from '../../../proto/bsky_pb'
import { Database } from '../db'
import { IndexedAtKeyKeyset } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActivitySubscriptions(req) {
    const { actorDid, cursor, limit } = req

    let builder = db.db
      .selectFrom('private_data')
      .selectAll()
      .where('actorDid', '=', actorDid)
      .where(
        'namespace',
        '=',
        'app.bsky.notification.defs#subjectActivitySubscription',
      )
      .orderBy('indexedAt', 'desc')

    const { ref } = db.db.dynamic
    const key = new IndexedAtKeyKeyset(
      ref('private_data.indexedAt'),
      ref('private_data.key'),
    )
    builder = key.paginate(builder, {
      cursor,
      limit,
    })
    const res = await builder.execute()

    const dids = res.map((row) => {
      const p: SubjectActivitySubscription = JSON.parse(row.payload)
      return p.subject
    })

    return {
      dids,
    }
  },

  async getNotificationPreferences(req) {
    const { dids } = req
    if (dids.length === 0) {
      return { preferences: [] }
    }

    const res = await db.db
      .selectFrom('private_data')
      .selectAll()
      .where('actorDid', 'in', dids)
      .where('namespace', '=', 'app.bsky.notification.defs#preferences')
      .where('key', '=', 'self')
      .execute()

    const byDid = keyBy(res, 'actorDid')
    const preferences = dids.map((did) => {
      const row = byDid.get(did)
      if (!row) {
        return {}
      }
      const p: Preferences = JSON.parse(row.payload)
      return notificationPreferencesLexToProtobuf(p, row.payload)
    })

    return { preferences }
  },
})

export const notificationPreferencesLexToProtobuf = (
  p: Preferences,
  json: string,
): NotificationPreferences => {
  const lexChatPreferenceToProtobuf = (
    p: ChatPreference,
  ): ChatNotificationPreference =>
    new ChatNotificationPreference({
      include:
        p.include === 'accepted'
          ? ChatNotificationInclude.ACCEPTED
          : ChatNotificationInclude.ALL,
      push: { enabled: p.push ?? true },
    })

  const lexFilterablePreferenceToProtobuf = (
    p: FilterablePreference,
  ): FilterableNotificationPreference =>
    new FilterableNotificationPreference({
      include:
        p.include === 'follows'
          ? NotificationInclude.FOLLOWS
          : NotificationInclude.ALL,
      list: { enabled: p.list ?? true },
      push: { enabled: p.push ?? true },
    })

  const lexPreferenceToProtobuf = (p: Preference): NotificationPreference =>
    new NotificationPreference({
      list: { enabled: p.list ?? true },
      push: { enabled: p.push ?? true },
    })

  return new NotificationPreferences({
    entry: Buffer.from(json),
    chat: lexChatPreferenceToProtobuf(p.chat),
    follow: lexFilterablePreferenceToProtobuf(p.follow),
    like: lexFilterablePreferenceToProtobuf(p.like),
    likeViaRepost: lexFilterablePreferenceToProtobuf(p.likeViaRepost),
    mention: lexFilterablePreferenceToProtobuf(p.mention),
    quote: lexFilterablePreferenceToProtobuf(p.quote),
    reply: lexFilterablePreferenceToProtobuf(p.reply),
    repost: lexFilterablePreferenceToProtobuf(p.repost),
    repostViaRepost: lexFilterablePreferenceToProtobuf(p.repostViaRepost),
    starterpackJoined: lexPreferenceToProtobuf(p.starterpackJoined),
    subscribedPost: lexPreferenceToProtobuf(p.subscribedPost),
    unverified: lexPreferenceToProtobuf(p.unverified),
    verified: lexPreferenceToProtobuf(p.verified),
  })
}
