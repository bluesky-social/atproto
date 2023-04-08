import { chunkArray } from '@atproto/common'
import Database from '../../db'
import { NotificationEvt } from './types'

export class NotificationService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new NotificationService(db)
  }

  async process(events: NotificationEvt[]) {
    const chunks = chunkArray(events, 100)
    for (const chunk of chunks) {
      await Promise.all(chunk.map((event) => this.processEvent(event)))
    }
  }

  private async processEvent(event: NotificationEvt) {
    if (event.type === 'create_notification') {
      await this.db.db
        .insertInto('notification')
        .values({
          did: event.did,
          recordUri: event.recordUri,
          recordCid: event.recordCid,
          author: event.author,
          reason: event.reason,
          reasonSubject: event.reasonSubject,
          sortAt: new Date().toISOString(),
        })
        .returningAll()
        .execute()
    } else if (event.type === 'delete_notifications') {
      await this.db.db
        .deleteFrom('notification')
        .where('recordUri', '=', event.recordUri)
        .execute()
    } else {
      const exhaustiveCheck: never = event['type']
      throw new Error(`Unhandled case: ${exhaustiveCheck}`)
    }
  }
}
