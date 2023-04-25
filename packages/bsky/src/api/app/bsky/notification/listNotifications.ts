import { jsonStringToLex } from '@atproto/lexicon'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'
import { authVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.listNotifications({
    auth: authVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
      const { seenAt } = params

      const { ref } = ctx.db.db.dynamic
      let notifBuilder = ctx.db.db
        .selectFrom('notification as notif')
        .innerJoin('record', 'record.uri', 'notif.recordUri')
        .innerJoin('actor as author', 'author.did', 'notif.author')
        .where(notSoftDeletedClause(ref('record')))
        .where(notSoftDeletedClause(ref('author')))
        .where('notif.did', '=', requester)
        .where((clause) =>
          clause
            .where('reasonSubject', 'is', null)
            .orWhereExists(
              ctx.db.db
                .selectFrom('record as subject')
                .selectAll()
                .whereRef('subject.uri', '=', ref('notif.reasonSubject')),
            ),
        )
        .select([
          'notif.recordUri as uri',
          'notif.recordCid as cid',
          'author.did as authorDid',
          'author.handle as authorHandle',
          'author.indexedAt as authorIndexedAt',
          'author.takedownId as authorTakedownId',
          'notif.reason as reason',
          'notif.reasonSubject as reasonSubject',
          'notif.sortAt as indexedAt',
          'record.json as recordJson',
        ])

      const keyset = new NotifsKeyset(
        ref('notif.sortAt'),
        ref('notif.recordCid'),
      )
      notifBuilder = paginate(notifBuilder, {
        cursor,
        limit,
        keyset,
      })

      const notifs = await notifBuilder.execute()

      const actorService = ctx.services.actor(ctx.db)
      const labelService = ctx.services.label(ctx.db)
      const recordUris = notifs.map((notif) => notif.uri)
      const [authors, labels] = await Promise.all([
        actorService.views.profile(
          notifs.map((notif) => ({
            did: notif.authorDid,
            handle: notif.authorHandle,
            indexedAt: notif.authorIndexedAt,
            takedownId: notif.authorTakedownId,
          })),
          requester,
        ),
        labelService.getLabelsForSubjects(recordUris),
      ])

      const notifications = notifs.map((notif, i) => ({
        uri: notif.uri,
        cid: notif.cid,
        author: authors[i],
        reason: notif.reason,
        reasonSubject: notif.reasonSubject || undefined,
        record: jsonStringToLex(notif.recordJson) as Record<string, unknown>,
        isRead: seenAt ? notif.indexedAt <= seenAt : false,
        indexedAt: notif.indexedAt,
        labels: labels[notif.uri] ?? [],
      }))

      return {
        encoding: 'application/json',
        body: {
          notifications,
          cursor: keyset.packFromResult(notifs),
        },
      }
    },
  })
}

type NotifRow = { indexedAt: string; cid: string }
class NotifsKeyset extends TimeCidKeyset<NotifRow> {
  labelResult(result: NotifRow) {
    return { primary: result.indexedAt, secondary: result.cid }
  }
}
