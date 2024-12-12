/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'
import * as AppBskyRichtextFacet from '../../../app/bsky/richtext/facet'
import * as AppBskyEmbedRecord from '../../../app/bsky/embed/record'
import * as ChatBskyActorDefs from '../actor/defs'

const id = 'chat.bsky.convo.defs'

export interface MessageRef {
  did: string
  convoId: string
  messageId: string
  [k: string]: unknown
}

export function isMessageRef(
  v: unknown,
): v is MessageRef & { $type: $Type<'chat.bsky.convo.defs', 'messageRef'> } {
  return is$typed(v, id, 'messageRef')
}

export function validateMessageRef(v: unknown) {
  return lexicons.validate(
    `${id}#messageRef`,
    v,
  ) as ValidationResult<MessageRef>
}

export interface MessageInput {
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: AppBskyEmbedRecord.Main | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isMessageInput(v: unknown): v is MessageInput & {
  $type: $Type<'chat.bsky.convo.defs', 'messageInput'>
} {
  return is$typed(v, id, 'messageInput')
}

export function validateMessageInput(v: unknown) {
  return lexicons.validate(
    `${id}#messageInput`,
    v,
  ) as ValidationResult<MessageInput>
}

export interface MessageView {
  id: string
  rev: string
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: AppBskyEmbedRecord.View | { $type: string; [k: string]: unknown }
  sender: MessageViewSender
  sentAt: string
  [k: string]: unknown
}

export function isMessageView(
  v: unknown,
): v is MessageView & { $type: $Type<'chat.bsky.convo.defs', 'messageView'> } {
  return is$typed(v, id, 'messageView')
}

export function validateMessageView(v: unknown) {
  return lexicons.validate(
    `${id}#messageView`,
    v,
  ) as ValidationResult<MessageView>
}

export interface DeletedMessageView {
  id: string
  rev: string
  sender: MessageViewSender
  sentAt: string
  [k: string]: unknown
}

export function isDeletedMessageView(v: unknown): v is DeletedMessageView & {
  $type: $Type<'chat.bsky.convo.defs', 'deletedMessageView'>
} {
  return is$typed(v, id, 'deletedMessageView')
}

export function validateDeletedMessageView(v: unknown) {
  return lexicons.validate(
    `${id}#deletedMessageView`,
    v,
  ) as ValidationResult<DeletedMessageView>
}

export interface MessageViewSender {
  did: string
  [k: string]: unknown
}

export function isMessageViewSender(v: unknown): v is MessageViewSender & {
  $type: $Type<'chat.bsky.convo.defs', 'messageViewSender'>
} {
  return is$typed(v, id, 'messageViewSender')
}

export function validateMessageViewSender(v: unknown) {
  return lexicons.validate(
    `${id}#messageViewSender`,
    v,
  ) as ValidationResult<MessageViewSender>
}

export interface ConvoView {
  id: string
  rev: string
  members: ChatBskyActorDefs.ProfileViewBasic[]
  lastMessage?:
    | MessageView
    | DeletedMessageView
    | { $type: string; [k: string]: unknown }
  muted: boolean
  opened?: boolean
  unreadCount: number
  [k: string]: unknown
}

export function isConvoView(
  v: unknown,
): v is ConvoView & { $type: $Type<'chat.bsky.convo.defs', 'convoView'> } {
  return is$typed(v, id, 'convoView')
}

export function validateConvoView(v: unknown) {
  return lexicons.validate(`${id}#convoView`, v) as ValidationResult<ConvoView>
}

export interface LogBeginConvo {
  rev: string
  convoId: string
  [k: string]: unknown
}

export function isLogBeginConvo(v: unknown): v is LogBeginConvo & {
  $type: $Type<'chat.bsky.convo.defs', 'logBeginConvo'>
} {
  return is$typed(v, id, 'logBeginConvo')
}

export function validateLogBeginConvo(v: unknown) {
  return lexicons.validate(
    `${id}#logBeginConvo`,
    v,
  ) as ValidationResult<LogBeginConvo>
}

export interface LogLeaveConvo {
  rev: string
  convoId: string
  [k: string]: unknown
}

export function isLogLeaveConvo(v: unknown): v is LogLeaveConvo & {
  $type: $Type<'chat.bsky.convo.defs', 'logLeaveConvo'>
} {
  return is$typed(v, id, 'logLeaveConvo')
}

export function validateLogLeaveConvo(v: unknown) {
  return lexicons.validate(
    `${id}#logLeaveConvo`,
    v,
  ) as ValidationResult<LogLeaveConvo>
}

export interface LogCreateMessage {
  rev: string
  convoId: string
  message:
    | MessageView
    | DeletedMessageView
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isLogCreateMessage(v: unknown): v is LogCreateMessage & {
  $type: $Type<'chat.bsky.convo.defs', 'logCreateMessage'>
} {
  return is$typed(v, id, 'logCreateMessage')
}

export function validateLogCreateMessage(v: unknown) {
  return lexicons.validate(
    `${id}#logCreateMessage`,
    v,
  ) as ValidationResult<LogCreateMessage>
}

export interface LogDeleteMessage {
  rev: string
  convoId: string
  message:
    | MessageView
    | DeletedMessageView
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isLogDeleteMessage(v: unknown): v is LogDeleteMessage & {
  $type: $Type<'chat.bsky.convo.defs', 'logDeleteMessage'>
} {
  return is$typed(v, id, 'logDeleteMessage')
}

export function validateLogDeleteMessage(v: unknown) {
  return lexicons.validate(
    `${id}#logDeleteMessage`,
    v,
  ) as ValidationResult<LogDeleteMessage>
}
