import { AdxUri } from '@adxp/common'
import { Entity, Column, PrimaryColumn } from 'typeorm'
import * as post from '../records/post'

@Entity({ name: 'user_notifications' })
export class UserNotification {
  @PrimaryColumn('varchar')
  userDid: string

  @PrimaryColumn('vachar')
  recordUri: string

  @Column('varchar')
  reason: string

  @Column('varchar')
  reasonSubject: string

  @Column('varchar')
  createdAt: string
}

export const processRecordNotifications = async (uri: AdxUri, obj: unknown) => {
  if (post.isValidSchema(obj)) {
  } else if(post.)
}
