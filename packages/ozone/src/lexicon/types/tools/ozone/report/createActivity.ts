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
const id = 'tools.ozone.report.createActivity'

export type QueryParams = {}

export interface InputSchema {
  /** ID of the report to record activity on */
  reportId: number
  /** Type of activity to record */
  action: 'status_change' | 'note' | (string & {})
  /** Target status. Required when action is status_change. */
  toState?:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
  /** Optional free-text note. Can accompany any action type. */
  note?: string
  /** When action is status_change, also update report.status to toState. Defaults to true. */
  updateStatus: boolean
}

export interface OutputSchema {
  activity: ToolsOzoneReportDefs.ReportActivityView
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
  error?: 'ReportNotFound' | 'MissingTargetState' | 'InvalidStateTransition'
}

export type HandlerOutput = HandlerError | HandlerSuccess
