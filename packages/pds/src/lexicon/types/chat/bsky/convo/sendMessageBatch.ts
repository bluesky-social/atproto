/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
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

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

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
