import AppContext from '../../context'
import Database from '../../db'
import { LabelPost } from '../messages'
import { Consumer } from '../types'

export const listen = (ctx: AppContext) => {
  ctx.messageQueue.listen('label_post', new LabelPostConsumer())
}

class LabelPostConsumer extends Consumer<LabelPost> {
  async dispatch(ctx: { db: Database; message: LabelPost }) {
    // @TODO generate labels
    // const { db, message } = ctx
    // await db.db
    //   .insertInto('user_notification')
    //   .values({
    //     userDid: message.userDid,
    //     recordUri: message.recordUri,
    //     recordCid: message.recordCid,
    //     author: message.author,
    //     reason: message.reason,
    //     reasonSubject: message.reasonSubject,
    //     indexedAt: new Date().toISOString(),
    //   })
    //   .returningAll()
    //   .execute()
  }
}
