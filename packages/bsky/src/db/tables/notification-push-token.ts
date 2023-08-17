export const tableName = 'notification_push_token'

export interface NotificationPushToken {
  did: string
  platform: 'ios' | 'android' | 'web'
  token: string
  appId: string
}

export type PartialDB = { [tableName]: NotificationPushToken }
