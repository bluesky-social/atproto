/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ChatBskyConvoDefs from './defs'

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
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

export interface BatchItem {
  convoId: string
  message: ChatBskyConvoDefs.MessageInput
  [k: string]: unknown
}

export function isBatchItem(v: unknown): v is BatchItem {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.convo.sendMessageBatch#batchItem'
  )
}

export function validateBatchItem(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.convo.sendMessageBatch#batchItem', v)
}
