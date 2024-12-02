/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyRichtextFacet from '../../../app/bsky/richtext/facet'
import * as AppBskyEmbedRecord from '../../../app/bsky/embed/record'
import * as ChatBskyActorDefs from '../actor/defs'

export const id = 'chat.bsky.convo.defs'

export interface MessageRef {
  $type?: $Type<'chat.bsky.convo.defs', 'messageRef'>
  did: string
  convoId: string
  messageId: string
}

export function isMessageRef<V>(v: V) {
  return is$typed(v, id, 'messageRef')
}

export function validateMessageRef(v: unknown) {
  return lexicons.validate(
    `${id}#messageRef`,
    v,
  ) as ValidationResult<MessageRef>
}

export function isValidMessageRef<V>(v: V): v is V & $Typed<MessageRef> {
  return isMessageRef(v) && validateMessageRef(v).success
}

export interface MessageInput {
  $type?: $Type<'chat.bsky.convo.defs', 'messageInput'>
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: $Typed<AppBskyEmbedRecord.Main> | { $type: string }
}

export function isMessageInput<V>(v: V) {
  return is$typed(v, id, 'messageInput')
}

export function validateMessageInput(v: unknown) {
  return lexicons.validate(
    `${id}#messageInput`,
    v,
  ) as ValidationResult<MessageInput>
}

export function isValidMessageInput<V>(v: V): v is V & $Typed<MessageInput> {
  return isMessageInput(v) && validateMessageInput(v).success
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

export function isMessageView<V>(v: V) {
  return is$typed(v, id, 'messageView')
}

export function validateMessageView(v: unknown) {
  return lexicons.validate(
    `${id}#messageView`,
    v,
  ) as ValidationResult<MessageView>
}

export function isValidMessageView<V>(v: V): v is V & $Typed<MessageView> {
  return isMessageView(v) && validateMessageView(v).success
}

export interface DeletedMessageView {
  $type?: $Type<'chat.bsky.convo.defs', 'deletedMessageView'>
  id: string
  rev: string
  sender: MessageViewSender
  sentAt: string
}

export function isDeletedMessageView<V>(v: V) {
  return is$typed(v, id, 'deletedMessageView')
}

export function validateDeletedMessageView(v: unknown) {
  return lexicons.validate(
    `${id}#deletedMessageView`,
    v,
  ) as ValidationResult<DeletedMessageView>
}

export function isValidDeletedMessageView<V>(
  v: V,
): v is V & $Typed<DeletedMessageView> {
  return isDeletedMessageView(v) && validateDeletedMessageView(v).success
}

export interface MessageViewSender {
  $type?: $Type<'chat.bsky.convo.defs', 'messageViewSender'>
  did: string
}

export function isMessageViewSender<V>(v: V) {
  return is$typed(v, id, 'messageViewSender')
}

export function validateMessageViewSender(v: unknown) {
  return lexicons.validate(
    `${id}#messageViewSender`,
    v,
  ) as ValidationResult<MessageViewSender>
}

export function isValidMessageViewSender<V>(
  v: V,
): v is V & $Typed<MessageViewSender> {
  return isMessageViewSender(v) && validateMessageViewSender(v).success
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

export function isConvoView<V>(v: V) {
  return is$typed(v, id, 'convoView')
}

export function validateConvoView(v: unknown) {
  return lexicons.validate(`${id}#convoView`, v) as ValidationResult<ConvoView>
}

export function isValidConvoView<V>(v: V): v is V & $Typed<ConvoView> {
  return isConvoView(v) && validateConvoView(v).success
}

export interface LogBeginConvo {
  $type?: $Type<'chat.bsky.convo.defs', 'logBeginConvo'>
  rev: string
  convoId: string
}

export function isLogBeginConvo<V>(v: V) {
  return is$typed(v, id, 'logBeginConvo')
}

export function validateLogBeginConvo(v: unknown) {
  return lexicons.validate(
    `${id}#logBeginConvo`,
    v,
  ) as ValidationResult<LogBeginConvo>
}

export function isValidLogBeginConvo<V>(v: V): v is V & $Typed<LogBeginConvo> {
  return isLogBeginConvo(v) && validateLogBeginConvo(v).success
}

export interface LogLeaveConvo {
  $type?: $Type<'chat.bsky.convo.defs', 'logLeaveConvo'>
  rev: string
  convoId: string
}

export function isLogLeaveConvo<V>(v: V) {
  return is$typed(v, id, 'logLeaveConvo')
}

export function validateLogLeaveConvo(v: unknown) {
  return lexicons.validate(
    `${id}#logLeaveConvo`,
    v,
  ) as ValidationResult<LogLeaveConvo>
}

export function isValidLogLeaveConvo<V>(v: V): v is V & $Typed<LogLeaveConvo> {
  return isLogLeaveConvo(v) && validateLogLeaveConvo(v).success
}

export interface LogCreateMessage {
  $type?: $Type<'chat.bsky.convo.defs', 'logCreateMessage'>
  rev: string
  convoId: string
  message: $Typed<MessageView> | $Typed<DeletedMessageView> | { $type: string }
}

export function isLogCreateMessage<V>(v: V) {
  return is$typed(v, id, 'logCreateMessage')
}

export function validateLogCreateMessage(v: unknown) {
  return lexicons.validate(
    `${id}#logCreateMessage`,
    v,
  ) as ValidationResult<LogCreateMessage>
}

export function isValidLogCreateMessage<V>(
  v: V,
): v is V & $Typed<LogCreateMessage> {
  return isLogCreateMessage(v) && validateLogCreateMessage(v).success
}

export interface LogDeleteMessage {
  $type?: $Type<'chat.bsky.convo.defs', 'logDeleteMessage'>
  rev: string
  convoId: string
  message: $Typed<MessageView> | $Typed<DeletedMessageView> | { $type: string }
}

export function isLogDeleteMessage<V>(v: V) {
  return is$typed(v, id, 'logDeleteMessage')
}

export function validateLogDeleteMessage(v: unknown) {
  return lexicons.validate(
    `${id}#logDeleteMessage`,
    v,
  ) as ValidationResult<LogDeleteMessage>
}

export function isValidLogDeleteMessage<V>(
  v: V,
): v is V & $Typed<LogDeleteMessage> {
  return isLogDeleteMessage(v) && validateLogDeleteMessage(v).success
}
