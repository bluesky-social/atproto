import Database from '../../db'
import { CreateNotification } from '../messages'
import { Consumer } from '../types'

export default class extends Consumer<CreateNotification> {
  async dispatch(ctx: { db: Database; message: CreateNotification }) {
    const { db, message } = ctx
    await db.db
      .insertInto('user_notification')
      .values({
        userDid: message.userDid,
        recordUri: message.recordUri,
        recordCid: message.recordCid,
        author: message.author,
        reason: message.reason,
        reasonSubject: message.reasonSubject,
        indexedAt: new Date().toISOString(),
      })
      .returningAll()
      .execute()
  }
}
