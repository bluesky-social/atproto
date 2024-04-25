/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../lexicons'
import { isObj, hasProp } from '../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as TempDmDefs from './defs'

export interface QueryParams {}

export interface InputSchema {
  items: BatchItem[]
  [k: string]: unknown
}

export interface OutputSchema {
  items: TempDmDefs.MessageView[]
  [k: string]: unknown
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
  chatId: string
  message: TempDmDefs.Message
  [k: string]: unknown
}

export function isBatchItem(v: unknown): v is BatchItem {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'temp.dm.sendMessageBatch#batchItem'
  )
}

export function validateBatchItem(v: unknown): ValidationResult {
  return lexicons.validate('temp.dm.sendMessageBatch#batchItem', v)
}
