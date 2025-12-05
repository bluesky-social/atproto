/**
 * GENERATED CODE - DO NOT MODIFY
 */
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
const id = 'tools.ozone.moderation.listScheduledActions'

export type QueryParams = {}

export interface InputSchema {
  /** Filter actions scheduled to execute after this time */
  startsAfter?: string
  /** Filter actions scheduled to execute before this time */
  endsBefore?: string
  /** Filter actions for specific DID subjects */
  subjects?: string[]
  /** Filter actions by status */
  statuses: ('pending' | 'executed' | 'cancelled' | 'failed' | (string & {}))[]
  /** Maximum number of results to return */
  limit: number
  /** Cursor for pagination */
  cursor?: string
}

export interface OutputSchema {
  actions: ToolsOzoneModerationDefs.ScheduledActionView[]
  /** Cursor for next page of results */
  cursor?: string
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

export type HandlerOutput = HandlerError | HandlerSuccess
