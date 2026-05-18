/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.moderation.subscribeModEvents'

/** Fired when the first message was sent on a convo. */
export interface EventConvoFirstMessage {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventConvoFirstMessage'
  convoId: string
  createdAt: string
  messageId?: string
  /** The list of DIDs message recipients. Does not include the sender, which is in the `user` field */
  recipients: string[]
  rev: string
  /** The DID of the message author. */
  user: string
}

const hashEventConvoFirstMessage = 'eventConvoFirstMessage'

export function isEventConvoFirstMessage<V>(v: V) {
  return is$typed(v, id, hashEventConvoFirstMessage)
}

export function validateEventConvoFirstMessage<V>(v: V) {
  return validate<EventConvoFirstMessage & V>(v, id, hashEventConvoFirstMessage)
}

/** Fire when a group chat is created. */
export interface EventGroupChatCreated {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventGroupChatCreated'
  /** The DID of the actor performing the action. For this event, same as ownerDid. */
  actorDid: string
  /** When the group was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. */
  groupMemberCount: number
  /** The name set at creation time. */
  groupName: string
  /** DIDs of everyone added at creation time. */
  initialMemberDids: string[]
  /** The DID of the group chat owner. */
  ownerDid: string
  rev: string
}

const hashEventGroupChatCreated = 'eventGroupChatCreated'

export function isEventGroupChatCreated<V>(v: V) {
  return is$typed(v, id, hashEventGroupChatCreated)
}

export function validateEventGroupChatCreated<V>(v: V) {
  return validate<EventGroupChatCreated & V>(v, id, hashEventGroupChatCreated)
}

/** Fired when a member is added to a group chat. Note that members are added in the 'request' state. */
export interface EventGroupChatMemberAdded {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventGroupChatMemberAdded'
  /** The DID of the actor performing the action. For this event, same as ownerDid. */
  actorDid: string
  /** When the group was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. */
  groupMemberCount: number
  groupName: string
  /** The DID of the group chat owner. */
  ownerDid: string
  /** The number of members who have not yet accepted the convo. */
  requestMembersCount: number
  rev: string
  /** The DID of the member who was added. */
  subjectDid: string
  /** Whether the added member follows the group owner. */
  subjectFollowsOwner: boolean
}

const hashEventGroupChatMemberAdded = 'eventGroupChatMemberAdded'

export function isEventGroupChatMemberAdded<V>(v: V) {
  return is$typed(v, id, hashEventGroupChatMemberAdded)
}

export function validateEventGroupChatMemberAdded<V>(v: V) {
  return validate<EventGroupChatMemberAdded & V>(
    v,
    id,
    hashEventGroupChatMemberAdded,
  )
}

/** Fired when a member joins a group chat via an join link that does not require approval. */
export interface EventGroupChatMemberJoined {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventGroupChatMemberJoined'
  /** The DID of the person joining. */
  actorDid: string
  /** When the group was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. */
  groupMemberCount: number
  groupName: string
  /** The code of the join link used to join. */
  joinLinkCode: string
  /** The DID of the group chat owner. */
  ownerDid: string
  rev: string
  /** Whether the joining member follows the group owner. */
  subjectFollowsOwner: boolean
}

const hashEventGroupChatMemberJoined = 'eventGroupChatMemberJoined'

export function isEventGroupChatMemberJoined<V>(v: V) {
  return is$typed(v, id, hashEventGroupChatMemberJoined)
}

export function validateEventGroupChatMemberJoined<V>(v: V) {
  return validate<EventGroupChatMemberJoined & V>(
    v,
    id,
    hashEventGroupChatMemberJoined,
  )
}

/** Fired when a user requests to join a group chat via an join link that requires approval. */
export interface EventGroupChatJoinRequest {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventGroupChatJoinRequest'
  /** The DID of the person requesting to join. */
  actorDid: string
  /** When the group was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. */
  groupMemberCount: number
  groupName: string
  /** The code of the join link used to request joining. */
  joinLinkCode: string
  /** The DID of the group chat owner. */
  ownerDid: string
  rev: string
  /** Whether the requesting member follows the group owner. */
  subjectFollowsOwner: boolean
}

const hashEventGroupChatJoinRequest = 'eventGroupChatJoinRequest'

export function isEventGroupChatJoinRequest<V>(v: V) {
  return is$typed(v, id, hashEventGroupChatJoinRequest)
}

export function validateEventGroupChatJoinRequest<V>(v: V) {
  return validate<EventGroupChatJoinRequest & V>(
    v,
    id,
    hashEventGroupChatJoinRequest,
  )
}

/** Fired when a join request is approved by the group owner. */
export interface EventGroupChatJoinRequestApproved {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventGroupChatJoinRequestApproved'
  /** The DID of the owner approving the request. */
  actorDid: string
  /** When the group was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. */
  groupMemberCount: number
  groupName: string
  /** The DID of the group chat owner. */
  ownerDid: string
  rev: string
  /** The DID of the member whose request was approved. */
  subjectDid: string
}

const hashEventGroupChatJoinRequestApproved =
  'eventGroupChatJoinRequestApproved'

