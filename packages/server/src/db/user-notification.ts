import { Kysely } from 'kysely'
import { AdxUri } from '@adxp/uri'
import { Notification, NotificationsPlugin } from './types'

export const tableName = 'user_notification'
export interface UserNotification {
  userDid: string
  recordUri: string
  author: string
  reason: string
  reasonSubject?: string
  indexedAt: string
}

export type PartialDB = { [tableName]: UserNotification }

export const process =
  (db: Kysely<PartialDB>) => async (notifs: Notification[]) => {
    const vals = notifs.map((notif) => ({
      ...notif,
      indexedAt: new Date().toISOString(),
    }))
    await db.insertInto('user_notification').values(vals).execute()
  }

export const deleteForRecord =
  (db: Kysely<PartialDB>) => async (uri: AdxUri) => {
    await db
      .deleteFrom('user_notification')
      .where('recordUri', '=', uri.toString())
  }

export default (db: Kysely<PartialDB>): NotificationsPlugin => ({
  process: process(db),
  deleteForRecord: deleteForRecord(db),
})
