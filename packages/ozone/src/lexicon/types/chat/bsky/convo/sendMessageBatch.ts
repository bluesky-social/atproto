/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as ChatBskyConvoDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.convo.sendMessageBatch'

export type QueryParams = {}

export interface InputSchema {
  items: BatchItem[]
}

export interface OutputSchema {
  items: ChatBskyConvoDefs.MessageView[]
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface BatchItem {
  $type?: 'chat.bsky.convo.sendMessageBatch#batchItem'
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
