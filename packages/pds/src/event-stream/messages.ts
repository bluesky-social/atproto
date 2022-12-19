import { isMessageOfType, MessageOfType } from './types'

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

export type SceneVotesOnPostTableUpdates = {
  type: 'scene_votes_on_post__table_updates'
  dids: string[]
  subject: string
}

export type Message =
  | AddMember
  | RemoveMember
  | AddUpvote
  | RemoveUpvote
  | CreateNotification
  | DeleteNotifications
  | SceneVotesOnPostTableUpdates

export const addMember = (scene: string, member: string): AddMember => ({
  type: 'add_member',
  scene,
  member,
})

export const isAddMember = (msg: MessageOfType): msg is AddMember =>
  isMessageOfType(msg, 'add_member')

export const removeMember = (scene: string, member: string): RemoveMember => ({
  type: 'remove_member',
  scene,
  member,
})

export const isRemoveMember = (msg: MessageOfType): msg is RemoveMember =>
  isMessageOfType(msg, 'remove_member')

export const addUpvote = (user: string, subject: string): AddUpvote => ({
  type: 'add_upvote',
  user,
  subject,
})

export const isAddUpvote = (msg: MessageOfType): msg is AddUpvote =>
  isMessageOfType(msg, 'add_upvote')

export const removeUpvote = (user: string, subject: string): RemoveUpvote => ({
  type: 'remove_upvote',
  user,
  subject,
})

export const isRemoveUpvote = (msg: MessageOfType): msg is RemoveUpvote =>
  isMessageOfType(msg, 'remove_upvote')

export const createNotification = (
  notif: NotificationInfo,
): CreateNotification => ({
  type: 'create_notification',
  ...notif,
})

export const isCreateNotification = (
  msg: MessageOfType,
): msg is CreateNotification => isMessageOfType(msg, 'create_notification')

export const deleteNotifications = (
  recordUri: string,
): DeleteNotifications => ({
  type: 'delete_notifications',
  recordUri,
})

export const isDeleteNotifications = (
  msg: MessageOfType,
): msg is DeleteNotifications => isMessageOfType(msg, 'delete_notifications')

export const sceneVotesOnPostTableUpdates = (
  dids: string[],
  subject: string,
): SceneVotesOnPostTableUpdates => ({
  type: 'scene_votes_on_post__table_updates',
  dids,
  subject,
})

export const isSceneVotesOnPostTableUpdates = (
  msg: MessageOfType,
): msg is SceneVotesOnPostTableUpdates =>
  isMessageOfType(msg, 'scene_votes_on_post__table_updates')
