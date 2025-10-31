/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as ToolsOzoneModerationDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.moderation.scheduleAction'

export type QueryParams = {}

export interface InputSchema {
  action: $Typed<Takedown> | { $type: string }
  /** Array of DID subjects to schedule the action for */
  subjects: string[]
  createdBy: string
  scheduling: SchedulingConfig
  modTool?: ToolsOzoneModerationDefs.ModTool
}

export type OutputSchema = ScheduledActionResults

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

/** Schedule a takedown action */
export interface Takedown {
  $type?: 'tools.ozone.moderation.scheduleAction#takedown'
  comment?: string
  /** Indicates how long the takedown should be in effect before automatically expiring. */
  durationInHours?: number
  /** If true, all other reports on content authored by this account will be resolved (acknowledged). */
  acknowledgeAccountSubjects?: boolean
  /** Names/Keywords of the policies that drove the decision. */
  policies?: string[]
}

const hashTakedown = 'takedown'

export function isTakedown<V>(v: V) {
  return is$typed(v, id, hashTakedown)
}

export function validateTakedown<V>(v: V) {
  return validate<Takedown & V>(v, id, hashTakedown)
}

/** Configuration for when the action should be executed */
export interface SchedulingConfig {
  $type?: 'tools.ozone.moderation.scheduleAction#schedulingConfig'
  /** Exact time to execute the action */
  executeAt?: string
  /** Earliest time to execute the action (for randomized scheduling) */
  executeAfter?: string
  /** Latest time to execute the action (for randomized scheduling) */
  executeUntil?: string
}

const hashSchedulingConfig = 'schedulingConfig'

export function isSchedulingConfig<V>(v: V) {
  return is$typed(v, id, hashSchedulingConfig)
}

export function validateSchedulingConfig<V>(v: V) {
  return validate<SchedulingConfig & V>(v, id, hashSchedulingConfig)
}

export interface ScheduledActionResults {
  $type?: 'tools.ozone.moderation.scheduleAction#scheduledActionResults'
  succeeded: string[]
  failed: FailedScheduling[]
}

const hashScheduledActionResults = 'scheduledActionResults'

export function isScheduledActionResults<V>(v: V) {
  return is$typed(v, id, hashScheduledActionResults)
}

export function validateScheduledActionResults<V>(v: V) {
  return validate<ScheduledActionResults & V>(v, id, hashScheduledActionResults)
}

export interface FailedScheduling {
  $type?: 'tools.ozone.moderation.scheduleAction#failedScheduling'
  subject: string
  error: string
  errorCode?: string
}

const hashFailedScheduling = 'failedScheduling'

export function isFailedScheduling<V>(v: V) {
  return is$typed(v, id, hashFailedScheduling)
}

export function validateFailedScheduling<V>(v: V) {
  return validate<FailedScheduling & V>(v, id, hashFailedScheduling)
}
