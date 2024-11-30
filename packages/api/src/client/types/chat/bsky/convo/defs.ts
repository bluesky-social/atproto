/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../../../app/bsky/richtext/facet'
import * as AppBskyEmbedRecord from '../../../app/bsky/embed/record'
import * as ChatBskyActorDefs from '../actor/defs'

export interface MessageRef {
  did: string
  convoId: string
  messageId: string
  [k: string]: unknown
}

export function isMessageRef(v: unknown): v is MessageRef {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#messageRef'
  )
}

export function validateMessageRef(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#messageRef', v)
}

export interface MessageInput {
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: AppBskyEmbedRecord.Main | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isMessageInput(v: unknown): v is MessageInput {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#messageInput'
  )
}

export function validateMessageInput(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#messageInput', v)
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

export function isMessageView(v: unknown): v is MessageView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#messageView'
  )
}

export function validateMessageView(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#messageView', v)
}

export interface DeletedMessageView {
  id: string
  rev: string
  sender: MessageViewSender
  sentAt: string
  [k: string]: unknown
}

export function isDeletedMessageView(v: unknown): v is DeletedMessageView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#deletedMessageView'
  )
}

export function validateDeletedMessageView(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#deletedMessageView', v)
}

export interface MessageViewSender {
  did: string
  [k: string]: unknown
}

export function isMessageViewSender(v: unknown): v is MessageViewSender {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#messageViewSender'
  )
}

export function validateMessageViewSender(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#messageViewSender', v)
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

export function isConvoView(v: unknown): v is ConvoView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#convoView'
  )
}

export function validateConvoView(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#convoView', v)
}

export interface LogBeginConvo {
  rev: string
  convoId: string
  [k: string]: unknown
}

export function isLogBeginConvo(v: unknown): v is LogBeginConvo {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#logBeginConvo'
  )
}

export function validateLogBeginConvo(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#logBeginConvo', v)
}

export interface LogLeaveConvo {
  rev: string
  convoId: string
  [k: string]: unknown
}

export function isLogLeaveConvo(v: unknown): v is LogLeaveConvo {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#logLeaveConvo'
  )
}

export function validateLogLeaveConvo(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#logLeaveConvo', v)
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

export function isLogCreateMessage(v: unknown): v is LogCreateMessage {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#logCreateMessage'
  )
}

export function validateLogCreateMessage(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#logCreateMessage', v)
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

export function isLogDeleteMessage(v: unknown): v is LogDeleteMessage {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.defs#logDeleteMessage'
  )
}

export function validateLogDeleteMessage(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.defs#logDeleteMessage', v)
}
