/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBskyRichtextFacet from '../../../app/bsky/richtext/facet.js'
import type * as AppBskyEmbedRecord from '../../../app/bsky/embed/record.js'
import type * as ChatBskyActorDefs from '../actor/defs.js'
import type * as ChatBskyGroupDefs from '../group/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.convo.defs'

export type ConvoKind = 'direct' | 'group' | (string & {})
export type ConvoLockStatus =
  | 'unlocked'
  | 'locked'
  | 'locked-permanently'
  | (string & {})
export type ConvoStatus = 'request' | 'accepted' | (string & {})

export interface MessageRef {
  $type?: 'chat.bsky.convo.defs#messageRef'
  did: string
  convoId: string
  messageId: string
}

const hashMessageRef = 'messageRef'

export function isMessageRef<V>(v: V) {
  return is$typed(v, id, hashMessageRef)
}

export function validateMessageRef<V>(v: V) {
  return validate<MessageRef & V>(v, id, hashMessageRef)
}

export interface MessageInput {
  $type?: 'chat.bsky.convo.defs#messageInput'
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: $Typed<AppBskyEmbedRecord.Main> | { $type: string }
}

const hashMessageInput = 'messageInput'

export function isMessageInput<V>(v: V) {
  return is$typed(v, id, hashMessageInput)
}

export function validateMessageInput<V>(v: V) {
  return validate<MessageInput & V>(v, id, hashMessageInput)
}

export interface MessageView {
  $type?: 'chat.bsky.convo.defs#messageView'
  id: string
  rev: string
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: $Typed<AppBskyEmbedRecord.View> | { $type: string }
  /** Reactions to this message, in ascending order of creation time. */
  reactions?: ReactionView[]
  sender: MessageViewSender
  sentAt: string
}

const hashMessageView = 'messageView'

export function isMessageView<V>(v: V) {
  return is$typed(v, id, hashMessageView)
}

export function validateMessageView<V>(v: V) {
  return validate<MessageView & V>(v, id, hashMessageView)
}

export interface SystemMessageReferredUser {
  $type?: 'chat.bsky.convo.defs#systemMessageReferredUser'
  did: string
}

const hashSystemMessageReferredUser = 'systemMessageReferredUser'

export function isSystemMessageReferredUser<V>(v: V) {
  return is$typed(v, id, hashSystemMessageReferredUser)
}

