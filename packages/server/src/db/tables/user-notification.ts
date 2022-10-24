import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { Notification, NotificationsPlugin } from '../types'

export const tableName = 'user_notification'
export interface UserNotification {
  userDid: string
  recordUri: string
  recordCid: string
  author: string
  reason: string
  reasonSubject: string | null
  indexedAt: string
}

export type PartialDB = { [tableName]: UserNotification }

export const process =
  (db: Kysely<PartialDB>) => async (notifs: Notification[]) => {
    if (notifs.length === 0) return
    const vals = notifs.map((notif) => ({
      ...notif,
      indexedAt: new Date().toISOString(),
    }))
    await db.insertInto('user_notification').values(vals).execute()
  }

export const deleteForRecord =
  (db: Kysely<PartialDB>) => async (uri: AtUri) => {
    await db
      .deleteFrom('user_notification')
      .where('recordUri', '=', uri.toString())
  }

export default (db: Kysely<PartialDB>): NotificationsPlugin => ({
  process: process(db),
  deleteForRecord: deleteForRecord(db),
})
