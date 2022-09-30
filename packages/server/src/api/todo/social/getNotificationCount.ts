import { Server } from '../../../lexicon'
import { AuthRequiredError } from '@adxp/xrpc-server'
import * as GetNotificationCount from '../../../lexicon/types/todo/social/getNotificationCount'
import { User } from '../../../db/user'
import { getLocals } from '../../../util'
import { UserNotification } from '../../../db/user-notifications'

export default function (server: Server) {
  server.todo.social.getNotificationCount(
    async (params: GetNotificationCount.QueryParams, _input, req, res) => {
      const { auth, db } = getLocals(res)
      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const result = await db.db
        .createQueryBuilder()
        .select('COUNT(*) as count')
        .from(User, 'user')
        .leftJoin(UserNotification, 'notif', 'notif.userDid = user.did')
        .where('user.did = :requester', { requester })
        .andWhere('notif.createdAt > user.lastSeenNotifs')
        .getRawOne()

      const count = result?.count || 0

      return {
        encoding: 'application/json',
        body: { count },
      }
    },
  )
}
