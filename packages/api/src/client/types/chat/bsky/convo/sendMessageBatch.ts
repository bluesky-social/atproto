/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ChatBskyConvoDefs from './defs'

const id = 'chat.bsky.convo.sendMessageBatch'

export interface QueryParams {}

export interface InputSchema {
  items: BatchItem[]
  [k: string]: unknown
}

export interface OutputSchema {
  items: ChatBskyConvoDefs.MessageView[]
  [k: string]: unknown
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
  convoId: string
  message: ChatBskyConvoDefs.MessageInput
  [k: string]: unknown
}

export function isBatchItem(v: unknown): v is BatchItem & {
  $type: $Type<'chat.bsky.convo.sendMessageBatch', 'batchItem'>
} {
  return is$typed(v, id, 'batchItem')
}

export function validateBatchItem(v: unknown) {
  return lexicons.validate(`${id}#batchItem`, v) as ValidationResult<BatchItem>
}
