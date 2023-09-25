/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskyFeedDefs from './defs'

export interface QueryParams {
  /** search query string; syntax, phrase, boolean, and faceting is unspecified, but Lucene query syntax is recommended */
  q: string
  limit: number
  /** optional pagination mechanism; may not necessarily allow scrolling through entire result set */
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  /** count of search hits. optional, may be rounded/truncated, and may not be possible to paginate through all hits */
  hitsTotal?: number
  posts: AppBskyFeedDefs.PostView[]
  [k: string]: unknown
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
  error?: 'BadQueryString'
}

export type HandlerOutput = HandlerError | HandlerSuccess
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