export function validateSystemMessageReferredUser<V>(v: V) {
  return validate<SystemMessageReferredUser & V>(
    v,
    id,
    hashSystemMessageReferredUser,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. */
export interface SystemMessageView {
  $type?: 'chat.bsky.convo.defs#systemMessageView'
  id: string
  rev: string
  sentAt: string
  data:
    | $Typed<SystemMessageDataAddMember>
    | $Typed<SystemMessageDataRemoveMember>
    | $Typed<SystemMessageDataMemberJoin>
    | $Typed<SystemMessageDataMemberLeave>
    | $Typed<SystemMessageDataLockConvo>
    | $Typed<SystemMessageDataUnlockConvo>
    | $Typed<SystemMessageDataLockConvoPermanently>
    | $Typed<SystemMessageDataEditGroup>
    | $Typed<SystemMessageDataCreateJoinLink>
    | $Typed<SystemMessageDataEditJoinLink>
    | $Typed<SystemMessageDataEnableJoinLink>
    | $Typed<SystemMessageDataDisableJoinLink>
    | { $type: string }
}

const hashSystemMessageView = 'systemMessageView'

export function isSystemMessageView<V>(v: V) {
  return is$typed(v, id, hashSystemMessageView)
}

export function validateSystemMessageView<V>(v: V) {
  return validate<SystemMessageView & V>(v, id, hashSystemMessageView)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating a user was added to the group convo. */
export interface SystemMessageDataAddMember {
  $type?: 'chat.bsky.convo.defs#systemMessageDataAddMember'
  member: SystemMessageReferredUser
  role: ChatBskyActorDefs.MemberRole
  addedBy: SystemMessageReferredUser
}

const hashSystemMessageDataAddMember = 'systemMessageDataAddMember'

export function isSystemMessageDataAddMember<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataAddMember)
}

export function validateSystemMessageDataAddMember<V>(v: V) {
  return validate<SystemMessageDataAddMember & V>(
    v,
    id,
    hashSystemMessageDataAddMember,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating a user was removed from the group convo. */
export interface SystemMessageDataRemoveMember {
  $type?: 'chat.bsky.convo.defs#systemMessageDataRemoveMember'
  member: SystemMessageReferredUser
  removedBy: SystemMessageReferredUser
}

const hashSystemMessageDataRemoveMember = 'systemMessageDataRemoveMember'

export function isSystemMessageDataRemoveMember<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataRemoveMember)
}

export function validateSystemMessageDataRemoveMember<V>(v: V) {
  return validate<SystemMessageDataRemoveMember & V>(
    v,
    id,
    hashSystemMessageDataRemoveMember,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating a user joined the group convo via join link. */
export interface SystemMessageDataMemberJoin {
  $type?: 'chat.bsky.convo.defs#systemMessageDataMemberJoin'
  member: SystemMessageReferredUser
  role: ChatBskyActorDefs.MemberRole
  approvedBy?: SystemMessageReferredUser
}

const hashSystemMessageDataMemberJoin = 'systemMessageDataMemberJoin'

export function isSystemMessageDataMemberJoin<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataMemberJoin)
}

export function validateSystemMessageDataMemberJoin<V>(v: V) {
  return validate<SystemMessageDataMemberJoin & V>(
    v,
    id,
    hashSystemMessageDataMemberJoin,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating a user voluntarily left the group convo. */
export interface SystemMessageDataMemberLeave {
  $type?: 'chat.bsky.convo.defs#systemMessageDataMemberLeave'
  member: SystemMessageReferredUser
}

const hashSystemMessageDataMemberLeave = 'systemMessageDataMemberLeave'

export function isSystemMessageDataMemberLeave<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataMemberLeave)
}

export function validateSystemMessageDataMemberLeave<V>(v: V) {
  return validate<SystemMessageDataMemberLeave & V>(
    v,
    id,
    hashSystemMessageDataMemberLeave,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating the group convo was locked. */
export interface SystemMessageDataLockConvo {
  $type?: 'chat.bsky.convo.defs#systemMessageDataLockConvo'
  lockedBy: SystemMessageReferredUser
}

const hashSystemMessageDataLockConvo = 'systemMessageDataLockConvo'

export function isSystemMessageDataLockConvo<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataLockConvo)
}

export function validateSystemMessageDataLockConvo<V>(v: V) {
  return validate<SystemMessageDataLockConvo & V>(
    v,
    id,
    hashSystemMessageDataLockConvo,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating the group convo was unlocked. */
export interface SystemMessageDataUnlockConvo {
  $type?: 'chat.bsky.convo.defs#systemMessageDataUnlockConvo'
  unlockedBy: SystemMessageReferredUser
}

const hashSystemMessageDataUnlockConvo = 'systemMessageDataUnlockConvo'

export function isSystemMessageDataUnlockConvo<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataUnlockConvo)
}

export function validateSystemMessageDataUnlockConvo<V>(v: V) {
  return validate<SystemMessageDataUnlockConvo & V>(
    v,
    id,
    hashSystemMessageDataUnlockConvo,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating the group convo was locked permanently. */
export interface SystemMessageDataLockConvoPermanently {
  $type?: 'chat.bsky.convo.defs#systemMessageDataLockConvoPermanently'
  lockedBy: SystemMessageReferredUser
}

const hashSystemMessageDataLockConvoPermanently =
  'systemMessageDataLockConvoPermanently'

export function isSystemMessageDataLockConvoPermanently<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataLockConvoPermanently)
}

export function validateSystemMessageDataLockConvoPermanently<V>(v: V) {
  return validate<SystemMessageDataLockConvoPermanently & V>(
    v,
    id,
    hashSystemMessageDataLockConvoPermanently,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating the group info was edited. */
export interface SystemMessageDataEditGroup {
  $type?: 'chat.bsky.convo.defs#systemMessageDataEditGroup'
  /** Group name that was replaced. */
  oldName?: string
  /** Group name that replaced the old. */
  newName?: string
}

const hashSystemMessageDataEditGroup = 'systemMessageDataEditGroup'

export function isSystemMessageDataEditGroup<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataEditGroup)
}

export function validateSystemMessageDataEditGroup<V>(v: V) {
  return validate<SystemMessageDataEditGroup & V>(
    v,
    id,
    hashSystemMessageDataEditGroup,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating the group join link was created. */
export interface SystemMessageDataCreateJoinLink {
  $type?: 'chat.bsky.convo.defs#systemMessageDataCreateJoinLink'
}

const hashSystemMessageDataCreateJoinLink = 'systemMessageDataCreateJoinLink'

export function isSystemMessageDataCreateJoinLink<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataCreateJoinLink)
}

export function validateSystemMessageDataCreateJoinLink<V>(v: V) {
  return validate<SystemMessageDataCreateJoinLink & V>(
    v,
    id,
    hashSystemMessageDataCreateJoinLink,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating the group join link was edited. */
export interface SystemMessageDataEditJoinLink {
  $type?: 'chat.bsky.convo.defs#systemMessageDataEditJoinLink'
}

const hashSystemMessageDataEditJoinLink = 'systemMessageDataEditJoinLink'

export function isSystemMessageDataEditJoinLink<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataEditJoinLink)
}

export function validateSystemMessageDataEditJoinLink<V>(v: V) {
  return validate<SystemMessageDataEditJoinLink & V>(
    v,
    id,
    hashSystemMessageDataEditJoinLink,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating the group join link was enabled. */
export interface SystemMessageDataEnableJoinLink {
  $type?: 'chat.bsky.convo.defs#systemMessageDataEnableJoinLink'
}

const hashSystemMessageDataEnableJoinLink = 'systemMessageDataEnableJoinLink'

export function isSystemMessageDataEnableJoinLink<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataEnableJoinLink)
}

export function validateSystemMessageDataEnableJoinLink<V>(v: V) {
  return validate<SystemMessageDataEnableJoinLink & V>(
    v,
    id,
    hashSystemMessageDataEnableJoinLink,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. System message indicating the group join link was disabled. */
export interface SystemMessageDataDisableJoinLink {
  $type?: 'chat.bsky.convo.defs#systemMessageDataDisableJoinLink'
}

const hashSystemMessageDataDisableJoinLink = 'systemMessageDataDisableJoinLink'

export function isSystemMessageDataDisableJoinLink<V>(v: V) {
  return is$typed(v, id, hashSystemMessageDataDisableJoinLink)
}

export function validateSystemMessageDataDisableJoinLink<V>(v: V) {
  return validate<SystemMessageDataDisableJoinLink & V>(
    v,
    id,
    hashSystemMessageDataDisableJoinLink,
  )
}

export interface DeletedMessageView {
  $type?: 'chat.bsky.convo.defs#deletedMessageView'
  id: string
  rev: string
  sender: MessageViewSender
  sentAt: string
}

const hashDeletedMessageView = 'deletedMessageView'

export function isDeletedMessageView<V>(v: V) {
  return is$typed(v, id, hashDeletedMessageView)
}

export function validateDeletedMessageView<V>(v: V) {
  return validate<DeletedMessageView & V>(v, id, hashDeletedMessageView)
}

export interface MessageViewSender {
  $type?: 'chat.bsky.convo.defs#messageViewSender'
  did: string
}

const hashMessageViewSender = 'messageViewSender'

export function isMessageViewSender<V>(v: V) {
  return is$typed(v, id, hashMessageViewSender)
}

export function validateMessageViewSender<V>(v: V) {
  return validate<MessageViewSender & V>(v, id, hashMessageViewSender)
}

export interface ReactionView {
  $type?: 'chat.bsky.convo.defs#reactionView'
  value: string
  sender: ReactionViewSender
  createdAt: string
}

const hashReactionView = 'reactionView'

export function isReactionView<V>(v: V) {
  return is$typed(v, id, hashReactionView)
}

export function validateReactionView<V>(v: V) {
  return validate<ReactionView & V>(v, id, hashReactionView)
}

export interface ReactionViewSender {
  $type?: 'chat.bsky.convo.defs#reactionViewSender'
  did: string
}

const hashReactionViewSender = 'reactionViewSender'

export function isReactionViewSender<V>(v: V) {
  return is$typed(v, id, hashReactionViewSender)
}

export function validateReactionViewSender<V>(v: V) {
  return validate<ReactionViewSender & V>(v, id, hashReactionViewSender)
}

export interface MessageAndReactionView {
  $type?: 'chat.bsky.convo.defs#messageAndReactionView'
  message: MessageView
  reaction: ReactionView
}

const hashMessageAndReactionView = 'messageAndReactionView'

export function isMessageAndReactionView<V>(v: V) {
  return is$typed(v, id, hashMessageAndReactionView)
}

export function validateMessageAndReactionView<V>(v: V) {
  return validate<MessageAndReactionView & V>(v, id, hashMessageAndReactionView)
}

export interface ConvoView {
  $type?: 'chat.bsky.convo.defs#convoView'
  id: string
  rev: string
  /** Members of this conversation. For direct convos, it will be an immutable list of the 2 members. For group convos, it will a list of important members (the first few members, the viewer, the member who invited the viewer, the member who sent the last message, the member who sent the last reaction), but will not contain the full list of members. Use chat.bsky.convo.getConvoMembers to list all members. */
  members: ChatBskyActorDefs.ProfileViewBasic[]
  lastMessage?:
    | $Typed<MessageView>
    | $Typed<DeletedMessageView>
    | $Typed<SystemMessageView>
    | { $type: string }
  lastReaction?: $Typed<MessageAndReactionView> | { $type: string }
  muted: boolean
  status?: ConvoStatus
  unreadCount: number
  kind?: $Typed<DirectConvo> | $Typed<GroupConvo> | { $type: string }
}

const hashConvoView = 'convoView'

export function isConvoView<V>(v: V) {
  return is$typed(v, id, hashConvoView)
}

export function validateConvoView<V>(v: V) {
  return validate<ConvoView & V>(v, id, hashConvoView)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. */
export interface DirectConvo {
  $type?: 'chat.bsky.convo.defs#directConvo'
}

const hashDirectConvo = 'directConvo'

export function isDirectConvo<V>(v: V) {
  return is$typed(v, id, hashDirectConvo)
}

export function validateDirectConvo<V>(v: V) {
  return validate<DirectConvo & V>(v, id, hashDirectConvo)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. */
export interface GroupConvo {
  $type?: 'chat.bsky.convo.defs#groupConvo'
  /** The display name of the group conversation. */
  name: string
  /** The total number of members in the group conversation. */
  memberCount: number
  joinLink?: ChatBskyGroupDefs.JoinLinkView
  lockStatus: ConvoLockStatus
}

const hashGroupConvo = 'groupConvo'

export function isGroupConvo<V>(v: V) {
  return is$typed(v, id, hashGroupConvo)
}

export function validateGroupConvo<V>(v: V) {
  return validate<GroupConvo & V>(v, id, hashGroupConvo)
}

/** Event indicating a convo containing the viewer was started. Can be direct or group. When a member is added to a group convo, they also get this event. */
export interface LogBeginConvo {
  $type?: 'chat.bsky.convo.defs#logBeginConvo'
  rev: string
  convoId: string
}

const hashLogBeginConvo = 'logBeginConvo'

export function isLogBeginConvo<V>(v: V) {
  return is$typed(v, id, hashLogBeginConvo)
}

export function validateLogBeginConvo<V>(v: V) {
  return validate<LogBeginConvo & V>(v, id, hashLogBeginConvo)
}

/** Event indicating the viewer accepted a convo, and it can be moved out of the request inbox. Can be direct or group. */
export interface LogAcceptConvo {
  $type?: 'chat.bsky.convo.defs#logAcceptConvo'
  rev: string
  convoId: string
}

const hashLogAcceptConvo = 'logAcceptConvo'

export function isLogAcceptConvo<V>(v: V) {
  return is$typed(v, id, hashLogAcceptConvo)
}

export function validateLogAcceptConvo<V>(v: V) {
  return validate<LogAcceptConvo & V>(v, id, hashLogAcceptConvo)
}

/** Event indicating the viewer left a convo. Can be direct or group. */
export interface LogLeaveConvo {
  $type?: 'chat.bsky.convo.defs#logLeaveConvo'
  rev: string
  convoId: string
}

const hashLogLeaveConvo = 'logLeaveConvo'

export function isLogLeaveConvo<V>(v: V) {
  return is$typed(v, id, hashLogLeaveConvo)
}

export function validateLogLeaveConvo<V>(v: V) {
  return validate<LogLeaveConvo & V>(v, id, hashLogLeaveConvo)
}

/** Event indicating the viewer muted a convo. Can be direct or group. */
export interface LogMuteConvo {
  $type?: 'chat.bsky.convo.defs#logMuteConvo'
  rev: string
  convoId: string
}

const hashLogMuteConvo = 'logMuteConvo'

export function isLogMuteConvo<V>(v: V) {
  return is$typed(v, id, hashLogMuteConvo)
}

export function validateLogMuteConvo<V>(v: V) {
  return validate<LogMuteConvo & V>(v, id, hashLogMuteConvo)
}

/** Event indicating the viewer unmuted a convo. Can be direct or group. */
export interface LogUnmuteConvo {
  $type?: 'chat.bsky.convo.defs#logUnmuteConvo'
  rev: string
  convoId: string
}

const hashLogUnmuteConvo = 'logUnmuteConvo'

export function isLogUnmuteConvo<V>(v: V) {
  return is$typed(v, id, hashLogUnmuteConvo)
}

export function validateLogUnmuteConvo<V>(v: V) {
  return validate<LogUnmuteConvo & V>(v, id, hashLogUnmuteConvo)
}

/** Event indicating a user-originated message was created. Is not emitted for system messages. */
export interface LogCreateMessage {
  $type?: 'chat.bsky.convo.defs#logCreateMessage'
  rev: string
  convoId: string
  message: $Typed<MessageView> | $Typed<DeletedMessageView> | { $type: string }
}

const hashLogCreateMessage = 'logCreateMessage'

export function isLogCreateMessage<V>(v: V) {
  return is$typed(v, id, hashLogCreateMessage)
}

export function validateLogCreateMessage<V>(v: V) {
  return validate<LogCreateMessage & V>(v, id, hashLogCreateMessage)
}

/** Event indicating a user-originated message was deleted. Is not emitted for system messages. */
export interface LogDeleteMessage {
  $type?: 'chat.bsky.convo.defs#logDeleteMessage'
  rev: string
  convoId: string
  message: $Typed<MessageView> | $Typed<DeletedMessageView> | { $type: string }
}

const hashLogDeleteMessage = 'logDeleteMessage'

export function isLogDeleteMessage<V>(v: V) {
  return is$typed(v, id, hashLogDeleteMessage)
}

export function validateLogDeleteMessage<V>(v: V) {
  return validate<LogDeleteMessage & V>(v, id, hashLogDeleteMessage)
}

/** DEPRECATED: use logReadConvo instead. Event indicating a convo was read up to a certain message. */
export interface LogReadMessage {
  $type?: 'chat.bsky.convo.defs#logReadMessage'
  rev: string
  convoId: string
  message:
    | $Typed<MessageView>
    | $Typed<DeletedMessageView>
    | $Typed<SystemMessageView>
    | { $type: string }
}

const hashLogReadMessage = 'logReadMessage'

export function isLogReadMessage<V>(v: V) {
  return is$typed(v, id, hashLogReadMessage)
}

export function validateLogReadMessage<V>(v: V) {
  return validate<LogReadMessage & V>(v, id, hashLogReadMessage)
}

/** Event indicating a reaction was added to a message. */
export interface LogAddReaction {
  $type?: 'chat.bsky.convo.defs#logAddReaction'
  rev: string
  convoId: string
  message: $Typed<MessageView> | $Typed<DeletedMessageView> | { $type: string }
  reaction: ReactionView
}

const hashLogAddReaction = 'logAddReaction'

export function isLogAddReaction<V>(v: V) {
  return is$typed(v, id, hashLogAddReaction)
}

export function validateLogAddReaction<V>(v: V) {
  return validate<LogAddReaction & V>(v, id, hashLogAddReaction)
}

/** Event indicating a reaction was removed from a message. */
export interface LogRemoveReaction {
  $type?: 'chat.bsky.convo.defs#logRemoveReaction'
  rev: string
  convoId: string
  message: $Typed<MessageView> | $Typed<DeletedMessageView> | { $type: string }
  reaction: ReactionView
}

const hashLogRemoveReaction = 'logRemoveReaction'

export function isLogRemoveReaction<V>(v: V) {
  return is$typed(v, id, hashLogRemoveReaction)
}

export function validateLogRemoveReaction<V>(v: V) {
  return validate<LogRemoveReaction & V>(v, id, hashLogRemoveReaction)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a convo was read up to a certain message. */
export interface LogReadConvo {
  $type?: 'chat.bsky.convo.defs#logReadConvo'
  rev: string
  convoId: string
  message:
    | $Typed<MessageView>
    | $Typed<DeletedMessageView>
    | $Typed<SystemMessageView>
    | { $type: string }
}

const hashLogReadConvo = 'logReadConvo'

export function isLogReadConvo<V>(v: V) {
  return is$typed(v, id, hashLogReadConvo)
}

export function validateLogReadConvo<V>(v: V) {
  return validate<LogReadConvo & V>(v, id, hashLogReadConvo)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a member was added to a group convo. The member who was added gets a logBeginConvo (to create the convo) but also a logAddMember (to show the system message as the first message the user sees). */
export interface LogAddMember {
  $type?: 'chat.bsky.convo.defs#logAddMember'
  rev: string
  convoId: string
  message: SystemMessageView
  /** Profiles referred in the system message. */
  relatedProfiles: ChatBskyActorDefs.ProfileViewBasic[]
}

const hashLogAddMember = 'logAddMember'

export function isLogAddMember<V>(v: V) {
  return is$typed(v, id, hashLogAddMember)
}

export function validateLogAddMember<V>(v: V) {
  return validate<LogAddMember & V>(v, id, hashLogAddMember)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a member was removed from a group convo. The member who was removed gets a logLeaveConvo (to leave the convo) but not a logRemoveMember (because they already left, so can't see the system message). */
export interface LogRemoveMember {
  $type?: 'chat.bsky.convo.defs#logRemoveMember'
  rev: string
  convoId: string
  message: SystemMessageView
  /** Profiles referred in the system message. */
  relatedProfiles: ChatBskyActorDefs.ProfileViewBasic[]
}

const hashLogRemoveMember = 'logRemoveMember'

export function isLogRemoveMember<V>(v: V) {
  return is$typed(v, id, hashLogRemoveMember)
}

export function validateLogRemoveMember<V>(v: V) {
  return validate<LogRemoveMember & V>(v, id, hashLogRemoveMember)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a member joined a group convo via join link. The member who was added gets a logBeginConvo (to create the convo) but also a logMemberJoin (to show the system message as the first message the user sees). */
export interface LogMemberJoin {
  $type?: 'chat.bsky.convo.defs#logMemberJoin'
  rev: string
  convoId: string
  message: SystemMessageView
  /** Profiles referred in the system message. */
  relatedProfiles: ChatBskyActorDefs.ProfileViewBasic[]
}

const hashLogMemberJoin = 'logMemberJoin'

export function isLogMemberJoin<V>(v: V) {
  return is$typed(v, id, hashLogMemberJoin)
}

export function validateLogMemberJoin<V>(v: V) {
  return validate<LogMemberJoin & V>(v, id, hashLogMemberJoin)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a member voluntarily left a group convo. The member who was removed gets a logLeaveConvo (to leave the convo) but not a logMemberLeave (because they already left, so can't see the system message). */
export interface LogMemberLeave {
  $type?: 'chat.bsky.convo.defs#logMemberLeave'
  rev: string
  convoId: string
  message: SystemMessageView
  /** Profiles referred in the system message. */
  relatedProfiles: ChatBskyActorDefs.ProfileViewBasic[]
}

const hashLogMemberLeave = 'logMemberLeave'

export function isLogMemberLeave<V>(v: V) {
  return is$typed(v, id, hashLogMemberLeave)
}

export function validateLogMemberLeave<V>(v: V) {
  return validate<LogMemberLeave & V>(v, id, hashLogMemberLeave)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a group convo was locked. */
export interface LogLockConvo {
  $type?: 'chat.bsky.convo.defs#logLockConvo'
  rev: string
  convoId: string
  message: SystemMessageView
  /** Profiles referred in the system message. */
  relatedProfiles: ChatBskyActorDefs.ProfileViewBasic[]
}

const hashLogLockConvo = 'logLockConvo'

export function isLogLockConvo<V>(v: V) {
  return is$typed(v, id, hashLogLockConvo)
}

export function validateLogLockConvo<V>(v: V) {
  return validate<LogLockConvo & V>(v, id, hashLogLockConvo)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a group convo was unlocked. */
export interface LogUnlockConvo {
  $type?: 'chat.bsky.convo.defs#logUnlockConvo'
  rev: string
  convoId: string
  message: SystemMessageView
  /** Profiles referred in the system message. */
  relatedProfiles: ChatBskyActorDefs.ProfileViewBasic[]
}

const hashLogUnlockConvo = 'logUnlockConvo'

export function isLogUnlockConvo<V>(v: V) {
  return is$typed(v, id, hashLogUnlockConvo)
}

export function validateLogUnlockConvo<V>(v: V) {
  return validate<LogUnlockConvo & V>(v, id, hashLogUnlockConvo)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a group convo was locked permanently. */
export interface LogLockConvoPermanently {
  $type?: 'chat.bsky.convo.defs#logLockConvoPermanently'
  rev: string
  convoId: string
  message: SystemMessageView
  /** Profiles referred in the system message. */
  relatedProfiles: ChatBskyActorDefs.ProfileViewBasic[]
}

const hashLogLockConvoPermanently = 'logLockConvoPermanently'

export function isLogLockConvoPermanently<V>(v: V) {
  return is$typed(v, id, hashLogLockConvoPermanently)
}

export function validateLogLockConvoPermanently<V>(v: V) {
  return validate<LogLockConvoPermanently & V>(
    v,
    id,
    hashLogLockConvoPermanently,
  )
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating info about group convo was edited. */
export interface LogEditGroup {
  $type?: 'chat.bsky.convo.defs#logEditGroup'
  rev: string
  convoId: string
  message: SystemMessageView
}

const hashLogEditGroup = 'logEditGroup'

export function isLogEditGroup<V>(v: V) {
  return is$typed(v, id, hashLogEditGroup)
}

export function validateLogEditGroup<V>(v: V) {
  return validate<LogEditGroup & V>(v, id, hashLogEditGroup)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a join link was created for a group convo. */
export interface LogCreateJoinLink {
  $type?: 'chat.bsky.convo.defs#logCreateJoinLink'
  rev: string
  convoId: string
  message: SystemMessageView
}

const hashLogCreateJoinLink = 'logCreateJoinLink'

export function isLogCreateJoinLink<V>(v: V) {
  return is$typed(v, id, hashLogCreateJoinLink)
}

export function validateLogCreateJoinLink<V>(v: V) {
  return validate<LogCreateJoinLink & V>(v, id, hashLogCreateJoinLink)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a settings about a join link for a group convo were edited. */
export interface LogEditJoinLink {
  $type?: 'chat.bsky.convo.defs#logEditJoinLink'
  rev: string
  convoId: string
  message: SystemMessageView
}

const hashLogEditJoinLink = 'logEditJoinLink'

export function isLogEditJoinLink<V>(v: V) {
  return is$typed(v, id, hashLogEditJoinLink)
}

export function validateLogEditJoinLink<V>(v: V) {
  return validate<LogEditJoinLink & V>(v, id, hashLogEditJoinLink)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a join link was enabled for a group convo. */
export interface LogEnableJoinLink {
  $type?: 'chat.bsky.convo.defs#logEnableJoinLink'
  rev: string
  convoId: string
  message: SystemMessageView
}

const hashLogEnableJoinLink = 'logEnableJoinLink'

export function isLogEnableJoinLink<V>(v: V) {
  return is$typed(v, id, hashLogEnableJoinLink)
}

export function validateLogEnableJoinLink<V>(v: V) {
  return validate<LogEnableJoinLink & V>(v, id, hashLogEnableJoinLink)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a join link was disabled for a group convo. */
export interface LogDisableJoinLink {
  $type?: 'chat.bsky.convo.defs#logDisableJoinLink'
  rev: string
  convoId: string
  message: SystemMessageView
}

const hashLogDisableJoinLink = 'logDisableJoinLink'

export function isLogDisableJoinLink<V>(v: V) {
  return is$typed(v, id, hashLogDisableJoinLink)
}

export function validateLogDisableJoinLink<V>(v: V) {
  return validate<LogDisableJoinLink & V>(v, id, hashLogDisableJoinLink)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a join request was made to a group the viewer owns. Only the owner gets this. */
export interface LogIncomingJoinRequest {
  $type?: 'chat.bsky.convo.defs#logIncomingJoinRequest'
  rev: string
  convoId: string
  member: ChatBskyActorDefs.ProfileViewBasic
}

const hashLogIncomingJoinRequest = 'logIncomingJoinRequest'

export function isLogIncomingJoinRequest<V>(v: V) {
  return is$typed(v, id, hashLogIncomingJoinRequest)
}

export function validateLogIncomingJoinRequest<V>(v: V) {
  return validate<LogIncomingJoinRequest & V>(v, id, hashLogIncomingJoinRequest)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a join request was approved by the viewer. Only the owner gets this. The approved member gets a logBeginConvo. */
export interface LogApproveJoinRequest {
  $type?: 'chat.bsky.convo.defs#logApproveJoinRequest'
  rev: string
  convoId: string
  member: ChatBskyActorDefs.ProfileViewBasic
}

const hashLogApproveJoinRequest = 'logApproveJoinRequest'

export function isLogApproveJoinRequest<V>(v: V) {
  return is$typed(v, id, hashLogApproveJoinRequest)
}

export function validateLogApproveJoinRequest<V>(v: V) {
  return validate<LogApproveJoinRequest & V>(v, id, hashLogApproveJoinRequest)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a join request was rejected by the viewer. Only the owner gets this. */
export interface LogRejectJoinRequest {
  $type?: 'chat.bsky.convo.defs#logRejectJoinRequest'
  rev: string
  convoId: string
  member: ChatBskyActorDefs.ProfileViewBasic
}

const hashLogRejectJoinRequest = 'logRejectJoinRequest'

export function isLogRejectJoinRequest<V>(v: V) {
  return is$typed(v, id, hashLogRejectJoinRequest)
}

export function validateLogRejectJoinRequest<V>(v: V) {
  return validate<LogRejectJoinRequest & V>(v, id, hashLogRejectJoinRequest)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. Event indicating a join request was made by the viewer. */
export interface LogOutgoingJoinRequest {
  $type?: 'chat.bsky.convo.defs#logOutgoingJoinRequest'
  rev: string
  convoId: string
}

const hashLogOutgoingJoinRequest = 'logOutgoingJoinRequest'

export function isLogOutgoingJoinRequest<V>(v: V) {
  return is$typed(v, id, hashLogOutgoingJoinRequest)
}

export function validateLogOutgoingJoinRequest<V>(v: V) {
  return validate<LogOutgoingJoinRequest & V>(v, id, hashLogOutgoingJoinRequest)
}
