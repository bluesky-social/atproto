export type AddMember = {
  type: 'add_member'
  scene: string
  member: string
}

export type RemoveMember = {
  type: 'remove_member'
  scene: string
  member: string
}

export type AddUpvote = {
  type: 'add_upvote'
  user: string
  subject: string
}

export type RemoveUpvote = {
  type: 'remove_upvote'
  user: string
  subject: string
}

export type CreateNotification = NotificationInfo & {
  type: 'create_notification'
}

export type NotificationInfo = {
  userDid: string
  author: string
  recordUri: string
  recordCid: string
  reason: NotificationReason
  reasonSubject?: string
}

export type NotificationReason =
  | 'vote'
  | 'assertion'
  | 'repost'
  | 'trend'
  | 'follow'
  | 'invite'
  | 'mention'
  | 'reply'

export type DeleteNotifications = {
  type: 'delete_notifications'
  recordUri: string
}

export type Message =
  | AddMember
  | RemoveMember
  | AddUpvote
  | RemoveUpvote
  | CreateNotification
  | DeleteNotifications

export const addMember = (scene: string, member: string): AddMember => ({
  type: 'add_member',
  scene,
  member,
})

export const removeMember = (scene: string, member: string): RemoveMember => ({
  type: 'remove_member',
  scene,
  member,
})

export const addUpvote = (user: string, subject: string): AddUpvote => ({
  type: 'add_upvote',
  user,
  subject,
})

export const removeUpvote = (user: string, subject: string): RemoveUpvote => ({
  type: 'remove_upvote',
  user,
  subject,
})

export const createNotification = (
  notif: NotificationInfo,
): CreateNotification => ({
  type: 'create_notification',
  ...notif,
})

export const deleteNotifications = (
  recordUri: string,
): DeleteNotifications => ({
  type: 'delete_notifications',
  recordUri,
})
