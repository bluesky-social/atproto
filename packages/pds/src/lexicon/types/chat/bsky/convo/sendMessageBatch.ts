/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as ChatBskyConvoDefs from './defs'

export const id = 'chat.bsky.convo.sendMessageBatch'

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

export function isBatchItem<V>(v: V) {
  return is$typed(v, id, 'batchItem')
}

export function validateBatchItem(v: unknown) {
  return lexicons.validate(`${id}#batchItem`, v) as ValidationResult<BatchItem>
}

export function isValidBatchItem<V>(v: V): v is V & $Typed<BatchItem> {
  return isBatchItem(v) && validateBatchItem(v).success
}
