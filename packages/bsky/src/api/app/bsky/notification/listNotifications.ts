import { InvalidRequestError } from '@atproto/xrpc-server'
import { jsonStringToLex } from '@atproto/lexicon'
import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'
import { getSelfLabels } from '../../../../services/label'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.listNotifications({
    auth: ctx.authVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
      if (params.seenAt) {
        throw new InvalidRequestError('The seenAt parameter is unsupported')
      }

      const graphService = ctx.services.graph(ctx.db)

      const { ref } = ctx.db.db.dynamic
      let notifBuilder = ctx.db.db
        .selectFrom('notification as notif')
        .innerJoin('record', 'record.uri', 'notif.recordUri')
        .innerJoin('actor as author', 'author.did', 'notif.author')
        .where(notSoftDeletedClause(ref('record')))
        .where(notSoftDeletedClause(ref('author')))
        .where('notif.did', '=', requester)
        .where((qb) =>
          graphService.whereNotMuted(qb, requester, [ref('notif.author')]),
        )
        .whereNotExists(graphService.blockQb(requester, [ref('notif.author')]))
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

      const actorStateQuery = ctx.db.db
        .selectFrom('actor_state')
        .selectAll()
        .where('did', '=', requester)

      const [actorState, notifs] = await Promise.all([
        actorStateQuery.executeTakeFirst(),
        notifBuilder.execute(),
      ])

      const seenAt = actorState?.lastSeenNotifs

      const actorService = ctx.services.actor(ctx.db)
      const labelService = ctx.services.label(ctx.db)
      const recordUris = notifs.map((notif) => notif.uri)
      const [authors, labels] = await Promise.all([
        actorService.views.profiles(
          notifs.map((notif) => ({
            did: notif.authorDid,
            handle: notif.authorHandle,
            indexedAt: notif.authorIndexedAt,
            takedownId: notif.authorTakedownId,
          })),
          requester,
        ),
        labelService.getLabelsForUris(recordUris),
      ])

      const notifications = mapDefined(notifs, (notif) => {
        const author = authors[notif.authorDid]
        if (!author) return undefined
        const record = jsonStringToLex(notif.recordJson) as Record<
          string,
          unknown
        >
        const recordLabels = labels[notif.uri] ?? []
        const recordSelfLabels = getSelfLabels({
          uri: notif.uri,
          cid: notif.cid,
          record,
        })
        return {
          uri: notif.uri,
          cid: notif.cid,
          author,
          reason: notif.reason,
          reasonSubject: notif.reasonSubject || undefined,
          record,
          isRead: seenAt ? notif.indexedAt <= seenAt : false,
          indexedAt: notif.indexedAt,
          labels: [...recordLabels, ...recordSelfLabels],
        }
      })

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
