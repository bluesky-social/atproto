/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as AppBskyRichtextFacet from '../../../app/bsky/richtext/facet'
import type * as AppBskyEmbedRecord from '../../../app/bsky/embed/record'
import type * as ChatBskyActorDefs from '../actor/defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'chat.bsky.convo.defs'

export interface MessageRef {
  $type?: $Type<'chat.bsky.convo.defs', 'messageRef'>
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

export function isValidMessageRef<V>(v: V) {
  return isValid<MessageRef>(v, id, hashMessageRef)
}

export interface MessageInput {
  $type?: $Type<'chat.bsky.convo.defs', 'messageInput'>
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

export function isValidMessageInput<V>(v: V) {
  return isValid<MessageInput>(v, id, hashMessageInput)
}

export interface MessageView {
  $type?: $Type<'chat.bsky.convo.defs', 'messageView'>
  id: string
  rev: string
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: $Typed<AppBskyEmbedRecord.View> | { $type: string }
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

export function isValidMessageView<V>(v: V) {
  return isValid<MessageView>(v, id, hashMessageView)
}

export interface DeletedMessageView {
  $type?: $Type<'chat.bsky.convo.defs', 'deletedMessageView'>
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

export function isValidDeletedMessageView<V>(v: V) {
  return isValid<DeletedMessageView>(v, id, hashDeletedMessageView)
}

export interface MessageViewSender {
  $type?: $Type<'chat.bsky.convo.defs', 'messageViewSender'>
  did: string
}

const hashMessageViewSender = 'messageViewSender'

export function isMessageViewSender<V>(v: V) {
  return is$typed(v, id, hashMessageViewSender)
}

export function validateMessageViewSender<V>(v: V) {
  return validate<MessageViewSender & V>(v, id, hashMessageViewSender)
}

export function isValidMessageViewSender<V>(v: V) {
  return isValid<MessageViewSender>(v, id, hashMessageViewSender)
}

export interface ConvoView {
  $type?: $Type<'chat.bsky.convo.defs', 'convoView'>
  id: string
  rev: string
  members: ChatBskyActorDefs.ProfileViewBasic[]
  lastMessage?:
    | $Typed<MessageView>
    | $Typed<DeletedMessageView>
    | { $type: string }
  muted: boolean
  opened?: boolean
  unreadCount: number
}

const hashConvoView = 'convoView'

export function isConvoView<V>(v: V) {
  return is$typed(v, id, hashConvoView)
}

export function validateConvoView<V>(v: V) {
  return validate<ConvoView & V>(v, id, hashConvoView)
}

export function isValidConvoView<V>(v: V) {
  return isValid<ConvoView>(v, id, hashConvoView)
}

export interface LogBeginConvo {
  $type?: $Type<'chat.bsky.convo.defs', 'logBeginConvo'>
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

export function isValidLogBeginConvo<V>(v: V) {
  return isValid<LogBeginConvo>(v, id, hashLogBeginConvo)
}

export interface LogLeaveConvo {
  $type?: $Type<'chat.bsky.convo.defs', 'logLeaveConvo'>
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

export function isValidLogLeaveConvo<V>(v: V) {
  return isValid<LogLeaveConvo>(v, id, hashLogLeaveConvo)
}

export interface LogCreateMessage {
  $type?: $Type<'chat.bsky.convo.defs', 'logCreateMessage'>
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

export function isValidLogCreateMessage<V>(v: V) {
  return isValid<LogCreateMessage>(v, id, hashLogCreateMessage)
}

export interface LogDeleteMessage {
  $type?: $Type<'chat.bsky.convo.defs', 'logDeleteMessage'>
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

export function isValidLogDeleteMessage<V>(v: V) {
  return isValid<LogDeleteMessage>(v, id, hashLogDeleteMessage)
}
