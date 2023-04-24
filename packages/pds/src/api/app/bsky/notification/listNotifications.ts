import { InvalidRequestError } from '@atproto/xrpc-server'
import * as common from '@atproto/common'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.listNotifications({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor, seenAt } = params
      const requester = auth.credentials.did
      const { ref } = ctx.db.db.dynamic
      if (seenAt) {
        throw new InvalidRequestError('The seenAt parameter is unsupported')
      }

      let notifBuilder = ctx.db.db
        .selectFrom('user_notification as notif')
        .innerJoin('ipld_block', (join) =>
          join
            .onRef('ipld_block.cid', '=', 'notif.recordCid')
            .onRef('ipld_block.creator', '=', 'notif.author'),
        )
        .innerJoin('did_handle as author', 'author.did', 'notif.author')
        .innerJoin(
          'repo_root as author_repo',
          'author_repo.did',
          'notif.author',
        )
        .innerJoin('record', 'record.uri', 'notif.recordUri')
        .where(notSoftDeletedClause(ref('author_repo')))
        .where(notSoftDeletedClause(ref('record')))
        .where('notif.userDid', '=', requester)
        .whereNotExists(
          ctx.db.db // Omit mentions and replies by muted actors
            .selectFrom('mute')
            .selectAll()
            .whereRef('did', '=', ref('notif.author'))
            .where('mutedByDid', '=', requester),
        )
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
          'notif.reason as reason',
          'notif.reasonSubject as reasonSubject',
          'notif.indexedAt as indexedAt',
          'ipld_block.content as recordBytes',
        ])

      const keyset = new NotifsKeyset(
        ref('notif.indexedAt'),
        ref('notif.recordCid'),
      )
      notifBuilder = paginate(notifBuilder, {
        cursor,
        limit,
        keyset,
      })

      const userStateQuery = ctx.db.db
        .selectFrom('user_state')
        .selectAll()
        .where('did', '=', requester)
        .executeTakeFirst()

      const [userState, notifs] = await Promise.all([
        userStateQuery,
        notifBuilder.execute(),
      ])

      if (!userState) {
        throw new InvalidRequestError(`Could not find user: ${requester}`)
      }

      // @NOTE calling into app-view, will eventually be replaced
      const actorService = ctx.services.appView.actor(ctx.db)
      const labelService = ctx.services.appView.label(ctx.db)
      const recordUris = notifs.map((notif) => notif.uri)
      const [authors, labels] = await Promise.all([
        actorService.views.profile(
          notifs.map((notif) => ({
            did: notif.authorDid,
            handle: notif.authorHandle,
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
        record: common.cborBytesToRecord(notif.recordBytes),
        isRead: notif.indexedAt <= userState.lastSeenNotifs,
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
