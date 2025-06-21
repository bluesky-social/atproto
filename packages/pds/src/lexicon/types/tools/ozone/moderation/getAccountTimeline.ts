/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.moderation.getAccountTimeline'

export interface QueryParams {
  did: string
}

export type InputSchema = undefined

export interface OutputSchema {
  timeline: AccountTimeline[]
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
  error?: 'RepoNotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
  resetRouteRateLimits: () => Promise<void>
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface AccountTimeline {
  $type?: 'tools.ozone.moderation.getAccountTimeline#accountTimeline'
  day: string
  summary: AccountTimelineSummary[]
}

const hashAccountTimeline = 'accountTimeline'

export function isAccountTimeline<V>(v: V) {
  return is$typed(v, id, hashAccountTimeline)
}

export function validateAccountTimeline<V>(v: V) {
  return validate<AccountTimeline & V>(v, id, hashAccountTimeline)
}

export interface AccountTimelineSummary {
  $type?: 'tools.ozone.moderation.getAccountTimeline#accountTimelineSummary'
  eventSubjectType: 'account' | 'record' | 'chat' | (string & {})
  eventType: string
  count: number
}

const hashAccountTimelineSummary = 'accountTimelineSummary'

export function isAccountTimelineSummary<V>(v: V) {
  return is$typed(v, id, hashAccountTimelineSummary)
}

export function validateAccountTimelineSummary<V>(v: V) {
  return validate<AccountTimelineSummary & V>(v, id, hashAccountTimelineSummary)
}
