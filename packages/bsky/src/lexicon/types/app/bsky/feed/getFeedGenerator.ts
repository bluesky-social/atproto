/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as AppBskyFeedDefs from './defs'

export const id = 'app.bsky.feed.getFeedGenerator'

export interface QueryParams {
  /** AT-URI of the feed generator record. */
  feed: string
}

export type InputSchema = undefined

export interface OutputSchema {
  view: AppBskyFeedDefs.GeneratorView
  /** Indicates whether the feed generator service has been online recently, or else seems to be inactive. */
  isOnline: boolean
  /** Indicates whether the feed generator service is compatible with the record declaration. */
  isValid: boolean
}

export type HandlerInput = undefined

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
