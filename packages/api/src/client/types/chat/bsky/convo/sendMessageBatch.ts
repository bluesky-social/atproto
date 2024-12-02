/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ChatBskyConvoDefs from './defs'

export const id = 'chat.bsky.convo.sendMessageBatch'

export interface QueryParams {}

export interface InputSchema {
  items: BatchItem[]
}

export interface OutputSchema {
  items: ChatBskyConvoDefs.MessageView[]
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface BatchItem {
  $type?: $Type<'chat.bsky.convo.sendMessageBatch', 'batchItem'>
  convoId: string
  message: ChatBskyConvoDefs.MessageInput
}

export function isBatchItem<V>(v: V) {
  return is$typed(v, id, 'batchItem')
}

export function validateBatchItem(v: unknown) {
  return lexicons.validate(`${id}#batchItem`, v) as ValidationResult<BatchItem>
}

export function isValidBatchItem<V>(v: V): v is V & $Typed<BatchItem> {
  return isBatchItem(v) && validateBatchItem(v).success
}
