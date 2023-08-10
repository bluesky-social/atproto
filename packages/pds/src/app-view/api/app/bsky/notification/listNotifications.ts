import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as common from '@atproto/common'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause, valuesList } from '../../../../../db/util'
import { getSelfLabels } from '../../../../services/label'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.listNotifications({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (ctx.canProxyRead(req)) {
        const res =
          await ctx.appviewAgent.api.app.bsky.notification.listNotifications(
            params,
            await ctx.serviceAuthHeaders(requester),
          )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { limit, cursor, seenAt } = params
      const { ref } = ctx.db.db.dynamic
      if (seenAt) {
        throw new InvalidRequestError('The seenAt parameter is unsupported')
      }

      const accountService = ctx.services.account(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)

      let notifBuilder = ctx.db.db
        .selectFrom('user_notification as notif')
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
        .where((qb) =>
          accountService.whereNotMuted(qb, requester, [ref('notif.author')]),
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
          'notif.reason as reason',
          'notif.reasonSubject as reasonSubject',
          'notif.indexedAt as indexedAt',
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

      const recordTuples = notifs.map((notif) => {
        return sql`${notif.authorDid}, ${notif.cid}`
      })

      const emptyBlocksResult: { cid: string; bytes: Uint8Array }[] = []
      const blocksQb = recordTuples.length
        ? ctx.db.db
            .selectFrom('ipld_block')
            .whereRef(sql`(creator, cid)`, 'in', valuesList(recordTuples))
            .select(['cid', 'content as bytes'])
        : null

      const actorService = ctx.services.appView.actor(ctx.db)

      // @NOTE calling into app-view, will eventually be replaced
      const labelService = ctx.services.appView.label(ctx.db)
      const recordUris = notifs.map((notif) => notif.uri)
      const [blocks, authors, labels] = await Promise.all([
        blocksQb ? blocksQb.execute() : emptyBlocksResult,
        actorService.views.profiles(
          notifs.map((notif) => ({
            did: notif.authorDid,
            handle: notif.authorHandle,
          })),
          requester,
        ),
        labelService.getLabelsForUris(recordUris),
      ])

      const bytesByCid = blocks.reduce((acc, block) => {
        acc[block.cid] = block.bytes
        return acc
      }, {} as Record<string, Uint8Array>)

      const notifications = common.mapDefined(notifs, (notif) => {
        const bytes = bytesByCid[notif.cid]
        const author = authors[notif.authorDid]
        if (!bytes || !author) return undefined
        const record = common.cborBytesToRecord(bytes)
        const recordLabels = labels[notif.uri] ?? []
        const recordSelfLabels = getSelfLabels({
          uri: notif.uri,
          cid: notif.cid,
          record,
        })
        return {
          uri: notif.uri,
          cid: notif.cid,
          author: authors[notif.authorDid],
          reason: notif.reason,
          reasonSubject: notif.reasonSubject || undefined,
          record,
          isRead: notif.indexedAt <= userState.lastSeenNotifs,
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
