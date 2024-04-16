/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../lexicons'
import { isObj, hasProp } from '../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../../app/bsky/richtext/facet'
import * as AppBskyEmbedRecord from '../../app/bsky/embed/record'

export interface Message {
  id?: string
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets: AppBskyRichtextFacet.Main[]
  embed: AppBskyEmbedRecord.Main | { $type: string; [k: string]: unknown }
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
  text: string
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets: AppBskyRichtextFacet.Main[]
  embed: AppBskyEmbedRecord.View | { $type: string; [k: string]: unknown }
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

export interface RoomView {
  id: string
  participants: string[]
  lastMessage?: Message
  unreadCount: number
  [k: string]: unknown
}

export function isRoomView(v: unknown): v is RoomView {
  return isObj(v) && hasProp(v, '$type') && v.$type === 'temp.dm.defs#roomView'
}

export function validateRoomView(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.defs#roomView', v)
}
