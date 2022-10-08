import { Server } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@adxp/xrpc-server'
import * as GetNotifications from '../../../lexicon/types/todo/social/getNotifications'
import { ProfileIndex } from '../../../db/records/profile'
import { User } from '../../../db/user'
import { AdxRecord } from '../../../db/record'
import * as locals from '../../../locals'
import { UserNotification } from '../../../db/user-notifications'

export default function (server: Server) {
  server.todo.social.getNotifications(
    async (params: GetNotifications.QueryParams, _input, req, res) => {
      const { limit, before } = params

      const { auth, db } = locals.get(res)
      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const notifBuilder = db.db
        .createQueryBuilder()
        .select([
          'notif.recordUri AS uri',
          'author.did AS authorDid',
          'author.username AS authorName',
          'author_profile.displayName AS authorDisplayName',
          'notif.reason AS reason',
          'notif.reasonSubject AS reasonSubject',
          'notif.createdAt AS createdAt',
          'record.raw AS record',
          'record.indexedAt AS indexedAt',
          'notif.recordUri AS uri',
        ])
        .from(UserNotification, 'notif')
        .leftJoin(AdxRecord, 'record', 'record.uri = notif.recordUri')
        .leftJoin(User, 'author', 'author.did = notif.author')
        .leftJoin(
          ProfileIndex,
          'author_profile',
          'author_profile.creator = author.did',
        )
        .orderBy('notif.createdAt', 'DESC')
        .where('notif.userDid = :requester', { requester })

      if (before) {
        notifBuilder.andWhere('notif.createdAt < :before', { before })
      }
      if (limit) {
        notifBuilder.limit(limit)
      }

      const [user, notifs] = await Promise.all([
        db.db.getRepository(User).findOneBy({ did: requester }),
        notifBuilder.getRawMany(),
      ])

      if (!user) {
        throw new InvalidRequestError(`Could not find user: ${user}`)
      }

      const notifications = notifs.map((notif) => ({
        uri: notif.uri,
        author: {
          did: notif.authorDid,
          name: notif.authorName,
          displayName: notif.authorDisplayName || undefined,
        },
        reason: notif.reason,
        reasonSubject: notif.reasonSubject || undefined,
        record: JSON.parse(notif.record),
        isRead: notif.createdAt <= user.lastSeenNotifs,
        indexedAt: notif.indexedAt,
        // @TODO do we need createdAt so that it can be used as a cursor?
      }))
      return {
        encoding: 'application/json',
        body: { notifications },
      }
    },
  )
}