export function isEventGroupChatJoinRequestApproved<V>(v: V) {
  return is$typed(v, id, hashEventGroupChatJoinRequestApproved)
}

export function validateEventGroupChatJoinRequestApproved<V>(v: V) {
  return validate<EventGroupChatJoinRequestApproved & V>(
    v,
    id,
    hashEventGroupChatJoinRequestApproved,
  )
}

/** Fired when a join request is rejected by the group owner. */
export interface EventGroupChatJoinRequestRejected {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventGroupChatJoinRequestRejected'
  /** The DID of the owner rejecting the request. */
  actorDid: string
  /** When the group was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. */
  groupMemberCount: number
  groupName: string
  /** The DID of the group chat owner. */
  ownerDid: string
  rev: string
  /** The DID of the member whose request was rejected. */
  subjectDid: string
}

const hashEventGroupChatJoinRequestRejected =
  'eventGroupChatJoinRequestRejected'

export function isEventGroupChatJoinRequestRejected<V>(v: V) {
  return is$typed(v, id, hashEventGroupChatJoinRequestRejected)
}

export function validateEventGroupChatJoinRequestRejected<V>(v: V) {
  return validate<EventGroupChatJoinRequestRejected & V>(
    v,
    id,
    hashEventGroupChatJoinRequestRejected,
  )
}

/** Fired when a user accepts a chat convo, either explicitly or by sending a message. */
export interface EventChatAccepted {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventChatAccepted'
  /** The DID of the person accepting the convo. */
  actorDid: string
  /** When the convo was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. Only present for group convos. */
  groupMemberCount?: number
  /** The name of the group chat. Only present for group convos. */
  groupName?: string
  /** How the convo was accepted. */
  method: 'explicit' | 'message' | (string & {})
  /** The DID of the group chat owner. Only present for group convos. */
  ownerDid?: string
  rev: string
}

const hashEventChatAccepted = 'eventChatAccepted'

export function isEventChatAccepted<V>(v: V) {
  return is$typed(v, id, hashEventChatAccepted)
}

export function validateEventChatAccepted<V>(v: V) {
  return validate<EventChatAccepted & V>(v, id, hashEventChatAccepted)
}

/** Fired when a member leaves or is removed from a group chat. */
export interface EventGroupChatMemberLeft {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventGroupChatMemberLeft'
  /** The DID of the actor. For voluntary: the person leaving. For kicked: the owner. */
  actorDid: string
  /** When the group was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. */
  groupMemberCount: number
  groupName: string
  /** How the member left. */
  leaveMethod: 'voluntary' | 'kicked' | (string & {})
  /** The DID of the group chat owner. */
  ownerDid: string
  rev: string
  /** The DID of the member who left or was removed. */
  subjectDid: string
}

const hashEventGroupChatMemberLeft = 'eventGroupChatMemberLeft'

export function isEventGroupChatMemberLeft<V>(v: V) {
  return is$typed(v, id, hashEventGroupChatMemberLeft)
}

export function validateEventGroupChatMemberLeft<V>(v: V) {
  return validate<EventGroupChatMemberLeft & V>(
    v,
    id,
    hashEventGroupChatMemberLeft,
  )
}

/** Fired when a group chat's metadata or status changes. */
export interface EventGroupChatUpdated {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventGroupChatUpdated'
  /** The DID of the actor performing the action (the owner). */
  actorDid: string
  /** When the group was originally created. */
  convoCreatedAt: string
  convoId: string
  createdAt: string
  /** Current member count at the time of the event. */
  groupMemberCount: number
  /** Current group name. */
  groupName: string
  /** The code of the join link. Only present when updateType is join-link-related. */
  joinLinkCode?: string
  /** Whether the join link is restricted to followers of the owner. Only present when updateType is join-link-related. */
  joinLinkFollowersOnly?: boolean
  /** Whether the join link requires owner approval to join. Only present when updateType is join-link-related. */
  joinLinkRequiresApproval?: boolean
  /** Why the group was locked. Only present when updateType is 'locked'. */
  lockReason?:
    | 'owner_action'
    | 'owner_left'
    | 'owner_deactivated'
    | 'owner_deleted'
    | 'owner_taken_down'
    | 'label_applied'
    | (string & {})
  /** The new group name. Only present when updateType is 'name_changed'. */
  newName?: string
  /** The previous group name. Only present when updateType is 'name_changed'. */
  oldName?: string
  /** The DID of the group chat owner. */
  ownerDid: string
  rev: string
  /** What changed. */
  updateType:
    | 'name_changed'
    | 'locked'
    | 'locked_permanently'
    | 'unlocked'
    | 'join_link_created'
    | 'join_link_disabled'
    | 'join_link_settings_changed'
    | (string & {})
}

const hashEventGroupChatUpdated = 'eventGroupChatUpdated'

export function isEventGroupChatUpdated<V>(v: V) {
  return is$typed(v, id, hashEventGroupChatUpdated)
}

export function validateEventGroupChatUpdated<V>(v: V) {
  return validate<EventGroupChatUpdated & V>(v, id, hashEventGroupChatUpdated)
}
