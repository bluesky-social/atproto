import { AdxUri } from '@adxp/common'
import { Entity, Column, PrimaryColumn, DataSource } from 'typeorm'
import { Notification, NotificationsPlugin } from './types'
import { User } from './user'

@Entity({ name: 'user_notifications' })
export class UserNotification {
  @PrimaryColumn('varchar')
  userDid: string

  @PrimaryColumn('varchar')
  recordUri: string

  @Column('varchar')
  author: string

  @Column('varchar')
  reason: string

  @Column({ type: 'varchar', nullable: true })
  reasonSubject?: string

  @Column('varchar')
  createdAt: string
}

export const process = (db: DataSource) => async (notifs: Notification[]) => {
  await db.getRepository(UserNotification).insert(
    notifs.map((notif) => ({
      ...notif,
      createdAt: new Date().toISOString(),
    })),
  )
}

export const deleteForRecord = (db: DataSource) => async (uri: AdxUri) => {
  await db.getRepository(UserNotification).delete({ recordUri: uri.toString() })
}

export default (db: DataSource): NotificationsPlugin => ({
  process: process(db),
  deleteForRecord: deleteForRecord(db),
})
