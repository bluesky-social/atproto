/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as AppBskyActorDefs from '../actor/defs'

export interface QueryParams {
  /** AT-URI of the subject (eg, a post record). */
  uri: string
  /** CID of the subject record (aka, specific version of record), to filter likes. */
  cid?: string
  limit: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  cursor?: string
  pollAnswers?: PollAnswer[]
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

export interface PollAnswer {
  indexedAt: string
  createdAt: string
  actor: AppBskyActorDefs.ProfileView
  answer: number
  [k: string]: unknown
}

export function isPollAnswer(v: unknown): v is PollAnswer {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.getPollAnswers#pollAnswer'
  )
}

export function validatePollAnswer(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.getPollAnswers#pollAnswer', v)
}
