/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../lexicons'
import { isObj, hasProp } from '../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../../app/bsky/richtext/facet'
import * as AppBskyEmbedRecord from '../../app/bsky/embed/record'
import * as AppBskyActorDefs from '../../app/bsky/actor/defs'

export interface Message {
  id?: string
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: AppBskyEmbedRecord.Main | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isMessage(v: unknown): v is Message {
  return isObj(v) && hasProp(v, '$type') && v.$type === 'temp.dm.defs#message'
}

export function validateMessage(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#message', v)
}

export interface MessageView {
  id: string
  rev: string
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  embed?: AppBskyEmbedRecord.Main | { $type: string; [k: string]: unknown }
  sender?: MessageViewSender
  sentAt: string
  [k: string]: unknown
}

export function isMessageView(v: unknown): v is MessageView {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'temp.dm.defs#messageView'
  )
}

export function validateMessageView(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#messageView', v)
}

export interface DeletedMessage {
  id: string
  rev?: string
  sender?: MessageViewSender
  sentAt: string
  [k: string]: unknown
}

export function isDeletedMessage(v: unknown): v is DeletedMessage {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'temp.dm.defs#deletedMessage'
  )
}

export function validateDeletedMessage(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#deletedMessage', v)
}

export interface MessageViewSender {
  did: string
  [k: string]: unknown
}

export function isMessageViewSender(v: unknown): v is MessageViewSender {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'temp.dm.defs#messageViewSender'
  )
}

export function validateMessageViewSender(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#messageViewSender', v)
}

export interface ChatView {
  id: string
  rev: string
  members: AppBskyActorDefs.ProfileViewBasic[]
  lastMessage?:
    | MessageView
    | DeletedMessage
    | { $type: string; [k: string]: unknown }
  unreadCount: number
  [k: string]: unknown
}

export function isChatView(v: unknown): v is ChatView {
  return isObj(v) && hasProp(v, '$type') && v.$type === 'temp.dm.defs#chatView'
}

export function validateChatView(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#chatView', v)
}

export type IncomingMessageSetting =
  | 'all'
  | 'none'
  | 'following'
  | (string & {})

export interface LogBeginChat {
  rev: string
  chatId: string
  [k: string]: unknown
}

export function isLogBeginChat(v: unknown): v is LogBeginChat {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'temp.dm.defs#logBeginChat'
  )
}

export function validateLogBeginChat(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#logBeginChat', v)
}

export interface LogCreateMessage {
  rev: string
  chatId: string
  message:
    | MessageView
    | DeletedMessage
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isLogCreateMessage(v: unknown): v is LogCreateMessage {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'temp.dm.defs#logCreateMessage'
  )
}

export function validateLogCreateMessage(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#logCreateMessage', v)
}

export interface LogDeleteMessage {
  rev: string
  chatId: string
  message:
    | MessageView
    | DeletedMessage
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isLogDeleteMessage(v: unknown): v is LogDeleteMessage {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'temp.dm.defs#logDeleteMessage'
  )
}

export function validateLogDeleteMessage(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#logDeleteMessage', v)
}
