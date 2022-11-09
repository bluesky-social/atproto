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

export type CreateNotification = {
  type: 'create_notification'
  userDid: string
  author: string
  recordUri: string
  recordCid: string
  reason: string
  reasonSubject?: string
}

export type NotificationReason =
  | 'vote'
  | 'repost'
  | 'trend'
  | 'follow'
  | 'invite'
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
