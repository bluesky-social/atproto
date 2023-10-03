/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoAdminDefs from './defs'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'
import * as ComAtprotoModerationDefs from '../moderation/defs'

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

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export class SubjectHasActionError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'SubjectHasAction') return new SubjectHasActionError(e)
  }
  return e
}

export interface ActionMeta {
  resolveReportIds?: number[]
  reportType?: ComAtprotoModerationDefs.ReasonType
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
