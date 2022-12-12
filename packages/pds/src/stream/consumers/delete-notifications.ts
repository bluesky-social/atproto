import Database from '../../db'
import { DeleteNotifications } from '../messages'
import { Consumer } from '../types'

export default class extends Consumer<DeleteNotifications> {
  async dispatch(ctx: { db: Database; message: DeleteNotifications }) {
    const { db, message } = ctx
    await db.db
      .deleteFrom('user_notification')
      .where('recordUri', '=', message.recordUri)
      .execute()
  }
}
