import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as common from '@atproto/common'
import { Server } from '../../../../lexicon'
import * as List from '../../../../lexicon/types/app/bsky/notification/list'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.notification.list(
    async (params: List.QueryParams, _input, req, res) => {
      const { auth, db } = locals.get(res)
      const { limit, before } = params
      const { ref } = db.db.dynamic

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      let notifBuilder = db.db
        .selectFrom('user_notification as notif')
        .where('notif.userDid', '=', requester)
        .innerJoin('ipld_block', 'ipld_block.cid', 'notif.recordCid')
        .innerJoin('did_handle as author', 'author.did', 'notif.author')
        .leftJoin(
          'profile as author_profile',
          'author_profile.creator',
          'author.did',
        )
        .select([
          'notif.recordUri as uri',
          'notif.recordCid as cid',
          'author.did as authorDid',
          'author.handle as authorHandle',
          'author_profile.displayName as authorDisplayName',
          'notif.reason as reason',
          'notif.reasonSubject as reasonSubject',
          'notif.indexedAt as createdAt',
          'ipld_block.content as recordBytes',
          'ipld_block.indexedAt as indexedAt',
          'notif.recordUri as uri',
        ])

      notifBuilder = paginate(notifBuilder, {
        before,
        limit,
        by: ref('notif.indexedAt'),
      })

      const [user, notifs] = await Promise.all([
        db.db
          .selectFrom('user')
          .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
          .selectAll()
          .where('did', '=', requester)
          .executeTakeFirst(),
        notifBuilder.execute(),
      ])

      if (!user) {
        throw new InvalidRequestError(`Could not find user: ${requester}`)
      }

      const notifications = notifs.map((notif) => ({
        uri: notif.uri,
        cid: notif.cid,
        author: {
          did: notif.authorDid,
          handle: notif.authorHandle,
          displayName: notif.authorDisplayName || undefined,
        },
        reason: notif.reason,
        reasonSubject: notif.reasonSubject || undefined,
        record: common.ipldBytesToRecord(notif.recordBytes),
        isRead: notif.createdAt <= user.lastSeenNotifs,
        indexedAt: notif.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          notifications,
          cursor: notifications.at(-1)?.indexedAt,
        },
      }
    },
  )
}
