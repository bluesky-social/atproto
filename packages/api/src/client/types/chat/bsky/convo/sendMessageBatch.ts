/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as ChatBskyConvoDefs from './defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'chat.bsky.convo.sendMessageBatch'

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

const hashBatchItem = 'batchItem'

export function isBatchItem<V>(v: V) {
  return is$typed(v, id, hashBatchItem)
}

export function validateBatchItem<V>(v: V) {
  return validate<BatchItem & V>(v, id, hashBatchItem)
}

export function isValidBatchItem<V>(v: V) {
  return isValid<BatchItem>(v, id, hashBatchItem)
}
