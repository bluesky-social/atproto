export interface DatabaseSchema {
  user: User
  repo_root: RepoRoot
  record: Record
  user_notification: UserNotification
  invite_code: InviteCode
  invite_code_use: InviteCodeUse
  todo_social_post: TodoSocialPost
  todo_social_post_entity: TodoSocialPostEntity
  todo_social_like: TodoSocialLike
  todo_social_repost: TodoSocialRepost
  todo_social_follow: TodoSocialFollow
  todo_social_profile: TodoSocialProfile
  todo_social_profile_badge: TodoSocialProfileBadge
  todo_social_badge: TodoSocialBadge
}

export interface User {
  did: string
  username: string
  email: string
  lastSeenNotifs: string
  createdAt: string
}

export interface RepoRoot {
  did: string
  root: string
  indexedAt: string
}

export interface Record {
  uri: string
  did: string
  collection: string
  recordKey: string
  raw: string
  receivedAt: string
  indexedAt: string
}

export interface UserNotification {
  userDid: string
  recordUri: string
  author: string
  reason: string
  reasonSubject?: string
  indexedAt: string
}

export interface InviteCode {
  code: string
  availableUses: number
  disabled: 0 | 1
  forUser: string
  createdBy: string
}

export interface InviteCodeUse {
  code: string
  usedBy: string
  usedAt: string
}

export interface TodoSocialPost {
  uri: string
  creator: string
  text: string
  replyRoot?: string
  replyParent?: string
  createdAt: string
  indexedAt: string
}

export interface TodoSocialPostEntity {
  id: number
  postUri: string
  startIndex: number
  endIndex: number
  type: string
  value: string
}

export interface TodoSocialLike {
  uri: string
  creator: string
  subject: string
  createdAt: string
  indexedAt: string
}

export interface TodoSocialRepost {
  uri: string
  creator: string
  subject: string
  createdAt: string
  indexedAt: string
}

export interface TodoSocialFollow {
  uri: string
  creator: string
  subject: string
  createdAt: string
  indexedAt: string
}

export interface TodoSocialProfile {
  uri: string
  creator: string
  displayName: string
  description?: string
  indexedAt: string
}

export interface TodoSocialProfileBadge {
  profileUri: string
  badge: string
}

export interface TodoSocialBadge {
  uri: string
  creator: string
  subject: string
  assertionType: string
  assertionTag?: string
  createdAt: string
  indexedAt: string
}
