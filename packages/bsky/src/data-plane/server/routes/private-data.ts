import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { GetNotificationPreferencesResponse } from '../../../proto/bsky_pb'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getNotificationPreferences(req) {
    const { actorDid } = req
    const res = await db.db
      .selectFrom('private_data')
      .selectAll()
      .where('actorDid', '=', actorDid)
      .where('namespace', '=', 'app.bsky.notification.defs#preferences')
      .where('key', '=', 'self')
      .executeTakeFirst()
    if (!res) {
      throw new ConnectError(
        'Notification preferences not found',
        Code.NotFound,
      )
    }

    return JSON.parse(res.payload) as GetNotificationPreferencesResponse
  },
})
