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
import type * as ToolsOzoneReportDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.report.assignModerator'

export type QueryParams = {}

export interface InputSchema {
  /** The ID of the report to assign. */
  reportId: number
  /** Optional queue ID to associate the assignment with. If not provided and the report has been assigned on a queue before, it will stay on that queue. */
  queueId?: number
  /** Whether to assign the report to the moderator. */
  assign?: boolean
}

export type OutputSchema = ToolsOzoneReportDefs.AssignmentView

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
  error?: 'AlreadyAssigned'
}

export type HandlerOutput = HandlerError | HandlerSuccess
