/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as ComAtprotoAdminDefs from './defs'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  action:
    | 'com.atproto.admin.defs#takedown'
    | 'com.atproto.admin.defs#flag'
    | 'com.atproto.admin.defs#acknowledge'
    | 'com.atproto.admin.defs#escalate'
    | 'com.atproto.admin.defs#comment'
    | 'com.atproto.admin.defs#label'
    | 'com.atproto.admin.defs#revert'
    | 'com.atproto.admin.defs#report'
    | 'com.atproto.admin.defs#mute'
    | (string & {})
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  createLabelVals?: string[]
  negateLabelVals?: string[]
  comment?: string
  /** Indicates how long this action was meant to be in effect before automatically expiring. */
  durationInHours?: number
  createdBy: string
  meta?: ActionMeta
  /** If the event needs a reference to previous event, for instance, when reverting a previous action, the reference event id should be passed */
  refEventId?: number
  [k: string]: unknown
}

export type OutputSchema = ComAtprotoAdminDefs.ActionView

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
  error?: 'SubjectHasAction'
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

export interface ActionMeta {
  reportType?: string
  [k: string]: unknown
}

export function isActionMeta(v: unknown): v is ActionMeta {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.takeModerationAction#actionMeta'
  )
}

export function validateActionMeta(v: unknown): ValidationResult {
  return lexicons.validate(
    'com.atproto.admin.takeModerationAction#actionMeta',
    v,
  )
}
