import { Entity, Column, PrimaryColumn, DataSource } from 'typeorm'
import { Notification } from '../types'

@Entity({ name: 'user_notifications' })
export class UserNotification {
  @PrimaryColumn('varchar')
  userDid: string

  @PrimaryColumn('vachar')
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

export const processNotifications = async (
  db: DataSource,
  notifs: Notification[],
) => {
  await db.getRepository(UserNotification).insert(
    notifs.map((notif) => ({
      ...notif,
      createdAt: new Date().toISOString(),
    })),
  )
}
